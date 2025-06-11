# set_admin.py
# A one-time script to grant administrative privileges to a user.
# This works by setting a "custom claim" on the user's Firebase Auth token
# AND updating their role in their Firestore user profile document.

import os
import firebase_admin
from firebase_admin import credentials, auth, firestore

# --- IMPORTANT: SETUP INSTRUCTIONS ---
# 1. Download your service account key from the Firebase Console.
# 2. Save it as 'serviceAccountKey.json' in the root of the project.
# 3. Add 'serviceAccountKey.json' to your main .gitignore file!

# --- CONFIGURATION ---
# Replace this with the KENNITALA of the user you want to make an admin.
USER_KENNITALA_TO_MAKE_ADMIN = "2009783589" 

# The path to your service account key file.
SERVICE_ACCOUNT_KEY_PATH = "serviceAccountKey.json"


def set_admin_claim():
    """
    Initializes the Firebase Admin SDK and sets the custom claim
    and Firestore role for the specified user.
    """
    try:
        if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            print(f"ERROR: Service account key file not found at '{SERVICE_ACCOUNT_KEY_PATH}'.")
            return

        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        db = firestore.client()

        # NEW LOGIC: Find the user's UID by querying Firestore for their kennitala
        print(f"Searching for user with kennitala: {USER_KENNITALA_TO_MAKE_ADMIN}...")
        users_ref = db.collection('users')
        query = users_ref.where('kennitala', '==', USER_KENNITALA_TO_MAKE_ADMIN).limit(1)
        results = list(query.stream())

        if not results:
            print(f"--- ERROR ---")
            print(f"No user found with kennitala '{USER_KENNITALA_TO_MAKE_ADMIN}' in Firestore.")
            return

        # Get the user's document and their actual Firebase Auth UID
        user_doc = results[0]
        auth_uid = user_doc.id
        print(f"Found user '{user_doc.to_dict().get('fullName')}' with UID: {auth_uid}")

        # 1. Set the custom user claim 'isAdmin' to True for the user in Auth
        auth.set_custom_user_claims(auth_uid, {'isAdmin': True})
        
        # 2. Update the role in the user's Firestore document
        user_doc.reference.update({'role': 'admin'})
        
        # Verify both steps
        user = auth.get_user(auth_uid)
        updated_doc = user_doc.reference.get()

        if user.custom_claims and user.custom_claims.get('isAdmin') and updated_doc.to_dict().get('role') == 'admin':
            print("--- SUCCESS ---")
            print(f"Successfully set 'isAdmin=True' and 'role=admin' for user: {auth_uid} ({user.display_name})")
            print("The user will have admin privileges on their next sign-in or token refresh.")
        else:
            print(f"ERROR: Failed to verify the admin claim/role for user {auth_uid}")

    except Exception as e:
        print(f"--- AN ERROR OCCURRED ---")
        print(e)
        print("\nPlease ensure 'serviceAccountKey.json' is valid and the kennitala is correct.")

# --- SCRIPT EXECUTION ---
if __name__ == "__main__":
    set_admin_claim()