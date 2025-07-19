// ✅ OfficeDashboard.jsx
import { useState, useEffect, useRef } from "react";
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
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useRole } from "../context/RoleContext";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const OfficeDashboard = () => {
  const { setRole } = useRole();

  const [form, setForm] = useState({
    reelNo: "",
    size: "",
    gsm: "",
    quality: "",
    mill: "",
    weight: "",
  });
  const [message, setMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeout = useRef(null);
  const [ruledReels, setRuledReels] = useState([]);
  const [unassignedReels, setUnassignedReels] = useState([]);
  const [assignedReels, setAssignedReels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState({ size: [], gsm: [], quality: [], mill: [] });
  const [activeTab, setActiveTab] = useState("bulk");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState("");
  const [bulkData, setBulkData] = useState([]);
  const [importReady, setImportReady] = useState(false);
  const [selectedUnassigned, setSelectedUnassigned] = useState([]);
  const [selectedStock, setSelectedStock] = useState([]);
  const [selectedRuled, setSelectedRuled] = useState([]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const reelNo = form.reelNo;
      const docRef = doc(db, "reels", reelNo);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        setMessage(`❌ Reel No. ${reelNo} already exists!`);
        setShowPopup(true);
        setIsLoading(false);
        return;
      }
      await setDoc(docRef, {
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
      setShowPopup(true);
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
    } catch (err) {
      console.error("Error adding reel:", err);
      setMessage("❌ Failed to save reel.");
      setShowPopup(true);
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
        quality: r.quality || "",
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
      setShowPopup(true);
      fetchUnassignedReels();
      fetchAssignedReels();
    } catch (error) {
      console.error("Assignment error:", error);
      setMessage("❌ Failed to assign.");
      setShowPopup(true);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "reels", id));
    fetchRuledReels();
    fetchUnassignedReels();
    setMessage("✅ Reel deleted successfully.");
    setShowPopup(true);
  };

  const handleRemarkChange = async (id, value) => {
    await updateDoc(doc(db, "reels", id), { remarks: value });
    fetchRuledReels();
    setShowPopup(true);
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
    fetchRuledReels();
    fetchUnassignedReels();
    fetchAssignedReels();
  }, []);

  const handleAddNewOption = async (type) => {
    const newValue = prompt(`Enter new ${type}`);
    if (!newValue) return;
    const docRef = doc(db, "reelOptions", type);
    const current = dropdownOptions[type] || [];
    if (current.includes(newValue)) return alert("Already exists!");
    const updated = [...current, newValue];
    await setDoc(docRef, { values: updated });
    setDropdownOptions((prev) => ({ ...prev, [type]: updated }));
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    setRole(null);
    window.location.href = "/";
  };

  const handleBulkFileChange = async (e) => {
    const file = e.target.files[0];
    setBulkFile(file);
    setBulkPreview("");
    setBulkData([]);
    setImportReady(false);

    if (!file) return;

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      // Send to backend
      const formData = new FormData();
      formData.append("file", file);
      setIsLoading(true);
      try {
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.result) {
          setBulkData(data.result);
          setBulkPreview(JSON.stringify(data.result, null, 2));
          setImportReady(true);
        } else {
          setMessage("❌ PDF parsing failed.");
          setShowPopup(true);
        }
      } catch (err) {
        setMessage("❌ PDF parsing error.");
        setShowPopup(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Existing CSV/TSV logic...
    }
  };

  // Add manual mapping objects
  const millNameMap = {
    "NICER PAPER MILLS": "Nicer",
    "NICER": "Nicer",
    "Shreyans": "Shreyans",
    "Fibermarx": "Fibermarx",
    // Add more as needed
  };

  const qualityMap = {
    "D.T": "D.T.",
    "DT": "D.T.",
    "Dazzle": "Dazzle",
    // Add more as needed
  };

  const handleBulkImport = async () => {
    if (!bulkData.length) return;
    setIsLoading(true);
    setMessage("");
    let duplicateReels = [];
    try {
      for (const row of bulkData) {
        // Map fields using manual mapping
        const mappedRow = {
          reelNo: row.ReelNo || row.reelNo || "",
          gsm: row.GSM || row.gsm || "",
          size: row.Width || row.size || "",
          mill: millNameMap[row.Mill?.trim()] || row.Mill || row.mill || "",
          quality: qualityMap[row.ItemDescription?.trim()] || row.ItemDescription || row.quality || "",
          weight: parseFloat(row.Weight || row.weight || 0),
          createdAt: Timestamp.now(),
          assignedTo: "",
          ruledDate: null,
          outputReams: 0,
          looseSheets: 0,
          yieldLoss: null,
          status: "Pending",
          remarks: "",
        };
        const reelNo = mappedRow.reelNo;
        const docRef = doc(db, "reels", reelNo);
        const existing = await getDoc(docRef);
        if (existing.exists()) {
          duplicateReels.push(reelNo);
          continue;
        }
        await setDoc(docRef, mappedRow);
      }
      if (duplicateReels.length > 0) {
        setMessage(`⚠️ Duplicates skipped: ${duplicateReels.join(", ")}`);
        setShowPopup(true);
      } else {
        setMessage("✅ Bulk import successful!");
        setShowPopup(true);
      }
      setBulkFile(null);
      setBulkPreview("");
      setBulkData([]);
      setImportReady(false);
      fetchRuledReels();
      fetchUnassignedReels();
      fetchAssignedReels();
    } catch (error) {
      setMessage("❌ Bulk import failed.");
      setShowPopup(true);
    } finally {
      setIsLoading(false);
    }
  };

  function formatDate(dateObj) {
    if (!dateObj) return "-";
    try {
      if (typeof dateObj === "string") {
        const d = new Date(dateObj);
        if (!isNaN(d)) return d.toLocaleDateString();
      }
      if (dateObj.seconds) {
        const d = new Date(dateObj.seconds * 1000);
        if (!isNaN(d)) return d.toLocaleDateString();
      }
      return "-";
    } catch {
      return "-";
    }
  }

  const handleDeleteStock = async (id) => {
    if (window.confirm("Are you sure you want to delete this stock reel?")) {
      await deleteDoc(doc(db, "reels", id));
      fetchAssignedReels();
      setMessage("✅ Stock reel deleted successfully.");
      setShowPopup(true);
    }
  };

  useEffect(() => {
    if (showPopup) {
      if (popupTimeout.current) clearTimeout(popupTimeout.current);
      popupTimeout.current = setTimeout(() => setShowPopup(false), 2500);
    }
    return () => { if (popupTimeout.current) clearTimeout(popupTimeout.current); };
  }, [showPopup]);

  // Bulk delete handlers
  const handleBulkDeleteUnassigned = async () => {
    for (const id of selectedUnassigned) {
      await deleteDoc(doc(db, "reels", id));
    }
    setSelectedUnassigned([]);
    fetchUnassignedReels();
    fetchRuledReels();
    setMessage("✅ Selected unassigned reels deleted.");
    setShowPopup(true);
  };
  const handleBulkDeleteStock = async () => {
    for (const id of selectedStock) {
      await deleteDoc(doc(db, "reels", id));
    }
    setSelectedStock([]);
    fetchAssignedReels();
    fetchRuledReels();
    setMessage("✅ Selected stock reels deleted.");
    setShowPopup(true);
  };

  const handleBulkDeleteRuled = async () => {
    for (const id of selectedRuled) {
      await deleteDoc(doc(db, "reels", id));
    }
    setSelectedRuled([]);
    fetchRuledReels();
    setMessage("✅ Selected ruled reels deleted.");
    setShowPopup(true);
  };

  const sortedAssignedReels = [...assignedReels].sort((a, b) => {
    if (a.inProgress === b.inProgress) return 0;
    return a.inProgress ? -1 : 1;
  });

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
        {showPopup && message && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg shadow-lg border transition-all duration-300 ${message.includes('✅') ? 'bg-green-900/90 border-green-700 text-green-300' : 'bg-red-900/90 border-red-700 text-red-300'}`}
            style={{ minWidth: '320px', maxWidth: '90vw', textAlign: 'center' }}>
            {message}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">Total Reels</p>
                  <p className="text-2xl font-bold text-white">{unassignedReels.length + assignedReels.length + ruledReels.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-yellow-900 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">In Progress</p>
                  <p className="text-2xl font-bold text-white">{assignedReels.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">Avg Yield</p>
                  <p className="text-2xl font-bold text-white">{ruledReels.length > 0 ? (ruledReels.reduce((sum, reel) => sum + parseFloat(reel.yieldPercent), 0) / ruledReels.length).toFixed(1) : 0}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for Bulk Upload / Single Entry */}
        <div className="card mb-8">
          <div className="flex border-b border-gray-700">
            <button
              className={`px-6 py-2 font-semibold ${activeTab === "bulk" ? "bg-gray-800 text-blue-400" : "text-gray-400"}`}
              onClick={() => setActiveTab("bulk")}
            >
              Bulk Upload
            </button>
            <button
              className={`px-6 py-2 font-semibold ${activeTab === "single" ? "bg-gray-800 text-blue-400" : "text-gray-400"}`}
              onClick={() => setActiveTab("single")}
            >
              Single Entry
            </button>
          </div>
          <div className="card-body">
            {activeTab === "bulk" && (
              <div>
                <div className="flex gap-2 mb-4 items-center">
                  <label className="relative block w-1/2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      id="bulk-upload-input"
                      onChange={handleBulkFileChange}
                    />
                    <span className="w-full flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 cursor-pointer hover:bg-gray-700 transition">
                      <svg className="h-5 w-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10V6a5 5 0 0110 0v4M12 16v-4m0 0l-2 2m2-2l2 2" /></svg>
                      {bulkFile ? bulkFile.name : "Select File"}
                    </span>
                  </label>
                  <button
                    className="btn-primary"
                    onClick={handleBulkImport}
                    disabled={!importReady || isLoading}
                  >
                    Confirm Import
                  </button>
                </div>
                {bulkPreview && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Preview Read Data</label>
                    <textarea
                      className="input-field w-full h-32 bg-gray-800 text-gray-200"
                      value={bulkPreview}
                      readOnly
                    />
                  </div>
                )}
              </div>
            )}
            {activeTab === "single" && (
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
                  <div className="flex gap-2">
                    <select
                      name="size"
                      value={form.size}
                      onChange={handleChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select size</option>
                      {dropdownOptions.size.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => handleAddNewOption('size')}>Add New</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">GSM</label>
                  <div className="flex gap-2">
                    <select
                      name="gsm"
                      value={form.gsm}
                      onChange={handleChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select GSM</option>
                      {dropdownOptions.gsm.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => handleAddNewOption('gsm')}>Add New</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Quality</label>
                  <div className="flex gap-2">
                    <select
                      name="quality"
                      value={form.quality}
                      onChange={handleChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select quality</option>
                      {dropdownOptions.quality.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => handleAddNewOption('quality')}>Add New</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Mill Name</label>
                  <div className="flex gap-2">
                    <select
                      name="mill"
                      value={form.mill}
                      onChange={handleChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select mill</option>
                      {dropdownOptions.mill.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => handleAddNewOption('mill')}>Add New</button>
                  </div>
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
            )}
          </div>
        </div>

        {/* Unassigned and Stock Reels side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Unassigned Reels */}
          <div className="card h-full flex flex-col">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Unassigned Reels</h3>
              <button
                className={`text-sm px-4 py-2 rounded transition ${
                  selectedUnassigned.length === 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'btn-danger'
                }`}
                onClick={handleBulkDeleteUnassigned}
              >
                Delete Selected
              </button>
            </div>
            <div className="card-body flex-1">
              {unassignedReels.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No unassigned reels available.</p>
              ) : (
                <div className="grid gap-4 overflow-y-auto" style={{ maxHeight: '350px' }}>
                  {unassignedReels.map((reel, idx) => (
                    <div
                      key={reel.id}
                      className={`flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700 shadow w-full${idx < unassignedReels.length - 1 ? ' mb-4' : ''}`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedUnassigned.includes(reel.id)}
                          onChange={e => {
                            setSelectedUnassigned(sel =>
                              e.target.checked
                                ? [...sel, reel.id]
                                : sel.filter(id => id !== reel.id)
                            );
                          }}
                          className="h-5 w-5 accent-blue-600 rounded mr-3"
                        />
                        <span className="font-semibold text-white mr-4">{reel.reelNo}</span>
                        <span className="text-gray-300">{reel.mill} {reel.quality ? `/${reel.quality}` : ""}</span>
                        <span className="text-gray-300 ml-4">{reel.size}</span>
                        <span className="text-gray-300 ml-4">{reel.gsm} GSM</span>
                        <span className="text-gray-300 ml-4">{reel.weight} kg</span>
                      </div>
                      <button
                        onClick={() => handleAssignToOperator(reel.id)}
                        className="btn-success ml-4 flex items-center"
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
          <div className="card h-full flex flex-col">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Stock Reels</h3>
              <button
                className={`text-sm px-4 py-2 rounded transition ${
                  selectedStock.length === 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'btn-danger'
                }`}
                onClick={handleBulkDeleteStock}
              >
                Delete Selected
              </button>
            </div>
            <div className="card-body flex-1">
              {sortedAssignedReels.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No reels currently in stock.</p>
              ) : (
                <div className="grid gap-4 overflow-y-auto" style={{ maxHeight: '350px' }}>
                  {sortedAssignedReels.map((reel) => (
                    <div
                      key={reel.id}
                      className={`flex items-center p-4 bg-blue-900/30 rounded-lg shadow justify-between w-full transition ${reel.inProgress ? 'border-2 border-green-500' : 'border border-blue-700'}`}
                    >
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedStock.includes(reel.id)}
                          onChange={e => {
                            setSelectedStock(sel =>
                              e.target.checked
                                ? [...sel, reel.id]
                                : sel.filter(id => id !== reel.id)
                            );
                          }}
                          className="h-5 w-5 accent-blue-600 rounded focus:ring-2 focus:ring-blue-400 transition mr-2"
                        />
                        <span className="font-semibold text-white">{reel.reelNo}</span>
                        <span className="text-gray-300">{reel.mill} {reel.quality ? `/${reel.quality}` : ""}</span>
                        <span className="text-gray-300">{reel.size}</span>
                        <span className="text-gray-300">{reel.gsm} GSM</span>
                        <span className="text-gray-300">{reel.weight} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ruled Reels Table */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Ruled Reels – Yield Report</h3>
              <div className="flex gap-4 items-center">
                <button onClick={exportPDF} className="btn-secondary flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </button>
                <button
                  className={`text-sm px-4 py-2 rounded transition ${
                    selectedRuled.length === 0
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'btn-danger'
                  }`}
                  onClick={handleBulkDeleteRuled}
                >
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th>SELECT</th>
                    <th>REEL NO</th>
                    <th>MILL</th>
                    <th>GSM</th>
                    <th>WEIGHT (KG)</th>
                    <th>REAM WEIGHT</th>
                    <th>EXPECTED REAMS</th>
                    <th>ACTUAL REAMS</th>
                    <th>YIELD %</th>
                    <th>PROFIT</th>
                    <th>REMARKS</th>
                    <th>RULED DATE</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {ruledReels.length === 0 ? (
                    <tr><td colSpan={11} className="text-center text-gray-400 py-8">No ruled reels available.</td></tr>
                  ) : (
                    ruledReels.map((reel) => (
                      <tr key={reel.id} className="table-row">
                        <td className="table-cell">
                          <input
                            type="checkbox"
                            checked={selectedRuled.includes(reel.id)}
                            onChange={e => {
                              setSelectedRuled(sel =>
                                e.target.checked
                                  ? [...sel, reel.id]
                                  : sel.filter(id => id !== reel.id)
                              );
                            }}
                            className="h-5 w-5 accent-blue-600 rounded focus:ring-2 focus:ring-blue-400 transition mr-2"
                          />
                        </td>
                        <td className="table-cell font-medium">{reel.reelNo}</td>
                        <td className="table-cell">{reel.mill} {reel.quality ? `/${reel.quality}` : ""}</td>
                        <td className="table-cell">{reel.gsm} GSM</td>
                        <td className="table-cell">{reel.weight}</td>
                        <td className="table-cell">{reel.reamWeight}</td>
                        <td className="table-cell">{reel.expectedReams}</td>
                        <td className="table-cell">{reel.actualReams}</td>
                        <td className="table-cell">
                          <span className={`badge-${reel.color}`}>{reel.yieldPercent}%</span>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm text-gray-400">{parseFloat(reel.yieldLoss) * -1}%</span>
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
                        <td className="table-cell text-sm text-gray-400">{formatDate(reel.ruledDate)}</td>
                      </tr>
                    ))
                  )}
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