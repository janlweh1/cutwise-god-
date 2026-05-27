import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

export function saveTokens({ access, refresh }) {
  localStorage.setItem("access_token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach access token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — on 401, attempt silent token refresh then retry
let _isRefreshing = false;
let _refreshQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      if (_isRefreshing) {
        // Queue this request until the refresh resolves
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      _isRefreshing = true;

      try {
        const refresh = getRefreshToken();
        if (!refresh) throw new Error("No refresh token available.");

        const { data } = await axios.post(
          `${API_BASE_URL}/auth/token/refresh/`,
          { refresh }
        );

        saveTokens({ access: data.access, refresh: data.refresh || refresh });

        // Flush queued requests
        _refreshQueue.forEach(({ resolve }) => resolve(data.access));
        _refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        _refreshQueue.forEach(({ reject }) => reject(refreshError));
        _refreshQueue = [];
        clearTokens();
        window.location.href = "/";
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
