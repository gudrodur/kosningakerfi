# Electronic Voting System

A secure electronic voting application built with React and a Firebase backend. This project features a robust two-factor registration process using the Icelandic Kenni.is OIDC provider and Google authentication, ensuring that each user is uniquely and verifiably identified.

## About the Authentication System

This project implements a secure authentication flow tailored for applications that require strong identity verification for Icelandic users:

- **Primary Identity Verification:**  
    Users verify their identity using the official Kenni.is OIDC provider, which authenticates via their national ID (kennitala) and electronic certificates.

- **Convenient Subsequent Logins:**  
    After the initial registration, users can sign in seamlessly using their Google Account, which is permanently linked to their verified identity.

- **Secure User Model:**  
    The system does not use the sensitive national ID as a primary key. Instead, it relies on a randomly generated, anonymous Firebase UID. The kennitala is stored securely as a field in a protected Firestore document.

- **Role-Based Access Control:**  
    A simple but effective role system (user, admin) is implemented using Firebase Custom Claims and Firestore document fields.

This approach ensures both strong identity verification and user privacy, making it suitable for secure electronic voting and similar applications.

## 🚀 Features

- **Modern React Frontend:**  
    Built with Create React App and styled using Tailwind CSS for a responsive user experience.

- **Secure, Serverless Backend:**  
    Business logic is handled by Cloud Functions for Firebase (Python), ensuring scalability and security.

- **Two-Factor Registration Flow:**  
    Combines Kenni.is for strong identity verification and Google authentication for convenient account access.

- **Firestore Database:**  
    Uses a NoSQL Firestore database to store user profiles and election data, protected by strict security rules.

- **Role-Based Views:**  
    The UI displays different components (such as `AdminDashboard` for admins and `ElectionDashboard` for regular users) based on user roles.

- **Full Local Development Environment:**  
    Supports offline development and testing with the complete Firebase Emulator Suite (Authentication, Functions, Firestore, Hosting).
```
📦 Project Structure.
├── frontend/                # React Frontend Application (Create React App)
│   ├── public/
│   └── src/
│       ├── App.js           # Main component with routing and auth state
│       ├── AuthPage.js      # Component for login/registration choices
│       ├── AdminDashboard.js  # Admin-only component for creating elections
│       └── ElectionDashboard.js # User-facing component to view elections
│
├── functions/               # Firebase Cloud Functions (Python Backend)
│   ├── main.py            # Cloud Function definitions for auth and elections
│   ├── set_admin.py       # One-time script to grant admin roles
│   └── requirements.txt     # Python dependencies
│
├── firebase.json            # Firebase project configuration (emulators, hosting)
├── firestore.rules          # Security rules for the Firestore database
└── ...
```
## 🛠️ Setup and Development

Follow these steps to set up and run the project locally.

### Prerequisites

- **Node.js** (v14 or later)
- **Python** (v3.10 or later) and pip
- **Firebase CLI**  
    Install globally with:  
    ```bash
    npm install -g firebase-tools
    ```

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd <project-folder>
```

**Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

**Set up Python virtual environment and install backend dependencies:**
```bash
cd functions
python -m venv venv
```

Activate the virtual environment:

- **On Windows:**
    ```bash
    venv\Scripts\activate
    ```
- **On macOS/Linux:**
    ```bash
    source venv/bin/activate
    ```

Install Python dependencies:
```bash
pip install -r requirements.txt
cd ..
```

### 2. Environment Setup

The backend requires credentials for the Kenni.is OIDC service.

- Create a file named `.env` inside the `functions/` directory.
- Add your credentials to the file:

    ```env
    # functions/.env
    KENNI_IS_ISSUER_URL="https://idp.kenni.is/sosi-kosningakerfi.is"
    KENNI_IS_CLIENT_ID="your-kenni-is-client-id"
    KENNI_IS_CLIENT_SECRET="your-kenni-is-client-secret"
    ```

### 3. Run the Development Environment

You need two terminals running concurrently.

**Terminal 1: Start Firebase Emulators**
```bash
# From the project root directory
firebase emulators:start
```
This will start the emulators for Authentication, Functions, Firestore, and Hosting.

**Terminal 2: Start the React Frontend**
```bash
# From the /frontend directory
npm start
```
- Your application: [http://localhost:3000](http://localhost:3000)
- Emulator UI: [http://localhost:4000](http://localhost:4000)

### 4. Granting Admin Privileges

To create elections, a user must have admin privileges.

1. Register a new user through the application's "New Registration" flow.
2. Open `functions/set_admin.py` and set the `USER_KENNITALA_TO_MAKE_ADMIN` variable to the national ID of the user you just registered.
3. Run the script from the project root (ensure your Python virtual environment is active):

     ```bash
     python functions/set_admin.py
     ```

The user will now have admin rights on their next login.

---

## 🔧 Technology Stack

- **Frontend:** React, React Router, Tailwind CSS
- **Backend:** Cloud Functions for Firebase (Python), Flask
- **Authentication:** Firebase Authentication, Kenni.is (OIDC), Google Identity
- **Database:** Cloud Firestore
- **Development:** Create React App, Firebase Emulator Suite, requests, PyJWT

---

## 📄 License

This project is licensed under the MIT License.
