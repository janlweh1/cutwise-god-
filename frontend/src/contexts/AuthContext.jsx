import { createContext, useContext, useState, useEffect, useRef } from "react";
import api, { saveTokens, clearTokens, getAccessToken } from "../lib/api";
import { logRemote } from "../lib/logger";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [fullName, setFullName] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inactivity detection refs
  const inactivityTimerRef = useRef(null);
  const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

  // Lockout parameters
  const LOCKOUT_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

  // ─── Inactivity timer ─────────────────────────────────────────────────────

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        handleAutoLogout();
      }, INACTIVITY_LIMIT);
    }
  };

  const handleAutoLogout = async () => {
    logRemote("Auto-logging out due to inactivity", "warn");
    await signOut();
    alert("You have been signed out due to 30 minutes of inactivity.");
    window.location.href = "/";
  };

  // ─── Lockout helpers ──────────────────────────────────────────────────────

  const checkLockout = (email) => {
    const attemptsData = localStorage.getItem(`auth_attempts_${email}`);
    if (!attemptsData) return { isLocked: false };

    const { count, lockUntil } = JSON.parse(attemptsData);
    if (lockUntil && Date.now() < lockUntil) {
      const remainingMinutes = Math.ceil((lockUntil - Date.now()) / (60 * 1000));
      return { isLocked: true, remainingMinutes };
    }

    if (lockUntil && Date.now() >= lockUntil) {
      localStorage.removeItem(`auth_attempts_${email}`);
    }

    return { isLocked: false };
  };

  const registerFailure = (email) => {
    const attemptsData = localStorage.getItem(`auth_attempts_${email}`);
    let count = 1;
    let lockUntil = null;

    if (attemptsData) {
      const parsed = JSON.parse(attemptsData);
      count = parsed.count + 1;
      if (count >= LOCKOUT_ATTEMPTS) {
        lockUntil = Date.now() + LOCKOUT_TIME;
      }
    }

    localStorage.setItem(
      `auth_attempts_${email}`,
      JSON.stringify({ count, lockUntil })
    );

    return { count, isLocked: count >= LOCKOUT_ATTEMPTS };
  };

  const clearFailures = (email) => {
    localStorage.removeItem(`auth_attempts_${email}`);
  };

  // ─── Auth actions ─────────────────────────────────────────────────────────

  const signIn = async (email, password) => {
    logRemote(`signIn started for email: ${email}`, "info");

    const lockoutStatus = checkLockout(email);
    if (lockoutStatus.isLocked) {
      logRemote(`signIn aborted: account locked for ${email}`, "warn");
      throw new Error(
        `This account is temporarily locked. Please try again in ${lockoutStatus.remainingMinutes} minutes.`
      );
    }

    try {
      logRemote(`Calling /auth/login/ for ${email}`, "info");
      const { data } = await api.post("/auth/login/", { username: email, password });

      // Save tokens
      saveTokens({ access: data.access, refresh: data.refresh });

      // Update state
      setUser({ email, id: data.user_id });
      setRole(data.role);
      setFullName(data.full_name);

      clearFailures(email);
      logRemote(`signIn succeeded. role: ${data.role}`, "info");

      return data;
    } catch (err) {
      logRemote(`signIn failed: ${err.response?.data?.detail || err.message}`, "error");

      const failureStatus = registerFailure(email);
      if (failureStatus.isLocked) {
        throw new Error(
          "Too many failed login attempts. Your account has been locked for 15 minutes."
        );
      } else {
        const remaining = LOCKOUT_ATTEMPTS - failureStatus.count;
        throw new Error(
          `Invalid email or password. You have ${remaining} attempts remaining before account lockout.`
        );
      }
    }
  };

  const signOut = async () => {
    logRemote("signOut started", "info");
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    clearTokens();
    setUser(null);
    setRole(null);
    setFullName(null);
    logRemote("signOut completed", "info");
  };

  // ─── Session restore on app load ──────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      logRemote("initAuth started", "info");
      const token = getAccessToken();

      if (!token) {
        logRemote("initAuth: no token in localStorage", "info");
        if (isMounted) setLoading(false);
        return;
      }

      try {
        logRemote("initAuth: fetching /auth/me/", "info");
        const { data } = await api.get("/auth/me/");
        if (isMounted) {
          setUser({ email: data.email, id: data.id });
          setRole(data.role);
          setFullName(data.full_name);
          logRemote(`initAuth: session restored for ${data.email} (${data.role})`, "info");
        }
      } catch (err) {
        logRemote(`initAuth: failed to restore session — ${err.message}`, "warn");
        clearTokens();
      } finally {
        if (isMounted) {
          setLoading(false);
          logRemote("initAuth completed", "info");
        }
      }
    };

    // Safety: force loading=false after 5 seconds if anything hangs
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        logRemote("Safety timeout: forced loading=false after 5s", "warn");
      }
    }, 5000);

    initAuth();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  // ─── Inactivity listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    resetInactivityTimer();
    activityEvents.forEach((event) => window.addEventListener(event, resetInactivityTimer));

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, resetInactivityTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user]);

  const value = {
    user,
    role,
    fullName,
    loading,
    signIn,
    signOut,
    checkLockout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
