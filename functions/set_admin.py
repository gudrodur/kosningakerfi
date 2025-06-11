# set_admin.py
# A one-time script to grant administrative privileges to a user.
# This works by setting a "custom claim" on the user's Firebase Auth token.
# The `create_election` Cloud Function and Firestore security rules will
# then check for this claim to authorize admin-only actions.

import os
import firebase_admin
from firebase_admin import credentials, auth

# --- IMPORTANT: SETUP INSTRUCTIONS ---
# 1. Download your service account key from the Firebase Console:
#    Project Settings > Service accounts > "Generate new private key".
# 2. Save the downloaded JSON file as 'serviceAccountKey.json' in the same
#    directory as this script (the root of your project).
# 3. VERY IMPORTANT: Add 'serviceAccountKey.json' to your main .gitignore file!
#    This file contains sensitive credentials and should never be committed
#    to version control.

# --- CONFIGURATION ---
# Replace this with the UID (kennitala) of the user you want to make an admin.
# I'm using the UID from your test logs.
USER_UID_TO_MAKE_ADMIN = "2009783589" 

# The path to your service account key file.
SERVICE_ACCOUNT_KEY_PATH = "serviceAccountKey.json"


def set_admin_claim():
    """
    Initializes the Firebase Admin SDK and sets the custom claim for the specified user.
    """
    try:
        # Check if the service account key file exists.
        if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            print(f"ERROR: Service account key file not found at '{SERVICE_ACCOUNT_KEY_PATH}'.")
            print("Please follow the setup instructions in the script's comments.")
            return

        # Initialize the Firebase Admin SDK with the service account credentials.
        # This gives the script administrative access to your Firebase project.
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        
        # Check if an app is already initialized to avoid errors.
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        # Set the custom user claim 'isAdmin' to True for the specified user.
        # This claim will be included in the user's ID token upon their next login/refresh.
        auth.set_custom_user_claims(USER_UID_TO_MAKE_ADMIN, {'isAdmin': True})
        
        # To verify, fetch the user and check their custom claims.
        user = auth.get_user(USER_UID_TO_MAKE_ADMIN)
        if user.custom_claims and user.custom_claims.get('isAdmin'):
            print("--- SUCCESS ---")
            print(f"Successfully set 'isAdmin=True' for user: {USER_UID_TO_MAKE_ADMIN} ({user.display_name})")
            print("The user will have admin privileges on their next sign-in or token refresh.")
        else:
            # This case should ideally not be reached if set_custom_user_claims succeeds.
            print(f"ERROR: Failed to verify the admin claim for user {USER_UID_TO_MAKE_ADMIN}")

    except Exception as e:
        print(f"--- AN ERROR OCCURRED ---")
        print(e)
        print("\nPlease ensure 'serviceAccountKey.json' is valid and the UID is correct.")

# --- SCRIPT EXECUTION ---
if __name__ == "__main__":
    set_admin_claim()
