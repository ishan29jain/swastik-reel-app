import { createContext, useContext, useEffect, useState } from "react";

const RoleContext = createContext(null);

export const RoleProvider = ({ children }) => {
  const [role, setRole] = useState(() => {
    return localStorage.getItem("role") || null;
  });

  useEffect(() => {
    if (role) {
      localStorage.setItem("role", role);
    } else {
      localStorage.removeItem("role");
    }
  }, [role]);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used inside RoleProvider");
  return context;
};