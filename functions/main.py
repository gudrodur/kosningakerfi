# main.py
# This file contains the Cloud Functions for the electronic voting system.

import os
import json
import datetime
from dotenv import load_dotenv

import requests
import jwt

from firebase_admin import initialize_app, auth, firestore
from firebase_functions import https_fn, options

# --- SETUP ---
# Load environment variables from a .env file for local development.
load_dotenv()

# Initialize the Firebase Admin SDK. This should only be called once.
if not firebase_admin._apps:
    initialize_app()

# Set the global region for all functions in this file.
options.set_global_options(region="europe-west2")

# --- CONSTANTS ---
# Define CORS headers to allow requests from the frontend client.
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

# --- HELPER FUNCTIONS ---
def get_kenni_is_jwks_client(issuer_url: str):
    """
    Fetches the JSON Web Key Set (JWKS) from the Kenni.is OIDC provider.
    This is used to verify the signature of ID tokens.
    """
    oidc_config_url = f"{issuer_url}/.well-known/openid-configuration"
    try:
        # A User-Agent header is required by the Kenni.is server.
        headers = {'User-Agent': 'Mozilla/5.0'}
        config_response = requests.get(oidc_config_url, headers=headers)
        config_response.raise_for_status()
        jwks_uri = config_response.json()["jwks_uri"]
        return jwt.PyJWKClient(jwks_uri, headers=headers)
    except Exception as e:
        print(f"CRITICAL: Failed to get JWKS client: {e}")
        raise

# --- CLOUD FUNCTIONS ---

@https_fn.on_request()
def create_verified_user(req: https_fn.Request) -> https_fn.Response:
    """
    Handles the FIRST part of the registration: Verifying the Kenni.is token.
    It creates a primary Firebase user with the national ID as UID if one doesn't exist,
    and returns a custom token for that user.
    IT DOES NOT DEAL WITH GOOGLE TOKENS.
    """
    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers=CORS_HEADERS)
    if req.method != "POST":
        return https_fn.Response("Invalid request method.", status=405, headers=CORS_HEADERS)

    try:
        data = req.get_json()
        kenni_auth_code = data.get('kenniAuthCode')
        pkce_code_verifier = data.get('pkceCodeVerifier')
        if not all([kenni_auth_code, pkce_code_verifier]):
            return https_fn.Response("Missing required fields.", status=400, headers=CORS_HEADERS)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400, headers=CORS_HEADERS)

    try:
        issuer_url = os.environ.get("KENNI_IS_ISSUER_URL")
        client_id = os.environ.get("KENNI_IS_CLIENT_ID")
        client_secret = os.environ.get("KENNI_IS_CLIENT_SECRET")
        token_url = f"{issuer_url}/oidc/token"
        payload = {
            'grant_type': 'authorization_code', 'code': kenni_auth_code,
            'redirect_uri': 'http://localhost:3000/auth/callback',
            'client_id': client_id, 'client_secret': client_secret,
            'code_verifier': pkce_code_verifier
        }
        token_response = requests.post(token_url, data=payload, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        token_response.raise_for_status()
        kenni_is_id_token = token_response.json().get("id_token")
        
        jwks_client = get_kenni_is_jwks_client(issuer_url)
        signing_key = jwks_client.get_signing_key_from_jwt(kenni_is_id_token)
        decoded_kenni_token = jwt.decode(
            kenni_is_id_token, signing_key.key, algorithms=["RS256"],
            audience=client_id, issuer=issuer_url
        )
        kenni_is_name = decoded_kenni_token.get("name")
        kenni_is_national_id = decoded_kenni_token.get("national_id")
        print(f"Successfully verified Kenni.is token for: {kenni_is_name}")

        uid = kenni_is_national_id
        try:
            user = auth.get_user(uid)
            print(f"INFO: User with UID {uid} already exists.")
        except auth.UserNotFoundError:
            print(f"INFO: Creating new user with UID {uid}.")
            user = auth.create_user(uid=uid, display_name=kenni_is_name)
        
        custom_token = auth.create_custom_token(uid)
        response_data = {"customToken": custom_token.decode("utf-8")}
        return https_fn.Response(json.dumps(response_data), status=200, mimetype="application/json", headers=CORS_HEADERS)
    
    except Exception as e:
        print(f"ERROR in create_verified_user: {str(e)}")
        return https_fn.Response(f"An internal error occurred: {str(e)}", status=500, headers=CORS_HEADERS)


@https_fn.on_call(secrets=["KENNI_IS_CLIENT_ID"])
def create_election(req: https_fn.CallableRequest) -> https_fn.Response:
    """A Callable Function for admins to create an election."""
    if not req.auth or req.auth.token.get('isAdmin') != True:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED, message="User must be an admin.")
    
    data = req.data
    required_fields = ['name', 'description', 'startDate', 'endDate']
    if not all(field in data for field in required_fields):
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Missing required fields.")
    
    try:
        db = firestore.client()
        new_election_data = {
            'name': data['name'],
            'description': data['description'],
            'startDate': datetime.datetime.fromisoformat(data['startDate'].replace('Z', '+00:00')),
            'endDate': datetime.datetime.fromisoformat(data['endDate'].replace('Z', '+00:00')),
            'isPublished': False,
            'createdBy': req.auth.uid,
            'createdAt': firestore.SERVER_TIMESTAMP
        }
        update_time, election_ref = db.collection('elections').add(new_election_data)
        print(f"Successfully created election '{data['name']}' with ID: {election_ref.id}")
        return {"status": "success", "electionId": election_ref.id}
    except Exception as e:
        print(f"ERROR: Failed to create election: {str(e)}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"An internal error occurred.")
