// ✅ OfficeDashboard.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useRole } from "../context/RoleContext";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const OfficeDashboard = () => {
  const { setRole } = useRole();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    reelNo: "",
    size: "",
    gsm: "",
    quality: "",
    mill: "",
    weight: "",
  });
  const [message, setMessage] = useState("");
  const [ruledReels, setRuledReels] = useState([]);
  const [unassignedReels, setUnassignedReels] = useState([]);
  const [assignedReels, setAssignedReels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
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
        remarks: "",
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

      fetchRuledReels();
      fetchUnassignedReels();
      fetchAssignedReels();
    } catch (error) {
      console.error("Error adding reel:", error);
      setMessage("❌ Failed to save reel.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRuledReels = async () => {
    const q = query(collection(db, "reels"), where("ruledDate", "!=", null));
    const querySnapshot = await getDocs(q);
    const data = [];

    querySnapshot.forEach((docSnap) => {
      const r = docSnap.data();
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
        id: docSnap.id,
        reelNo: r.reelNo,
        mill: r.mill,
        gsm: r.gsm,
        size: r.size,
        weight,
        ruledDate: r.ruledDate,
        remarks: r.remarks || "",
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

  const fetchUnassignedReels = async () => {
    const q = query(collection(db, "reels"), where("assignedTo", "==", ""));
    const snapshot = await getDocs(q);
    const data = [];
    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });
    setUnassignedReels(data);
  };

  const fetchAssignedReels = async () => {
    const q = query(collection(db, "reels"), where("assignedTo", "==", "operator01"), where("ruledDate", "==", null));
    const snapshot = await getDocs(q);
    const data = [];
    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });
    setAssignedReels(data);
  };

  const handleAssignToOperator = async (reelId) => {
    try {
      const reelRef = doc(db, "reels", reelId);
      await updateDoc(reelRef, { assignedTo: "operator01" });
      setMessage("✅ Assigned to Operator.");
      fetchUnassignedReels();
      fetchAssignedReels();
    } catch (error) {
      console.error("Assignment error:", error);
      setMessage("❌ Failed to assign.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this reel?")) {
      await deleteDoc(doc(db, "reels", id));
      fetchRuledReels();
      setMessage("✅ Reel deleted successfully.");
    }
  };

  const handleRemarkChange = async (id, value) => {
    await updateDoc(doc(db, "reels", id), { remarks: value });
    fetchRuledReels();
  };

  const exportPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text("Ruled Reels Report", 10, 10);

    let y = 20;
    ruledReels.forEach((r, index) => {
      docPDF.text(
        `${index + 1}. Reel: ${r.reelNo}, Yield: ${r.yieldPercent}%, Loss: ${r.yieldLoss}%, Remark: ${r.remarks}`,
        10,
        y
      );
      y += 10;
    });

    docPDF.save("RuledReelsReport.pdf");
  };

  useEffect(() => {
    fetchRuledReels();
    fetchUnassignedReels();
    fetchAssignedReels();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    setRole(null);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Office Dashboard</h1>
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
            <h2 className="text-lg font-semibold text-white">Issue New Reel</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reel No.</label>
                <input
                  name="reelNo"
                  placeholder="Enter reel number"
                  value={form.reelNo}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Size</label>
                <input
                  name="size"
                  placeholder="e.g., 74 cm"
                  value={form.size}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">GSM</label>
                <input
                  name="gsm"
                  placeholder="e.g., 58"
                  value={form.gsm}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Quality</label>
                <input
                  name="quality"
                  placeholder="Enter quality"
                  value={form.quality}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Mill Name</label>
                <input
                  name="mill"
                  placeholder="Enter mill name"
                  value={form.mill}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Weight (kg)</label>
                <input
                  name="weight"
                  placeholder="Enter weight"
                  type="number"
                  value={form.weight}
                  onChange={handleChange}
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
              <p className="text-gray-400 text-center py-8">No unassigned reels available.</p>
            ) : (
              <div className="grid gap-4">
                {unassignedReels.map((reel) => (
                  <div key={reel.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="font-semibold text-white">{reel.reelNo}</span>
                        <span className="text-gray-300">{reel.mill}</span>
                        <span className="text-gray-300">{reel.size}</span>
                        <span className="text-gray-300">{reel.gsm} GSM</span>
                        <span className="text-gray-300">{reel.weight} kg</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssignToOperator(reel.id)}
                      className="btn-success flex items-center"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Assign to Operator
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Reels */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-white">Reels Currently with Operator</h3>
          </div>
          <div className="card-body">
            {assignedReels.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No reels currently assigned to operator.</p>
            ) : (
              <div className="grid gap-4">
                {assignedReels.map((reel) => (
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Ruled Reels – Yield Report</h3>
              <button onClick={exportPDF} className="btn-secondary flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </button>
            </div>
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
                    <th>Yield %</th>
                    <th>Remarks</th>
                    <th>Ruled Date</th>
                    <th>Action</th>
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
                      <td className="table-cell">
                        <span className={`badge-${reel.color}`}>
                          {reel.yieldPercent}%
                        </span>
                      </td>
                      <td className="table-cell">
                        <input
                          type="text"
                          value={reel.remarks}
                          onChange={(e) => handleRemarkChange(reel.id, e.target.value)}
                          placeholder="Add remarks"
                          className="input-field text-sm"
                        />
                      </td>
                      <td className="table-cell text-sm text-gray-400">
                        {new Date(reel.ruledDate.seconds * 1000).toLocaleDateString()}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => handleDelete(reel.id)}
                          className="btn-danger text-sm"
                        >
                          Delete
                        </button>
                      </td>
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

export default OfficeDashboard;