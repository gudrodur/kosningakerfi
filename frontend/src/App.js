import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut, signInWithCustomToken,
  connectAuthEmulator, linkWithPopup, updateProfile
} from 'firebase/auth';
// Import connectFirestoreEmulator
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'; 
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import ElectionDashboard from './ElectionDashboard';

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

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'europe-west2');
const db = getFirestore(app); // Get Firestore instance once

if (window.location.hostname === "localhost") {
  console.log("Testing locally. Connecting to Firebase Emulators.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  // --- ADD THIS LINE ---
  connectFirestoreEmulator(db, '127.0.0.1', 8081); 
}

// --- PKCE HELPERS ---
function base64URLEncode(str) { return btoa(String.fromCharCode.apply(null, new Uint8Array(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
async function sha256(buffer) { return await window.crypto.subtle.digest('SHA-256', buffer); }
async function generatePkceChallenge() { const verifier = base64URLEncode(window.crypto.getRandomValues(new Uint8Array(32))); const hash = await sha256(new TextEncoder().encode(verifier)); const challenge = base64URLEncode(hash); return { verifier, challenge }; }

// --- BACKEND API CALLS ---
async function getCustomTokenFromKenni(kenniAuthCode, pkceCodeVerifier) {
  console.log("LOG: Calling backend (create_verified_user) via standard fetch...");
  const functionUrl = "http://127.0.0.1:5001/kosningakerfi-sosi-2025/europe-west2/create_verified_user";
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kenniAuthCode, pkceCodeVerifier }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.customToken) {
      throw new Error("Custom token not found in response.");
    }
    
    console.log("LOG: Backend call successful. Received custom token.");
    return data.customToken;
  } catch (error) {
    console.error("Error getting custom token from backend:", error);
    throw error;
  }
}

async function updateUserProfileWithGoogleInfo(user, googleCredential) {
    const updateUserProfile = httpsCallable(functions, 'update_user_profile');
    await updateUserProfile({
        email: googleCredential.user.email,
        photoURL: googleCredential.user.photoURL
    });

    if (typeof googleCredential.user.photoURL === 'string' && googleCredential.user.photoURL) {
      await updateProfile(user, {
          photoURL: googleCredential.user.photoURL,
      });
    }
}


// --- REACT COMPONENTS ---

function AdminDashboard() { /* ... same as before ... */ const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [loading, setLoading] = useState(false); const [feedback, setFeedback] = useState({ message: '', isError: false }); const handleCreateElection = async (e) => { e.preventDefault(); setLoading(true); setFeedback({ message: '', isError: false }); if (!name || !startDate || !endDate) { setFeedback({ message: 'Name, start date, and end date are required.', isError: true }); setLoading(false); return; } try { const createElection = httpsCallable(functions, 'create_election'); const electionData = { name, description, startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString() }; const result = await createElection(electionData); console.log('Election created successfully:', result.data); setFeedback({ message: `Election created! ID: ${result.data.electionId}`, isError: false }); setName(''); setDescription(''); setStartDate(''); setEndDate(''); } catch (error) { console.error('Error creating election:', error); setFeedback({ message: `Error creating election: ${error.message}`, isError: true }); } finally { setLoading(false); } }; return ( <div className="w-full max-w-lg p-8 space-y-4 bg-white rounded-lg shadow-md mx-auto"> <h2 className="text-xl font-bold text-gray-800">Admin Dashboard - Create New Election</h2> <form onSubmit={handleCreateElection} className="space-y-4"> <div><label htmlFor="name" className="block text-sm font-medium text-gray-700">Election Name</label><input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div> <div><label htmlFor="description" className="block text-sm font-medium text-gray-700">Description (Optional)</label><textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></textarea></div> <div className="flex space-x-4"><div className="w-1/2"><label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label><input type="datetime-local" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div><div className="w-1/2"><label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label><input type="datetime-local" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required /></div></div> <button type="submit" disabled={loading} className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">{loading ? 'Creating...' : 'Create Election'}</button> {feedback.message && (<p className={`text-sm ${feedback.isError ? 'text-red-600' : 'text-green-600'}`}>{feedback.message}</p>)} </form> </div> );}
function AuthPage() { /* ... same as before ... */ const navigate = useNavigate(); const handleNewRegistration = async () => { try { const { verifier, challenge } = await generatePkceChallenge(); sessionStorage.setItem('pkce_code_verifier', verifier); const params = new URLSearchParams({ client_id: KENNI_IS_CLIENT_ID, redirect_uri: KENNI_IS_REDIRECT_URI, response_type: 'code', scope: 'openid profile national_id', code_challenge: challenge, code_challenge_method: 'S256', }); window.location.assign(`https://idp.kenni.is/sosi-kosningakerfi.is/oidc/auth?${params.toString()}`); } catch (error) { console.error("Failed to start registration process:", error); alert("Could not prepare secure sign-in."); } }; const handleGoogleSignIn = async () => { const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); navigate('/'); } catch (error) { console.error("Error during Google sign-in:", error); alert(`Google sign-in failed: ${error.message}`); } }; return ( <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md"> <h1 className="text-2xl font-bold text-center text-gray-800">Electronic Voting System</h1> <div className="space-y-4"> <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">Sign In with Google</button> <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or</span></div></div> <button onClick={handleNewRegistration} className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">New Registration with Kenni.is</button> </div> </div> );}

function UserProfile({ user }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const idTokenResult = await user.getIdTokenResult(true);
      if (idTokenResult.claims.isAdmin) {
        setIsAdmin(true);
      }
      setCheckingAdmin(false);
    };
    checkAdminStatus();
  }, [user]);

  if (checkingAdmin) {
    return <p className="text-gray-600">Checking user permissions...</p>;
  }

  return (
    <div className="w-full p-4 space-y-6">
      <div className="max-w-4xl mx-auto text-center p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 text-left">Welcome, {user.displayName}!</h1>
                <p className="text-sm text-gray-500 text-left">UID: {user.uid}</p>
            </div>
            <button onClick={() => signOut(auth)} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-md">Sign Out</button>
        </div>
      </div>
      
      <div className="mt-8">
        {isAdmin ? <AdminDashboard /> : <ElectionDashboard />}
      </div>
    </div>
  );
}

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Processing Kenni.is verification...");
  const hasRun = useRef(false);

  useEffect(() => {
    const runRegistrationFlow = async () => {
      if (hasRun.current) return;
      hasRun.current = true;

      console.log("--- LOG: AuthCallback mounted. Starting new registration flow. ---");
      const kenniAuthCode = searchParams.get('code');
      const pkceCodeVerifier = sessionStorage.getItem('pkce_code_verifier');

      if (!kenniAuthCode || !pkceCodeVerifier) {
        setError("Could not find necessary data from Kenni.is. Please start over.");
        return;
      }

      try {
        setStatusMessage("Creating user profile from Kenni.is data...");
        const customToken = await getCustomTokenFromKenni(kenniAuthCode, pkceCodeVerifier);

        console.log("LOG: Signing in with custom token to establish primary user session...");
        setStatusMessage("Signing in...");
        const userCredential = await signInWithCustomToken(auth, customToken);
        const primaryUser = userCredential.user;
        console.log(`LOG: Signed in successfully as primary user: ${primaryUser.uid} (${primaryUser.displayName})`);

        console.log("LOG: Now attempting to link Google account for future sign-ins...");
        setStatusMessage("Please link your Google account to complete registration...");
        const provider = new GoogleAuthProvider();
        const googleCredential = await linkWithPopup(primaryUser, provider);
        console.log("LOG: Google account linked successfully!");

        setStatusMessage("Finalizing profile...");
        await updateUserProfileWithGoogleInfo(primaryUser, googleCredential);

        console.log("LOG: Registration complete. Cleaning up and navigating home.");
        sessionStorage.removeItem('pkce_code_verifier');
        navigate('/');

      } catch (error) {
        console.error("Error during the registration flow:", error);
        if (error.code === 'auth/credential-already-in-use') {
          setError("This Google account is already linked to another user. Please go back and use 'Sign in with Google' or use a different Google account.");
        } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          setError("The Google linking window was closed before completing. Please try the registration again from the beginning.");
        } else {
          setError(`An unexpected error occurred: ${error.message}`);
        }
        setStatusMessage("Registration failed.");
      }
    };
    
    runRegistrationFlow();

  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-red-600">Registration Error</h1>
        <p className="mt-4">{error}</p>
        <Link to="/" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-md">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">
      <h1 className="text-2xl font-bold text-gray-800">Completing Registration</h1>
      <p className="mt-4">{statusMessage}</p>
    </div>
  );
}

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
