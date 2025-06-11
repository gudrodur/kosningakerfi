import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut, signInWithCustomToken,
  connectAuthEmulator, linkWithPopup
} from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDRmne1Qf5pqDpvJm9Q0ZPqrGwACZOv0Zk",
  authDomain: "kosningakerfi-sosi-2025.firebaseapp.com",
  projectId: "kosningakerfi-sosi-2025",
  storageBucket: "kosningakerfi-sosi-2025.appspot.com",
  messagingSenderId: "143792348363",
  appId: "1:143792348363:web:c6f70492197f40e48dcf4e"
};
const KENNI_IS_CLIENT_ID = '@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s';
const KENNI_IS_REDIRECT_URI = 'http://localhost:3000/auth/callback';
const CREATE_USER_FUNCTION_URL_LOCAL = "http://127.0.0.1:5001/kosningakerfi-sosi-2025/europe-west2/create_verified_user";

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app); 

if (window.location.hostname === "localhost") {
  console.log("Testing locally. Connecting to Firebase Emulators.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001); 
}

// --- PKCE HELPERS ---
function base64URLEncode(str) { /* ... same as before ... */ return btoa(String.fromCharCode.apply(null, new Uint8Array(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
async function sha256(buffer) { /* ... same as before ... */ return await window.crypto.subtle.digest('SHA-256', buffer); }
async function generatePkceChallenge() { /* ... same as before ... */ const verifier = base64URLEncode(window.crypto.getRandomValues(new Uint8Array(32))); const hash = await sha256(new TextEncoder().encode(verifier)); const challenge = base64URLEncode(hash); return { verifier, challenge }; }

// --- BACKEND API CALL ---
async function getCustomTokenFromKenni(kenniAuthCode, pkceCodeVerifier) {
  console.log("LOG: Calling backend to verify Kenni.is token and get custom token...");
  try {
    const response = await fetch(CREATE_USER_FUNCTION_URL_LOCAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kenniAuthCode, pkceCodeVerifier }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    if (!data.customToken) { throw new Error("Custom token not found in response."); }
    console.log("LOG: Backend call successful. Received custom token.");
    return data.customToken;
  } catch (error) {
      console.error("Error getting custom token from backend:", error);
      throw error;
  }
}

// --- REACT COMPONENTS ---
// NOTE: AdminDashboard, AuthPage, and UserProfile components remain unchanged from the previous version.
// They are included here so this file is complete.

function AdminDashboard() { /* ... same as before ... */ const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [loading, setLoading] = useState(false); const [feedback, setFeedback] = useState({ message: '', isError: false }); const handleCreateElection = async (e) => { e.preventDefault(); setLoading(true); setFeedback({ message: '', isError: false }); if (!name || !startDate || !endDate) { setFeedback({ message: 'Name, start date, and end date are required.', isError: true }); setLoading(false); return; } try { const createElection = httpsCallable(functions, 'create_election'); const electionData = { name, description, startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString() }; const result = await createElection(electionData); console.log('Election created successfully:', result.data); setFeedback({ message: `Election created! ID: ${result.data.electionId}`, isError: false }); setName(''); setDescription(''); setStartDate(''); setEndDate(''); } catch (error) { console.error('Error creating election:', error); setFeedback({ message: `Error creating election: ${error.message}`, isError: true }); } finally { setLoading(false); } }; return ( <div className="w-full max-w-lg p-8 space-y-4 bg-white rounded-lg shadow-md mx-auto"> <h2 className="text-xl font-bold text-gray-800">Admin Dashboard - Create New Election</h2> <form onSubmit={handleCreateElection} className="space-y-4"> <div><label htmlFor="name" className="block text-sm font-medium text-gray-700">Election Name</label><input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div> <div><label htmlFor="description" className="block text-sm font-medium text-gray-700">Description (Optional)</label><textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></textarea></div> <div className="flex space-x-4"><div className="w-1/2"><label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label><input type="datetime-local" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div><div className="w-1/2"><label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label><input type="datetime-local" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div></div> <button type="submit" disabled={loading} className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">{loading ? 'Creating...' : 'Create Election'}</button> {feedback.message && (<p className={`text-sm ${feedback.isError ? 'text-red-600' : 'text-green-600'}`}>{feedback.message}</p>)} </form> </div> );}
function AuthPage() { /* ... same as before ... */ const navigate = useNavigate(); const handleNewRegistration = async () => { try { const { verifier, challenge } = await generatePkceChallenge(); sessionStorage.setItem('pkce_code_verifier', verifier); const params = new URLSearchParams({ client_id: KENNI_IS_CLIENT_ID, redirect_uri: KENNI_IS_REDIRECT_URI, response_type: 'code', scope: 'openid profile national_id', code_challenge: challenge, code_challenge_method: 'S256', }); window.location.assign(`https://idp.kenni.is/sosi-kosningakerfi.is/oidc/auth?${params.toString()}`); } catch (error) { console.error("Failed to start registration process:", error); alert("Could not prepare secure sign-in."); } }; const handleGoogleSignIn = async () => { const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); navigate('/'); } catch (error) { console.error("Error during Google sign-in:", error); alert(`Google sign-in failed: ${error.message}`); } }; return ( <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md"> <h1 className="text-2xl font-bold text-center text-gray-800">Electronic Voting System</h1> <div className="space-y-4"> <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">Sign In with Google</button> <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or</span></div></div> <button onClick={handleNewRegistration} className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">New Registration with Kenni.is</button> </div> </div> );}
function UserProfile({ user }) { /* ... same as before ... */ const [isAdmin, setIsAdmin] = useState(false); const [checkingAdmin, setCheckingAdmin] = useState(true); useEffect(() => { const checkAdminStatus = async () => { const idTokenResult = await user.getIdTokenResult(true); if (idTokenResult.claims.isAdmin) { setIsAdmin(true); } setCheckingAdmin(false); }; checkAdminStatus(); }, [user]); if (checkingAdmin) { return <p className="text-gray-600">Checking user permissions...</p>; } return ( <div className="w-full p-4 space-y-6"> <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-md"> <h1 className="text-2xl font-bold text-gray-800">Welcome, {user.displayName}!</h1> <p className="mt-2 text-sm text-gray-500">User ID (UID): {user.uid}</p> {isAdmin && <p className="mt-2 text-sm font-bold text-green-600">You are an administrator.</p>} <button onClick={() => signOut(auth)} className="mt-6 px-6 py-2 bg-red-600 text-white font-semibold rounded-md">Sign Out</button> </div> {isAdmin && <div className="mt-8"><AdminDashboard /></div>} </div> );}

/**
 * --- HEAVILY REVISED WITH THE CORRECT LOGIC ---
 * This component now handles the entire registration and linking flow.
 */
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Processing...");

  // This effect runs only once when the component mounts.
  useEffect(() => {
    const runRegistrationFlow = async () => {
      console.log("--- LOG: AuthCallback mounted. Starting flow. ---");
      const kenniAuthCode = searchParams.get('code');
      const pkceCodeVerifier = sessionStorage.getItem('pkce_code_verifier');

      if (!kenniAuthCode || !pkceCodeVerifier) {
        setError("Could not find necessary data from Kenni.is. Please start over.");
        return;
      }

      try {
        // --- Step 1: Get Custom Token ---
        setStatusMessage("Verifying Kenni.is identity...");
        const customToken = await getCustomTokenFromKenni(kenniAuthCode, pkceCodeVerifier);

        // --- Step 2: Sign in with Custom Token ---
        console.log("LOG: Signing in with custom token to establish primary user session...");
        setStatusMessage("Creating primary account...");
        const userCredential = await signInWithCustomToken(auth, customToken);
        const primaryUser = userCredential.user;
        console.log(`LOG: Signed in successfully as primary user: ${primaryUser.uid}`);

        // --- Step 3: Link Google Account ---
        console.log("LOG: Now attempting to link Google account...");
        setStatusMessage("Linking Google account...");
        const provider = new GoogleAuthProvider();
        await linkWithPopup(primaryUser, provider);
        console.log("LOG: Google account linked successfully!");

        // --- Step 4: Cleanup and Navigate ---
        console.log("LOG: Registration complete. Cleaning up and navigating home.");
        sessionStorage.removeItem('pkce_code_verifier');
        sessionStorage.removeItem('kenni_auth_code');
        navigate('/');

      } catch (error) {
        console.error("Error during the registration flow:", error);
        if (error.code === 'auth/credential-already-in-use') {
            setError("This Google account is already linked to a user. Please go back and use 'Sign in with Google'.");
        } else {
            setError(`An unexpected error occurred: ${error.message}`);
        }
        setStatusMessage("Registration failed.");
      }
    };
    
    runRegistrationFlow();
  }, [searchParams, navigate]); // Dependencies for useEffect

  // Render UI based on state
  if (error) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p className="mt-4">{error}</p>
        <Link to="/" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-md">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
      <h1 className="text-2xl font-bold text-gray-800">Completing Registration</h1>
      <p className="mt-4">{statusMessage}</p>
      {/* Show a spinner or loading indicator here */}
    </div>
  );
}

/**
 * The root component of the application.
 */
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (<div className="min-h-screen flex items-center justify-center bg-gray-100"><p className="text-gray-600">Loading user...</p></div>);
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Routes>
          <Route path="/" element={user ? <UserProfile user={user} /> : <AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
