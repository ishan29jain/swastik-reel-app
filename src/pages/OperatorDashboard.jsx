import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useRole } from "../context/RoleContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const OperatorDashboard = () => {
  const { setRole } = useRole();
  const navigate = useNavigate();

  const [reels, setReels] = useState([]);
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState({});
  const [selectedReel, setSelectedReel] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [completedReels, setCompletedReels] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const operatorId = "operator01";

  const fetchAssignedReels = async () => {
    const q = query(collection(db, "reels"), where("assignedTo", "==", operatorId), where("ruledDate", "==", null));
    const querySnapshot = await getDocs(q);
    const data = [];
    querySnapshot.forEach((docSnap) => {
      const r = docSnap.data();
      if (!r.ruledDate) {
        data.push({ id: docSnap.id, ...r });
      }
    });
    setReels(data);
  };

  const fetchCompletedReels = async () => {
    const q = query(collection(db, "reels"), where("assignedTo", "==", operatorId), where("ruledDate", "!=", null));
    const querySnapshot = await getDocs(q);
    const data = [];
    querySnapshot.forEach((docSnap) => {
      const r = docSnap.data();
      if (r.ruledDate) {
        data.push({ id: docSnap.id, ...r });
      }
    });
    setCompletedReels(data);
  };

  useEffect(() => {
    fetchAssignedReels();
    fetchCompletedReels();
  }, []);

  const handleChange = (e, reelId) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [reelId]: {
        ...prev[reelId],
        [name]: value,
      },
    }));
  };

  const handleEdit = (reel) => {
    setSelectedReel(reel);
    setIsEditMode(true);
    setShowModal(true);
    // Pre-fill form with existing data
    setFormData(prev => ({
      ...prev,
      [reel.id]: {
        outputReams: reel.outputReams || "",
        looseSheets: reel.looseSheets || "",
        outputLength: reel.outputLength || "",
        outputWidth: reel.outputWidth || "",
      }
    }));
  };

  const handleSubmit = async (e, reelId, reel) => {
    e.preventDefault();
    const data = formData[reelId];
    if (!data?.outputReams || !data?.looseSheets || !data?.outputLength || !data?.outputWidth) {
      setMessage("Please fill all fields.");
      return;
    }

    setIsLoading(prev => ({ ...prev, [reelId]: true }));
    setMessage("");

    const length = parseFloat(data.outputLength);
    const width = parseFloat(data.outputWidth);
    const gsm = parseFloat(reel.gsm);
    const reamWeight = parseFloat(((length * width * gsm) / 20000).toFixed(1));

    try {
      const reelRef = doc(db, "reels", reelId);
      await updateDoc(reelRef, {
        outputReams: parseInt(data.outputReams),
        looseSheets: parseInt(data.looseSheets),
        outputLength: length,
        outputWidth: width,
        reamWeight,
        ruledDate: new Date().toISOString(),
      });

      setMessage(isEditMode ? "✅ Output updated for reel " + reel.reelNo : "✅ Output saved for reel " + reel.reelNo);
      await fetchAssignedReels(); // Refresh reels after save
      await fetchCompletedReels(); // Refresh completed reels
      setShowModal(false);
      setSelectedReel(null);
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
      setMessage("❌ Error saving output");
    } finally {
      setIsLoading(prev => ({ ...prev, [reelId]: false }));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    setRole(null);
    window.location.href = "/";
  };

  const markInProgress = async (reelId) => {
    // Set all assigned reels' inProgress to false, then set selected to true
    const q = query(collection(db, "reels"), where("assignedTo", "==", operatorId), where("ruledDate", "==", null));
    const querySnapshot = await getDocs(q);
    const batch = [];
    querySnapshot.forEach((docSnap) => {
      const ref = doc(db, "reels", docSnap.id);
      batch.push(updateDoc(ref, { inProgress: docSnap.id === reelId }));
    });
    await Promise.all(batch);
    fetchAssignedReels();
  };

  // Filter reels based on search term
  const filteredReels = reels.filter(reel => 
    reel.reelNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Operator Dashboard</h1>
            </div>
            <button onClick={handleLogout} className="btn-secondary flex items-center">
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.includes('✅') ? 'bg-green-900/50 border-green-700 text-green-300' : 'bg-red-900/50 border-red-700 text-red-300'
          }`}>
            {message}
          </div>
        )}

        {/* Stock Reels List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Stock Reels</h2>
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by reel number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {filteredReels.length === 0 ? (
            <div className="card-body text-center py-12">
              <div className="h-16 w-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {searchTerm ? 'No matching reels found' : 'No Stock Reels'}
              </h3>
              <p className="text-gray-400">
                {searchTerm ? 'Try a different reel number or clear the search.' : "You don't have any reels assigned to you at the moment."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReels.map((reel) => (
                <div
                  key={reel.id}
                  className={`card cursor-pointer ${reel.inProgress ? 'bg-green-700 border-green-700' : 'hover:border-blue-400'}`}
                >
                  <div className="card-body flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{reel.reelNo}</div>
                      <div className="text-gray-400 text-sm">Size: {reel.size} | GSM: {reel.gsm} | Quality: {reel.quality}</div>
                    </div>
                    {reel.inProgress ? (
                      <button
                        className="btn-primary"
                        onClick={() => { setSelectedReel(reel); setShowModal(true); setIsEditMode(false); }}
                      >
                        Enter Output
                      </button>
                    ) : (
                      <button
                        className="btn-secondary"
                        onClick={() => markInProgress(reel.id)}
                        disabled={reels.some(r => r.inProgress)}
                      >
                        Mark In Progress
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Reels List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Completed Reels</h2>
          {completedReels.length === 0 ? (
            <div className="card-body text-center py-8">
              <p className="text-gray-400">No completed reels yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedReels.map((reel) => (
                <div key={reel.id} className="card bg-gray-800 border-gray-700">
                  <div className="card-body">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-white">{reel.reelNo}</div>
                      <div className="badge-success">Completed</div>
                    </div>
                    <div className="text-gray-400 text-sm mb-3">
                      Size: {reel.size} | GSM: {reel.gsm} | Quality: {reel.quality}
                    </div>
                    <div className="text-gray-300 text-sm mb-3">
                      <div>Reams: {reel.outputReams} | Loose: {reel.looseSheets}</div>
                      <div>Size: {reel.outputLength} × {reel.outputWidth} cm</div>
                    </div>
                    <button
                      className="btn-secondary w-full"
                      onClick={() => handleEdit(reel)}
                    >
                      Edit Output
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal for Reel Details and Output Entry */}
        {showModal && selectedReel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-lg p-6 relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={() => { setShowModal(false); setSelectedReel(null); setIsEditMode(false); }}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-lg font-bold text-white mb-4">
                {isEditMode ? `Edit Reel ${selectedReel.reelNo} Output` : `Reel ${selectedReel.reelNo} Details`}
              </h3>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div><span className="text-gray-400">Mill:</span> <span className="text-white">{selectedReel.mill}</span></div>
                <div><span className="text-gray-400">Size:</span> <span className="text-white">{selectedReel.size}</span></div>
                <div><span className="text-gray-400">GSM:</span> <span className="text-white">{selectedReel.gsm}</span></div>
                <div><span className="text-gray-400">Weight:</span> <span className="text-white">{selectedReel.weight} kg</span></div>
                <div><span className="text-gray-400">Quality:</span> <span className="text-white">{selectedReel.quality}</span></div>
              </div>
              <form onSubmit={(e) => handleSubmit(e, selectedReel.id, selectedReel)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Reams Produced</label>
                    <input
                      name="outputReams"
                      placeholder="Enter reams"
                      type="number"
                      required
                      value={formData[selectedReel.id]?.outputReams || ""}
                      onChange={(e) => handleChange(e, selectedReel.id)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Loose Sheets</label>
                    <input
                      name="looseSheets"
                      placeholder="Enter loose sheets"
                      type="number"
                      required
                      value={formData[selectedReel.id]?.looseSheets || ""}
                      onChange={(e) => handleChange(e, selectedReel.id)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Output Length (cm)</label>
                    <input
                      name="outputLength"
                      placeholder="Enter length"
                      type="number"
                      step="0.1"
                      required
                      value={formData[selectedReel.id]?.outputLength || ""}
                      onChange={(e) => handleChange(e, selectedReel.id)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Output Width (cm)</label>
                    <input
                      name="outputWidth"
                      placeholder="Enter width"
                      type="number"
                      step="0.1"
                      required
                      value={formData[selectedReel.id]?.outputWidth || ""}
                      onChange={(e) => handleChange(e, selectedReel.id)}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isLoading[selectedReel.id]}
                    className="btn-primary flex items-center justify-center"
                  >
                    {isLoading[selectedReel.id] ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {isEditMode ? 'Updating...' : 'Saving...'}
                      </>
                    ) : (
                      isEditMode ? "Update Output" : "Save Output"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorDashboard;