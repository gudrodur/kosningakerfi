import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

function ElectionDashboard() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchElections = async () => {
      try {
        // The emulator connection is now handled in App.js,
        // so we can just get the Firestore instance here.
        const db = getFirestore();
        
        console.log("Fetching elections from Firestore...");
        const querySnapshot = await getDocs(collection(db, "elections"));
        
        const electionsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log("Fetched elections:", electionsList);
        setElections(electionsList);
      } catch (err) {
        console.error("Error fetching elections:", err);
        setError("Could not load elections. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchElections();
  }, []); // Empty dependency array means this runs once on component mount

  if (loading) {
    return <p className="text-center text-gray-600">Loading elections...</p>;
  }

  if (error) {
    return <p className="text-center text-red-600">{error}</p>;
  }

  return (
    <div className="w-full max-w-4xl p-4 mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Elections</h1>
      {elections.length === 0 ? (
        <p className="text-center text-gray-500">No elections found.</p>
      ) : (
        <div className="space-y-4">
          {elections.map(election => (
            <div key={election.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
              <h2 className="text-2xl font-semibold text-indigo-600">{election.name}</h2>
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">{election.description}</p>
              <div className="text-sm text-gray-500 mt-4">
                <span>Starts: {new Date(election.startDate.seconds * 1000).toLocaleString()}</span>
                <span className="mx-2">|</span>
                <span>Ends: {new Date(election.endDate.seconds * 1000).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ElectionDashboard;
