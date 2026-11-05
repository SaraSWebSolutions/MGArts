import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { FullPageLoader } from "../components/Loaders";

export default function PrivateRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
