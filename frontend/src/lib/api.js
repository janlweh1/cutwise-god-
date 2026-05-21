import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Supabase stores session in localStorage under this key pattern:
// sb-<project-ref>-auth-token
function getSupabaseAccessToken() {
  try {
    // Extract project ref from the Supabase URL (e.g. "hismnmamokyrhaoiozvn")
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    const storageKey = `sb-${ref}-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch (e) {
    console.error("Failed to read Supabase token from localStorage:", e);
    return null;
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach Supabase access token from localStorage
// (avoids calling supabase.auth.getSession() which can hang)
api.interceptors.request.use(
  (config) => {
    const token = getSupabaseAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
