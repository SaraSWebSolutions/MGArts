import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { FullPageLoader } from "../components/Loaders";

/** Pages only for signed-out visitors (e.g. /login). Signed-in users go to the dashboard. */
export default function PublicRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
