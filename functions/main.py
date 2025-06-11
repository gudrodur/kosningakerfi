# main.py (Final version with correct JSON serialization)

import os
import json # NEW: Import the json library
from dotenv import load_dotenv
from firebase_functions import https_fn, options
from firebase_admin import initialize_app, auth
import requests
import jwt

load_dotenv()

# --- SETUP ---
initialize_app()
options.set_global_options(region="europe-west2")

# --- CORS CONFIGURATION ---
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

# --- HELPER FUNCTION ---
def get_kenni_is_jwks_client(issuer_url: str):
    oidc_config_url = f"{issuer_url}/.well-known/openid-configuration"
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        config_response = requests.get(oidc_config_url, headers=headers)
        config_response.raise_for_status()
        jwks_uri = config_response.json()["jwks_uri"]
        return jwt.PyJWKClient(jwks_uri, headers=headers)
    except Exception as e:
        print(f"CRITICAL: Failed to get JWKS client: {e}")
        raise

# --- MAIN CLOUD FUNCTION ---
@https_fn.on_request()
def create_verified_user(req: https_fn.Request) -> https_fn.Response:
    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers=CORS_HEADERS)
    if req.method != "POST":
        return https_fn.Response("Invalid request method.", status=405, headers=CORS_HEADERS)

    # ... (all previous blocks are correct and unchanged) ...
    try:
        data = req.get_json()
        kenni_auth_code = data.get('kenniAuthCode')
        google_id_token = data.get('googleIdToken')
        pkce_code_verifier = data.get('pkceCodeVerifier')
        if not all([kenni_auth_code, google_id_token, pkce_code_verifier]):
            return https_fn.Response("Missing required fields.", status=400, headers=CORS_HEADERS)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400, headers=CORS_HEADERS)

    try:
        decoded_google_token = auth.verify_id_token(google_id_token)
        google_name = decoded_google_token.get('name')
        print(f"Successfully verified Google token for: {google_name}")
    except Exception as e:
        print(f"Error verifying Google token: {e}")
        return https_fn.Response(f"Failed to verify Google token: {str(e)}", status=401, headers=CORS_HEADERS)

    try:
        issuer_url = os.environ.get("KENNI_IS_ISSUER_URL")
        client_id = os.environ.get("KENNI_IS_CLIENT_ID")
        client_secret = os.environ.get("KENNI_IS_CLIENT_SECRET")
        if not all([issuer_url, client_id, client_secret]):
            raise ValueError("One or more environment variables for Kenni.is are not set.")
        token_url = f"{issuer_url}/oidc/token"
        payload = {
            'grant_type': 'authorization_code', 'code': kenni_auth_code,
            'redirect_uri': 'http://localhost:3000/auth/callback',
            'client_id': client_id, 'client_secret': client_secret,
            'code_verifier': pkce_code_verifier
        }
        token_response = requests.post(token_url, data=payload, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        token_response.raise_for_status()
        token_data = token_response.json()
        kenni_is_id_token = token_data.get("id_token")
        if not kenni_is_id_token:
            raise ValueError(f"id_token not found in Kenni.is response: {token_data}")
    except Exception as e:
        print(f"Error during token exchange: {str(e)}")
        return https_fn.Response(f"An internal error occurred during token exchange: {str(e)}", status=500, headers=CORS_HEADERS)

    try:
        jwks_client = get_kenni_is_jwks_client(issuer_url)
        signing_key = jwks_client.get_signing_key_from_jwt(kenni_is_id_token)
        decoded_kenni_token = jwt.decode(
            kenni_is_id_token, signing_key.key, algorithms=["RS256"],
            audience=client_id, issuer=issuer_url
        )
        kenni_is_name = decoded_kenni_token.get("name")
        kenni_is_national_id = decoded_kenni_token.get("national_id")
        print(f"Successfully verified Kenni.is token for: {kenni_is_name}")
    except Exception as e:
        print(f"Error decoding/verifying Kenni.is token: {e}")
        return https_fn.Response(f"Invalid Kenni.is ID token: {str(e)}", status=401, headers=CORS_HEADERS)

    if google_name.lower() != kenni_is_name.lower():
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"!!! WARNING: Name mismatch detected during development.")
        print(f"!!!   Google Name: '{google_name}'")
        print(f"!!!   Kenni.is Name: '{kenni_is_name}'")
        print("!!!   Proceeding with user creation anyway.")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    else:
        print("INFO: Names match between Google and Kenni.is. Proceeding.")

    try:
        uid = kenni_is_national_id
        try:
            user = auth.get_user(uid)
            print(f"INFO: User with UID {uid} already exists.")
        except auth.UserNotFoundError:
            print(f"INFO: Creating new user with UID {uid}.")
            user = auth.create_user(uid=uid, display_name=kenni_is_name)
        
        custom_token = auth.create_custom_token(uid)
        
        # THE FIX IS HERE: We manually convert the dictionary to a JSON string.
        response_data = {"customToken": custom_token.decode("utf-8")}
        return https_fn.Response(
            json.dumps(response_data), # Use json.dumps()
            status=200,
            mimetype="application/json",
            headers=CORS_HEADERS
        )
    except Exception as e:
        print(f"ERROR: Failed to create user or custom token: {str(e)}")
        return https_fn.Response(f"Failed to create user: {str(e)}", status=500, headers=CORS_HEADERS)