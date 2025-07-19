# 📦 Swastik Papers – Digital Reel Tracking System

A smart internal-use platform built for **Swastik Papers** to digitize and streamline reel management. From uploading packing slip PDFs to tracking yield and managing reel status, everything is automated with AI-backed parsing and Firebase-based dashboards.

---

## 🚀 Live Site

🔗 [swastikpapers.online](https://swastikpapers.online)

---

## 🧠 Tech Stack

- **Frontend:** React + Firebase Auth
- **Backend:** Python + LangChain + Groq API
- **Database:** Firebase Firestore
- **Hosting:** Vercel (Frontend), Render (LangChain backend)

---

## 📸 System Snapshots

### 📊 Office Dashboard – Reel Management
![Office Dashboard](/images/office-dashboard.png)

### 🧑 Operator Interface – Output Entry & Yield
![Operator Dashboard](/images/operator-dashboard.png)

### 📈 Yield Analysis & Ruled Reel Export
![Yield Analysis](/images/yield-analysis.png)

> 🔧 More images will be added as system modules evolve.

---

## 🧾 Key Features

### ✅ AI-Powered Reel Upload
- Upload **bulk packing slip PDFs**
- Auto-parses into structured reel entries (ReelNo, Size, GSM, Weight, Mill, Quality)
- Uses **LangChain + Groq LLM** for intelligent extraction
- Prompts for missing or ambiguous entries

### 🧑 Operator Dashboard
- Views assigned reels
- Enters output sheet size and final weight
- Yield % auto-calculated using ream logic

### 🧑‍💼 Office Dashboard
- Create single/bulk reels
- Assign reels to operator
- Add remarks, update status
- Export ruled reels to PDF
- View yield analysis (actual vs expected)

### 🧑‍💼 Manager Dashboard
- View all completed reels
- Assign reels manually
- Cross-check office input

---

## 🔁 Workflow Overview

1. 📥 **PDF Upload** (Packing Slip)
2. 🤖 **LangChain Parser** extracts reel data
3. ✅ **Office Review** (Optional quality prompt)
4. 🔁 **Operator Processes** reel and submits output
5. 📦 **Ruled Reel Finalized** with yield tracking

---

## ⚙️ Local Development

### 🖥️ Frontend

```bash
cd frontend
npm install
npm run dev
