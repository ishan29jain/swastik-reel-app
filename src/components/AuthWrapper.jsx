import { useRole } from "../context/RoleContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const publicRoutes = ["/"];

const AuthWrapper = ({ children }) => {
  const { role } = useRole();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;

    if (publicRoutes.includes(path)) return;

    if (!role) {
      navigate("/");
    } else {
      if (role === "office" && path !== "/office") navigate("/office");
      else if (role === "manager" && path !== "/manager") navigate("/manager");
      else if (role === "operator" && path !== "/operator") navigate("/operator");
    }
  }, [location.pathname, role]);

  return children;
};

export default AuthWrapper;