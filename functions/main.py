# main.py
# This file contains the Cloud Functions for the electronic voting system.

import os
import json
import datetime
from dotenv import load_dotenv

import requests
import jwt

import firebase_admin
from firebase_admin import initialize_app, auth, firestore, credentials
from firebase_functions import https_fn, options

# --- SETUP ---
load_dotenv()

if not firebase_admin._apps:
    initialize_app()

options.set_global_options(region="europe-west2")

# --- CONSTANTS ---
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

# --- HELPER FUNCTIONS ---
def get_kenni_is_jwks_client(issuer_url: str):
    oidc_config_url = f"{issuer_url}/.well-known/openid-configuration"
    try:
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
    # Handle CORS preflight requests
    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers=CORS_HEADERS)
    
    # Ensure the method is POST for the actual logic
    if req.method != "POST":
        return https_fn.Response("Invalid request method.", status=405, headers=CORS_HEADERS)

    # Validate incoming data
    try:
        data = req.get_json()
        kenni_auth_code = data.get('kenniAuthCode')
        pkce_code_verifier = data.get('pkceCodeVerifier')
        if not all([kenni_auth_code, pkce_code_verifier]):
            return https_fn.Response("Missing required fields.", status=400, headers=CORS_HEADERS)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400, headers=CORS_HEADERS)

    # Main logic block
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
        national_id = decoded_kenni_token.get("national_id")
        full_name = decoded_kenni_token.get("name")
        print(f"Successfully verified Kenni.is token for: {full_name} ({national_id})")

        db = firestore.client()
        users_ref = db.collection('users')
        query = users_ref.where('kennitala', '==', national_id).limit(1)
        existing_users = list(query.stream())

        auth_uid = None
        if existing_users:
            user_doc = existing_users[0]
            auth_uid = user_doc.id
            print(f"INFO: User profile for kennitala {national_id} already exists with UID {auth_uid}.")
        else:
            print(f"INFO: Creating new user for kennitala {national_id}.")
            new_user = auth.create_user(display_name=full_name)
            auth_uid = new_user.uid
            print(f"INFO: Created new Firebase Auth user with UID: {auth_uid}")

            user_profile_data = {
                'fullName': full_name,
                'kennitala': national_id,
                'email': None,
                'photoURL': None,
                'role': 'user',
                'createdAt': firestore.SERVER_TIMESTAMP
            }
            db.collection('users').document(auth_uid).set(user_profile_data)
            print(f"INFO: Created Firestore user profile at /users/{auth_uid}")
        
        custom_token = auth.create_custom_token(auth_uid)
        response_data = {"customToken": custom_token.decode("utf-8")}
        return https_fn.Response(json.dumps(response_data), status=200, mimetype="application/json", headers=CORS_HEADERS)

    except Exception as e:
        print(f"ERROR in create_verified_user: {str(e)}")
        return https_fn.Response(f"An internal error occurred: {str(e)}", status=500, headers=CORS_HEADERS)


@https_fn.on_call(secrets=["KENNI_IS_CLIENT_ID"])
def create_election(req: https_fn.CallableRequest) -> dict:
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
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="An internal error occurred.")


@https_fn.on_call()
def update_user_profile(req: https_fn.CallableRequest) -> dict:
    if not req.auth:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="User must be authenticated.")

    uid = req.auth.uid
    data = req.data
    email = data.get('email')
    photo_url = data.get('photoURL')

    if not email:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Email is a required field.")

    try:
        db = firestore.client()
        user_ref = db.collection('users').document(uid)
        
        update_data = {
            'email': email,
            'lastLogin': firestore.SERVER_TIMESTAMP
        }
        if photo_url:
            update_data['photoURL'] = photo_url

        user_ref.update(update_data)
        
        auth.update_user(uid, email=email, email_verified=True)

        print(f"Successfully updated profile for user: {uid}")
        return {"status": "success", "message": f"Profile for {uid} updated."}

    except Exception as e:
        print(f"ERROR: Failed to update user profile for {uid}: {str(e)}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="An internal error occurred while updating profile.")
