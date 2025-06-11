import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithCustomToken,
  connectAuthEmulator
} from 'firebase/auth';

// --- IMPORTANT: CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDRmne1Qf5pqDpvJm9Q0ZPqrGwACZOv0Zk",
  authDomain: "kosningakerfi-sosi-2025.firebaseapp.com",
  projectId: "kosningakerfi-sosi-2025",
  storageBucket: "kosningakerfi-sosi-2025.appspot.com",
  messagingSenderId: "143792348363",
  appId: "1:143792348363:web:c6f70492197f40e48dcf4e"
};

// --- Kenni.is Configuration ---
// The Client ID for your application, obtained from the Kenni.is developer portal.
const KENNI_IS_CLIENT_ID = '@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s';
// The exact URI to which Kenni.is will redirect the user after authentication.
const KENNI_IS_REDIRECT_URI = 'http://localhost:3000/auth/callback';
// The URL of your backend function that will handle the token exchange.
const CLOUD_FUNCTION_URL = "http://127.0.0.1:5001/kosningakerfi-sosi-2025/europe-west2/create_verified_user";
// --- END OF CONFIGURATION ---


// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to local emulators if running on localhost for testing purposes.
if (window.location.hostname === "localhost") {
  console.log("Testing locally, connecting to emulators.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
}


// --- PKCE (Proof Key for Code Exchange) HELPER FUNCTIONS ---
// This is a security feature to ensure that the auth code is redeemed by the same client who requested it.

// Encodes a string into Base64URL format.
function base64URLEncode(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Hashes a buffer using the SHA-256 algorithm.
async function sha256(buffer) {
  const digest = await window.crypto.subtle.digest('SHA-256', buffer);
  return digest;
}

// Generates a random 'verifier' and a corresponding 'challenge' for the PKCE flow.
async function generatePkceChallenge() {
  const verifier = base64URLEncode(window.crypto.getRandomValues(new Uint8Array(32)));
  const buffer = new TextEncoder().encode(verifier);
  const hash = await sha256(buffer);
  const challenge = base64URLEncode(hash);
  return { verifier, challenge };
}


// --- BACKEND API CALL ---
/**
 * Calls the backend Cloud Function to exchange tokens and create/verify the user.
 * On success, it receives a custom Firebase token and signs the user in.
 * @param {string} kenniAuthCode - The authorization code from Kenni.is.
 * @param {string} googleIdToken - The ID token from Google Sign-In.
 * @param {string} pkceCodeVerifier - The PKCE code verifier generated before the redirect.
 */
async function callCreateUserFunction(kenniAuthCode, googleIdToken, pkceCodeVerifier) {
  console.log("Sending all tokens to backend function...");
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kenniAuthCode,
        googleIdToken,
        pkceCodeVerifier
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.customToken) {
        throw new Error("Custom token not found in response.");
    }

    console.log("Received custom token, signing in...");
    await signInWithCustomToken(auth, data.customToken);
    console.log("Successfully signed in with custom token.");

  } catch (error) {
    console.error("Error calling createVerifiedUser function or signing in:", error);
    alert(`An error occurred during the final registration step: ${error.message}`);
  }
}


// --- REACT COMPONENTS ---

/**
 * The initial login page component.
 * It guides the user to start the registration process by authenticating with Kenni.is.
 */
function Login() {
  const handleKenniSignIn = async () => {
    try {
      // Step 1: Generate the PKCE verifier and challenge.
      const { verifier, challenge } = await generatePkceChallenge();
      // Store the verifier in session storage to retrieve it after the redirect.
      sessionStorage.setItem('pkce_code_verifier', verifier);

      // Step 2: Construct the authorization URL with all required parameters.
      const params = new URLSearchParams({
        client_id: KENNI_IS_CLIENT_ID,
        redirect_uri: KENNI_IS_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid profile national_id', // Request necessary user data
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      
      const loginUrl = `https://idp.kenni.is/sosi-kosningakerfi.is/oidc/auth?${params.toString()}`;
      
      // Step 3: Redirect the user to the Kenni.is login page.
      window.location.assign(loginUrl);
    } catch (error) {
      console.error("Failed to generate PKCE challenge:", error);
      alert("Could not prepare secure sign-in.");
    }
  };

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center text-gray-800">Nýskráning</h1>
      <p className="text-center text-gray-600">
        Fyrir fyrstu innskráningu þarftu að auðkenna þig með rafrænum skilríkjum.
      </p>
      <div className="space-y-4">
        <button
          onClick={handleKenniSignIn}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Hefja nýskráningu með Kenni.is
        </button>
      </div>
    </div>
  );
}

/**
 * Handles the callback from Kenni.is after the user has authenticated.
 * This component is the second step of the two-factor registration process.
 */
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Processing authentication from Kenni.is...");

  // This effect runs once when the component loads.
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      // Store the received code and update the UI to prompt for the next step.
      sessionStorage.setItem('kenni_auth_code', code);
      setStatusMessage("Kenni.is authentication successful. Please connect your Google account to complete registration.");
    } else {
      setError("Authorization code was not found. Please try the login process again.");
    }
  }, [searchParams]);

  // This function is triggered when the user clicks the "Sign in with Google" button.
  const handleGoogleSignInAndCombine = async () => {
    // Retrieve the necessary data from session storage.
    const kenniAuthCode = sessionStorage.getItem('kenni_auth_code');
    const pkceCodeVerifier = sessionStorage.getItem('pkce_code_verifier');

    if (!kenniAuthCode || !pkceCodeVerifier) {
      setError("Could not find necessary data from Kenni.is. Please start over.");
      return;
    }

    const provider = new GoogleAuthProvider();
    try {
      // Step 1: Sign in with Google to get the Google ID token.
      setStatusMessage("Waiting for Google Sign-In...");
      const result = await signInWithPopup(auth, provider);
      const googleIdToken = await result.user.getIdToken();
      
      // Step 2: Call the backend function with all three pieces of information.
      setStatusMessage("Sending data to backend for verification. Please wait...");
      await callCreateUserFunction(kenniAuthCode, googleIdToken, pkceCodeVerifier);

      // Step 3: Clean up session storage.
      sessionStorage.removeItem('pkce_code_verifier');
      sessionStorage.removeItem('kenni_auth_code');

      // Step 4: Navigate to the home page. The onAuthStateChanged listener will handle the UI update.
      navigate('/'); 

    } catch (error) {
      console.error("Error during Google sign-in or backend call:", error);
      setError(`An error occurred: ${error.message}`);
      setStatusMessage("Sign-in failed.");
    }
  };

  if (error) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p className="mt-4">{error}</p>
        <Link to="/" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-md">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
      <h1 className="text-2xl font-bold text-gray-800">Step 2 of 2: Connect Google</h1>
      <p className="mt-4">{statusMessage}</p>
      {sessionStorage.getItem('kenni_auth_code') && (
        <button
          onClick={handleGoogleSignInAndCombine}
          className="mt-6 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 48 48"><path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20-8.955-20-20-20c0-1.341-.138-2.65-.389-3.917z" fill="#4285F4"></path><path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20-8.955-20-20-20c0-1.341-.138-2.65-.389-3.917z" fill="#34A853"></path><path d="M24 48c11.045 0 20-8.955 20-20a19.957 19.957 0 00-.389-3.917L24 28v-8h18.611c.251 1.267.389 2.576.389 3.917C44 35.045 35.045 44 24 44s-20-8.955-20-20s8.955-20 20-20c3.059 0 5.842 1.154 7.961 3.039L37.618 12.4A19.932 19.932 0 0024 4 12.955 4 4 12.955 4 24s8.955 20 20 20z" fill="#FBBC05"></path><path d="M43.611 20.083H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20-8.955-20-20-20c0-1.341-.138-2.65-.389-3.917z" fill="#EA4335"></path></svg>
          Sign in with Google
        </button>
      )}
    </div>
  );
}

/**
 * The main application layout. It listens for authentication state changes
 * and displays either the welcome screen for a logged-in user or the login page.
 */
function MainLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up a listener that fires whenever the user's auth state changes.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    // Clean up the listener when the component unmounts.
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading user...</p>;
  }
  
  // TODO: Implement a separate, simpler login flow for already registered users.
  return (
    <>
      {user ? (
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {user.displayName}!</h1>
          <p className="mt-2 text-sm text-gray-500">Your User ID (UID) is: {user.uid}</p>
          <button onClick={() => signOut(auth)} className="mt-6 px-6 py-2 bg-red-600 text-white font-semibold rounded-md">Sign Out</button>
        </div>
      ) : (
        <Login />
      )}
    </>
  );
}

/**
 * The root component of the application, which sets up the router.
 */
function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;