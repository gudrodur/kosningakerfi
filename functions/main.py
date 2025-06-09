# main.py

# Import necessary libraries from Firebase
from firebase_functions import https_fn, options
from firebase_admin import initialize_app, auth
import firebase_admin

# Initialize the Firebase Admin SDK. 
# This is a one-time setup that gives your server-side code
# access to Firebase services with admin privileges.
initialize_app()

# Set the region for the function to deploy to.
# This should match the region you selected for your Firestore database.
options.set_global_options(region="europe-west2")

@https_fn.on_request(cors=True)
def create_verified_user(req: https_fn.Request) -> https_fn.Response:
    """
    This HTTP-callable function will be the endpoint for creating a new, verified user.
    It's designed to receive tokens from both Kenni.is and Google,
    validate them, compare the user details, and finally create a single
    Firebase user with a custom token for signing in.

    Args:
        req (https_fn.Request): The incoming HTTP request from the client.
                                We expect a POST request with a JSON body like:
                                { "kenniToken": "...", "googleToken": "..." }

    Returns:
        https_fn.Response: An HTTP response. On success, it returns a custom
                           Firebase auth token. On failure, it returns an
                           error message.
    """
    print("Function 'createVerifiedUser' was invoked successfully.")

    if req.method != "POST":
        print("Error: Invalid request method. Expected POST.")
        return https_fn.Response("Invalid request method. Please use POST.", status=405)

    try:
        data = req.get_json()
        google_id_token = data.get('googleToken')

        if not google_id_token:
            print("Error: 'googleToken' is missing from the request body.")
            return https_fn.Response("'googleToken' is required.", status=400)

    except Exception as e:
        print(f"Error parsing JSON body: {e}")
        return https_fn.Response("Invalid JSON in request body.", status=400)


    # --- STEP 1: Verify the Google ID Token ---
    # This is the first security check. We use the Firebase Admin SDK
    # to confirm that the token sent from the client is a valid token
    # issued by Google for our Firebase project.
    try:
        decoded_google_token = auth.verify_id_token(google_id_token)
        google_uid = decoded_google_token['uid']
        google_name = decoded_google_token.get('name', 'N/A')
        google_email = decoded_google_token.get('email', 'N/A')

        print(f"Successfully verified Google token for user: {google_name} ({google_email})")
        print(f"Google UID: {google_uid}")

    except auth.InvalidIdTokenError:
        print("Error: Invalid Google ID Token.")
        return https_fn.Response("The provided Google token is invalid.", status=401)
    except Exception as e:
        print(f"An unexpected error occurred during Google token verification: {e}")
        return https_fn.Response("Failed to verify Google token.", status=500)


    # --- FUTURE IMPLEMENTATION STEPS ---
    # 1. Get and verify the Kenni.is token.
    # 2. Compare the full name from Kenni.is with `google_name`.
    # 3. If names match:
    #    a. Check if a user with the kennitala already exists.
    #    b. If not, create a new Firebase user with kennitala as UID.
    #    c. Store user details in Firestore.
    #    d. Generate a custom Firebase token for signing in.
    #    e. Return the custom token.

    # For now, return a success response with the verified Google user's name.
    return https_fn.Response(
        f"Successfully verified Google user: {google_name}",
        status=200
    )
