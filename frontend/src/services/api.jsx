import axios from "axios";

const api = axios.create({
  // Same value as the Postman {{BASE_URL}} variable (set in .env)
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || "";
    const isLoginCall = requestUrl.includes("/login");

    // Expired / invalid token -> back to the login page.
    // (403 means "not allowed", so it is NOT treated as a logout.)
    if (error.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/* ---------- response helpers (tolerate {data: []}, {data: {data: []}}, plain [] ...) ---------- */

const findArray = (value, depth = 0) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object" || depth > 3) return null;
  if ("data" in value) {
    const found = findArray(value.data, depth + 1);
    if (found) return found;
  }
  for (const key of Object.keys(value)) {
    if (key === "data") continue;
    const found = findArray(value[key], depth + 1);
    if (found) return found;
  }
  return null;
};

export const unwrapList = (body) => findArray(body) || [];

export const unwrapItem = (body) => {
  const obj = body?.data ?? body;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    const only = keys.length === 1 ? obj[keys[0]] : null;
    if (only && typeof only === "object" && !Array.isArray(only)) return only;
  }
  return obj;
};

export const pickToken = (body) =>
  body?.token ??
  body?.access_token ??
  body?.data?.token ??
  body?.data?.access_token ??
  null;

export const pickUser = (body) => body?.user ?? body?.data?.user ?? null;

export const getErrorMessage = (err, fallback = "Something went wrong") => {
  if (!err?.response)
    return err?.message === "Network Error"
      ? "Cannot reach the server"
      : fallback;
  const data = err.response.data;
  const validation = data?.errors && Object.values(data.errors).flat()[0];
  return validation || data?.message || fallback;
};

export default api;
