Icelandic Electronic Voting System
A secure electronic voting application built with React and a Firebase backend. This project features a robust two-factor registration process using the Icelandic Kenni.is OIDC provider and Google for authentication, ensuring verified and unique user identities.

About the Authentication System
This project implements a unique and secure authentication flow designed for applications requiring strong identity verification for Icelandic users.

Primary Identity Verification: Uses the official Kenni.is OIDC provider to verify a user's identity via their national ID (kennitala) and electronic certificates.

Convenient Subsequent Logins: After a one-time registration, users sign in seamlessly using their Google Account, which is permanently linked to their verified identity.

Secure User Model: The system does not use the sensitive national ID as a primary key. Instead, it uses a randomly generated, anonymous Firebase UID. The kennitala is stored securely as a field in a protected Firestore document.

Role-Based Access Control: Implements a simple but effective role system (user, admin) using Firebase Custom Claims and Firestore document fields.

🚀 Features
React Frontend: A modern, responsive user interface built with Create React App and styled with Tailwind CSS.

Firebase Backend: Secure, serverless business logic powered by Cloud Functions for Firebase (Python).

Two-Factor Registration Flow: Combines Kenni.is for identity proofing and Google for easy account access.

Firestore Database: A NoSQL database for storing user profiles and election data, protected by robust security rules.

Role-Based Views: The UI conditionally renders different components (AdminDashboard vs. ElectionDashboard) based on user roles.

Full Local Development Environment: Utilizes the complete Firebase Emulator Suite (Auth, Functions, Firestore, Hosting) for offline development and testing.

📦 Project Structure
.
├── frontend/             # React Frontend Application (Create React App)
│   ├── public/
│   └── src/
│       ├── App.js        # Main component with routing and auth state
│       ├── AuthPage.js   # Component for login/registration choices
│       ├── AdminDashboard.js # Admin-only component for creating elections
│       └── ElectionDashboard.js # User-facing component to view elections
│
├── functions/            # Firebase Cloud Functions (Python Backend)
│   ├── main.py         # Cloud Function definitions for auth and elections
│   ├── set_admin.py    # One-time script to grant admin roles
│   └── requirements.txt  # Python dependencies
│
├── firebase.json         # Firebase project configuration (emulators, hosting)
├── firestore.rules       # Security rules for the Firestore database
└── ...

🛠️ Setup and Development
Follow these steps to set up and run the project locally.

Prerequisites
Node.js (v14 or later)

Python (v3.10 or later) and pip

Firebase CLI (npm install -g firebase-tools)

1. Clone and Install Dependencies
# Clone the repository
git clone <your-repo-url>
cd <project-folder>

# Install frontend dependencies
cd frontend
npm install
cd ..

# Set up Python virtual environment and install backend dependencies
cd functions
python -m venv venv
# Activate the virtual environment (syntax depends on your OS)
# On Windows:
# venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate
pip install -r requirements.txt
cd ..

2. Environment Setup
The backend requires credentials for the Kenni.is OIDC service.

Create a file named .env inside the functions/ directory.

Add your credentials to the file:

# functions/.env
KENNI_IS_ISSUER_URL="https://idp.kenni.is/sosi-kosningakerfi.is"
KENNI_IS_CLIENT_ID="your-kenni-is-client-id"
KENNI_IS_CLIENT_SECRET="your-kenni-is-client-secret"

3. Run the Development Environment
You need two terminals running concurrently.

Terminal 1: Start Firebase Emulators

# From the project root directory
firebase emulators:start

This will start the emulators for Authentication, Functions, Firestore, and Hosting.

Terminal 2: Start the React Frontend

# From the /frontend directory
npm start

Your application will be available at http://localhost:3000, and the Emulator UI can be viewed at http://localhost:4000.

4. Granting Admin Privileges
To create elections, a user must have admin privileges.

First, register a new user through the application's "New Registration" flow.

Open the functions/set_admin.py file and set the USER_KENNITALA_TO_MAKE_ADMIN variable to the national ID of the user you just registered.

Run the script from the project root (ensure your Python virtual environment is active):

# Make sure you are in the root directory
python functions/set_admin.py

The user will now have admin rights on their next login.

🔧 Technology Stack
Frontend: React, React Router, Tailwind CSS

Backend: Cloud Functions for Firebase (Python), Flask

Authentication: Firebase Authentication, Kenni.is (OIDC), Google Identity

Database: Cloud Firestore

Development: Create React App, Firebase Emulator Suite, requests, PyJWT

📄 License
This project is licensed under the MIT License.
