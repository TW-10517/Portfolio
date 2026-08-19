import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore.js";

export function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
