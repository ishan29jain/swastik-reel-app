// ✅ App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import OfficeDashboard from "./pages/OfficeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import OperatorDashboard from "./pages/OperatorDashboard";
import AuthWrapper from "./components/AuthWrapper";
import { RoleProvider } from "./context/RoleContext";

const App = () => {
  return (
    <Router>
      <RoleProvider>
        <AuthWrapper>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/office" element={<OfficeDashboard />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/operator" element={<OperatorDashboard />} />
          </Routes>
        </AuthWrapper>
      </RoleProvider>
    </Router>
  );
};

export default App;