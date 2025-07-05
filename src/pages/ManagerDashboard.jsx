import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { useRole } from "../context/RoleContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const ManagerDashboard = () => {
  const { setRole } = useRole();
  const navigate = useNavigate();
  const [unassignedReels, setUnassignedReels] = useState([]);
  const [ruledReels, setRuledReels] = useState([]);
  const [operatorReels, setOperatorReels] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState({ size: [], gsm: [], quality: [], mill: [] });

  const [form, setForm] = useState({
    reelNo: "",
    size: "",
    gsm: "",
    quality: "",
    mill: "",
    weight: "",
  });

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);
    
    try {
      await addDoc(collection(db, "reels"), {
        ...form,
        weight: parseFloat(form.weight),
        createdAt: Timestamp.now(),
        assignedTo: "",
        ruledDate: null,
        outputReams: 0,
        looseSheets: 0,
        yieldLoss: null,
        status: "Pending",
      });
      setMessage("✅ Reel saved successfully!");
      setForm({
        reelNo: "",
        size: "",
        gsm: "",
        quality: "",
        mill: "",
        weight: "",
      });
      fetchUnassignedReels();
    } catch (error) {
      console.error("Error adding reel:", error);
      setMessage("❌ Failed to save reel.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnassignedReels = async () => {
    const q = query(collection(db, "reels"), where("assignedTo", "==", ""));
    const querySnapshot = await getDocs(q);
    const reels = [];
    querySnapshot.forEach((doc) => {
      reels.push({ id: doc.id, ...doc.data() });
    });
    setUnassignedReels(reels);
  };

  const assignReel = async (reelId) => {
    const reelRef = doc(db, "reels", reelId);
    await updateDoc(reelRef, {
      assignedTo: "operator01",
      assignedAt: Timestamp.now(),
    });
    setMessage("✅ Reel assigned to operator.");
    fetchUnassignedReels();
    fetchRuledReels();
    fetchOperatorReels();
  };

  const fetchRuledReels = async () => {
    const q = query(collection(db, "reels"), where("ruledDate", "!=", null));
    const querySnapshot = await getDocs(q);
    const data = [];

    querySnapshot.forEach((doc) => {
      const r = doc.data();
      const weight = parseFloat(r.weight);
      const reams = parseInt(r.outputReams);
      const loose = parseInt(r.looseSheets);
      const reamWeight = parseFloat(r.reamWeight || 0);

      if (!reamWeight || isNaN(reamWeight)) return;

      const expectedReams = weight / reamWeight;
      const actualReams = reams + loose / 500;
      const yieldPercent = (actualReams / expectedReams) * 100;
      const yieldLoss = 100 - yieldPercent;

      data.push({
        id: doc.id,
        reelNo: r.reelNo,
        mill: r.mill,
        gsm: r.gsm,
        size: r.size,
        weight,
        reamWeight: reamWeight.toFixed(2),
        expectedReams: expectedReams.toFixed(2),
        actualReams: actualReams.toFixed(2),
        yieldPercent: yieldPercent.toFixed(1),
        yieldLoss: yieldLoss.toFixed(1),
        color: yieldPercent >= 90 ? "success" : yieldPercent >= 85 ? "warning" : "danger",
      });
    });

    setRuledReels(data);
  };

  const fetchOperatorReels = async () => {
    const q = query(collection(db, "reels"), where("assignedTo", "==", "operator01"));
    const snapshot = await getDocs(q);
    const data = [];
    snapshot.forEach((doc) => {
      const reel = doc.data();
      if (!reel.ruledDate) {
        data.push({ id: doc.id, ...reel });
      }
    });
    setOperatorReels(data);
  };

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const col = collection(db, "reelOptions");
      const docs = await getDocs(col);
      const opts = { size: [], gsm: [], quality: [], mill: [] };
      docs.forEach((doc) => {
        opts[doc.id.toLowerCase()] = doc.data().values;
      });
      setDropdownOptions(opts);
    };
    fetchDropdownOptions();
    fetchUnassignedReels();
    fetchRuledReels();
    fetchOperatorReels();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    setRole(null);
    window.location.href = "/";
  };

  // Calculate summary statistics
  const totalReels = unassignedReels.length + operatorReels.length + ruledReels.length;
  const avgYield = ruledReels.length > 0 
    ? (ruledReels.reduce((sum, reel) => sum + parseFloat(reel.yieldPercent), 0) / ruledReels.length).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-yellow-600 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
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

        {/* Add New Reel Form */}
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-white">Add New Reel</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reel No.</label>
                <input
                  name="reelNo"
                  placeholder="Enter reel number"
                  value={form.reelNo}
                  onChange={handleFormChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Size</label>
                <select
                  name="size"
                  value={form.size}
                  onChange={handleFormChange}
                  required
                  className="input-field"
                >
                  <option value="">Select size</option>
                  {dropdownOptions.size.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">GSM</label>
                <select
                  name="gsm"
                  value={form.gsm}
                  onChange={handleFormChange}
                  required
                  className="input-field"
                >
                  <option value="">Select GSM</option>
                  {dropdownOptions.gsm.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Quality</label>
                <select
                  name="quality"
                  value={form.quality}
                  onChange={handleFormChange}
                  required
                  className="input-field"
                >
                  <option value="">Select quality</option>
                  {dropdownOptions.quality.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Mill Name</label>
                <select
                  name="mill"
                  value={form.mill}
                  onChange={handleFormChange}
                  required
                  className="input-field"
                >
                  <option value="">Select mill</option>
                  {dropdownOptions.mill.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Weight (kg)</label>
                <input
                  name="weight"
                  placeholder="Enter weight"
                  type="number"
                  value={form.weight}
                  onChange={handleFormChange}
                  required
                  className="input-field"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save Reel"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Unassigned Reels */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-white">Unassigned Reels</h3>
          </div>
          <div className="card-body">
            {unassignedReels.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No unassigned reels found.</p>
            ) : (
              <div className="grid gap-4">
                {unassignedReels.map((reel) => (
                  <div key={reel.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="font-semibold text-white">{reel.reelNo}</span>
                        <span className="text-gray-300">{reel.size}</span>
                        <span className="text-gray-300">{reel.gsm} GSM</span>
                        <span className="text-gray-300">{reel.weight} kg</span>
                      </div>
                    </div>
                    <button
                      onClick={() => assignReel(reel.id)}
                      className="btn-success flex items-center"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Stock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stock Reels */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-white">Stock Reels</h3>
          </div>
          <div className="card-body">
            {operatorReels.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No reels currently in stock.</p>
            ) : (
              <div className="grid gap-4">
                {operatorReels.map((reel) => (
                  <div key={reel.id} className="flex items-center p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                    <div className="flex items-center space-x-4">
                      <span className="font-semibold text-white">{reel.reelNo}</span>
                      <span className="text-gray-300">{reel.mill}</span>
                      <span className="text-gray-300">{reel.size}</span>
                      <span className="text-gray-300">{reel.gsm} GSM</span>
                      <span className="text-gray-300">{reel.weight} kg</span>
                      <span className="badge-info">In Progress</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ruled Reels Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-white">Completed Reels – Yield Report</h3>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th>Reel No</th>
                    <th>Mill</th>
                    <th>GSM</th>
                    <th>Weight (kg)</th>
                    <th>Ream Weight</th>
                    <th>Expected Reams</th>
                    <th>Actual Reams</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {ruledReels.map((reel) => (
                    <tr key={reel.id} className="table-row">
                      <td className="table-cell font-medium">{reel.reelNo}</td>
                      <td className="table-cell">{reel.mill}</td>
                      <td className="table-cell">{reel.gsm}</td>
                      <td className="table-cell">{reel.weight}</td>
                      <td className="table-cell">{reel.reamWeight}</td>
                      <td className="table-cell">{reel.expectedReams}</td>
                      <td className="table-cell">{reel.actualReams}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;