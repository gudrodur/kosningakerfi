import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
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
// TODO: Replace with your actual client_id from Kenni.is
const KENNI_IS_CLIENT_ID = 'your-kenni-is-client-id';
const KENNI_IS_REDIRECT_URI = 'http://localhost:3000/auth/callback';
const KENNI_IS_LOGIN_URL = `https://kenni.is/login?client_id=${KENNI_IS_CLIENT_ID}&redirect_uri=${encodeURIComponent(KENNI_IS_REDIRECT_URI)}`;

const CLOUD_FUNCTION_URL = "http://127.0.0.1:5001/kosningakerfi-sosi-2025/europe-west2/createVerifiedUser";
// --- END OF CONFIGURATION ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

if (window.location.hostname === "localhost") {
  console.log("Testing locally, connecting to emulators.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
}

async function callCreateUserFunction(googleToken) {
  // This function remains the same for now
  console.log("Sending Google token to backend function...");
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleToken: googleToken }),
    });
    const responseText = await response.text();
    console.log("Response from backend:", responseText);
    if (!response.ok) throw new Error(`Server responded with ${response.status}: ${responseText}`);
    alert(`Bakendi svarar: ${responseText}`);
  } catch (error) {
    console.error("Error calling createVerifiedUser function:", error);
    alert(`Villa kom upp við að kalla í bakenda: ${error.message}`);
  }
}

/**
 * The login page component
 */
function Login() {
  const handleGoogleSignIn = async () => {
    // This logic remains the same
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Signed in with Google:", user.displayName);
      const idToken = await user.getIdToken();
      await callCreateUserFunction(idToken);
    } catch (error) {
      console.error("Error during Google sign-in:", error.message);
    }
  };

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center text-gray-800">Innskráning</h1>
      <p className="text-center text-gray-600">Veldu innskráningarleið.</p>
      <div className="space-y-4">
        {/* We change this to a link that redirects to Kenni.is */}
        <a
          href={KENNI_IS_LOGIN_URL}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Innskrá með Kenni.is
        </a>
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          {/* Google SVG icon */}
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 48 48">
             <path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#34A853" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FBBC05" d="M24 48c11.045 0 20-8.955 20-20a19.957 19.957 0 0 0-.389-3.917L24 28v-8h18.611c.251 1.267.389 2.576.389 3.917C44 35.045 35.045 44 24 44s-20-8.955-20-20s8.955-20 20-20c3.059 0 5.842 1.154 7.961 3.039L37.618 12.4A19.932 19.932 0 0 0 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20z"></path><path fill="#EA4335" d="M43.611 20.083H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
          </svg>
          Innskrá með Google
        </button>
      </div>
    </div>
  );
}

/**
 * A new component to handle the redirect from Kenni.is
 */
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const authCode = searchParams.get('code'); // Get the 'code' parameter from the URL

  useEffect(() => {
    if (authCode) {
      console.log("Received auth code from Kenni.is:", authCode);
      // NEXT STEP: Send this authCode to our Cloud Function
      // to exchange it for user details.
    }
  }, [authCode]);

  return (
    <div className="text-center p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800">Vinn úr auðkenningu...</h1>
      {authCode ? (
        <div>
          <p className="mt-4">Fékk auðkennislykil frá Kenni.is:</p>
          <p className="mt-2 p-2 bg-gray-100 rounded font-mono break-all">{authCode}</p>
          <p className="mt-4">Næsta skref er að senda þennan lykil á bakenda til staðfestingar.</p>
        </div>
      ) : (
        <p>Enginn auðkennislykill fannst.</p>
      )}
      <Link to="/" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-md">Til baka á forsíðu</Link>
    </div>
  );
}

/**
 * The main application component, now with routing.
 */
function MainLayout() {
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
    return <p className="text-gray-600">Hleð inn notanda...</p>;
  }

  return (
    <>
      {user ? (
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-800">Velkomin(n), {user.displayName}!</h1>
          <button onClick={() => signOut(auth)} className="mt-6 px-6 py-2 bg-red-600 text-white font-semibold rounded-md">Útskrá</button>
        </div>
      ) : (
        <Login />
      )}
    </>
  );
}

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
