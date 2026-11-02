import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi } from "../services/endpoints";

const AuthContext = createContext();

/** Accepts {user, permissions}, a bare user, role as object/string, permissions as names or objects. */
const normalizeUser = (raw) => {
  if (!raw) return null;
  const user =
    raw.user && typeof raw.user === "object"
      ? { ...raw.user, permissions: raw.permissions ?? raw.user.permissions }
      : raw;

  const role =
    user.role?.name ??
    user.role_name ??
    (typeof user.role === "string" ? user.role : null);
  const source = user.permissions ?? user.role?.permissions ?? [];
  const permissions = (Array.isArray(source) ? source : [])
    .map((p) => (typeof p === "string" ? p : p?.name))
    .filter(Boolean);

  return { ...user, role, permissions };
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem("token")) await authApi.logout();
    } catch {
      // token may already be invalid server-side; we still sign out locally
    } finally {
      clearSession();
    }
  }, [clearSession]);

  /** Store the token, load the profile, then flip the app into the signed-in state. */
  const login = useCallback(
    async (newToken, loginUser) => {
      localStorage.setItem("token", newToken); // interceptor needs it for /profile
      try {
        const profile = await authApi.profile();
        setUser(normalizeUser(profile) || normalizeUser(loginUser));
      } catch (err) {
        if (!loginUser) {
          clearSession();
          throw err;
        }
        setUser(normalizeUser(loginUser));
      }
      setToken(newToken);
    },
    [clearSession],
  );

  const refreshUser = useCallback(async () => {
    const profile = await authApi.profile();
    setUser(normalizeUser(profile));
    return profile;
  }, []);

  // Restore the session on page load
  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (!stored) return;
    authApi
      .profile()
      .then((profile) => {
        setUser(normalizeUser(profile));
        setToken(stored);
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, [clearSession]);

  const value = {
    token,
    user,
    id: user?.id ?? null,
    name: user?.name ?? null,
    role: user?.role ?? null,
    permissions: user?.permissions ?? [],
    can: (name) =>
      user?.role === "Admin" || (user?.permissions ?? []).includes(name),
    login,
    logout,
    refreshUser,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// The hook intentionally shares this context module with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
