import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { logRemote } from "../lib/logger";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [fullName, setFullName] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inactivity detection refs
  const inactivityTimerRef = useRef(null);
  const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

  // Lockout parameters
  const LOCKOUT_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set timer if user is authenticated
    if (session) {
      inactivityTimerRef.current = setTimeout(() => {
        handleAutoLogout();
      }, INACTIVITY_LIMIT);
    }
  };

  // Perform automatic logout on inactivity
  const handleAutoLogout = async () => {
    console.log("Auto-logging out due to inactivity");
    await signOut();
    alert("You have been signed out due to 30 minutes of inactivity.");
    window.location.href = "/";
  };

  // Check and update failed login attempts
  const checkLockout = (email) => {
    const attemptsData = localStorage.getItem(`auth_attempts_${email}`);
    if (!attemptsData) return { isLocked: false };

    const { count, lockUntil } = JSON.parse(attemptsData);
    if (lockUntil && Date.now() < lockUntil) {
      const remainingMinutes = Math.ceil((lockUntil - Date.now()) / (60 * 1000));
      return { isLocked: true, remainingMinutes };
    }

    // Lockout expired, reset
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

  // Fetch role from profiles table
  const fetchUserProfile = async (userId) => {
    logRemote(`fetchUserProfile started for userId: ${userId}`, "info");
    try {
      logRemote(`Testing raw fetch to profiles for userId: ${userId}`, "info");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,full_name`;
      const response = await fetch(url, {
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      logRemote(`Raw fetch response status: ${response.status}`, "info");
      const text = await response.text();
      logRemote(`Raw fetch response body: ${text}`, "info");
      
      const parsed = JSON.parse(text);
      if (parsed && parsed.length > 0) {
        logRemote(`fetchUserProfile completed. role: ${parsed[0].role}, name: ${parsed[0].full_name}`, "info");
        return parsed[0];
      }
      
      logRemote("fetchUserProfile completed. Profile not found", "warn");
      return null;
    } catch (e) {
      logRemote(`fetchUserProfile unexpected exception: ${e.message || e}`, "error");
      console.error("Unexpected profile fetch error:", e);
      return null;
    }
  };

  // Sign In implementation
  const signIn = async (email, password) => {
    logRemote(`signIn started for email: ${email}`, "info");
    // 1. Check lockout status
    const lockoutStatus = checkLockout(email);
    if (lockoutStatus.isLocked) {
      logRemote(`signIn aborted: account locked for ${email}`, "warn");
      throw new Error(
        `This account is temporarily locked. Please try again in ${lockoutStatus.remainingMinutes} minutes.`
      );
    }

    // 2. Perform Supabase authentication
    logRemote(`Calling supabase.auth.signInWithPassword for ${email}`, "info");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logRemote(`supabase.auth.signInWithPassword returned error: ${error.message}`, "error");
      // Register failed attempt
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

    logRemote(`supabase.auth.signInWithPassword succeeded for ${email}. user_id: ${data?.user?.id}`, "info");
    // 3. Clear failures on success
    clearFailures(email);
    return data;
  };

  // Sign Out implementation
  const signOut = async () => {
    logRemote("signOut started", "info");
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setFullName(null);
    logRemote("signOut completed", "info");
  };

  // Read Supabase session from localStorage (avoids hanging getSession() call)
  const getSessionFromStorage = () => {
    try {
      const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
      const storageKey = `sb-${ref}-auth-token`;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  // Initialize and track auth states
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      logRemote("initAuth started", "info");
      try {
        // Read session from localStorage instead of supabase.auth.getSession()
        const storedSession = getSessionFromStorage();
        
        if (storedSession?.user) {
          logRemote(`initAuth session found for: ${storedSession.user.email}`, "info");
          setSession(storedSession);
          setUser(storedSession.user);
          
          const profile = await fetchUserProfile(storedSession.user.id);
          if (isMounted && profile) {
            setRole(profile.role);
            setFullName(profile.full_name);
          }
        } else {
          logRemote("initAuth: no session found in localStorage", "info");
        }
      } catch (err) {
        logRemote(`initAuth error: ${err.message || err}`, "error");
        console.error("Error in initAuth:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          logRemote("initAuth completed", "info");
        }
      }
    };

    initAuth();

    // Safety: force loading=false after 5 seconds in case anything hangs
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        logRemote("Safety timeout: forced loading=false after 5s", "warn");
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        logRemote(`onAuthStateChange event: ${event}, session_exists: ${!!newSession}`, "info");
        try {
          if (newSession) {
            // Don't set loading=true here — it causes the dashboard to show 
            // infinite spinner when the profile fetch is slow.
            setSession(newSession);
            setUser(newSession.user);

            const profile = await fetchUserProfile(newSession.user.id);
            if (isMounted && profile) {
              setRole(profile.role);
              setFullName(profile.full_name);
            }
          } else {
            setSession(null);
            setUser(null);
            setRole(null);
            setFullName(null);
          }
        } catch (err) {
          logRemote(`onAuthStateChange error: ${err.message || err}`, "error");
          console.error("Error in onAuthStateChange:", err);
        } finally {
          if (isMounted) {
            setLoading(false);
            logRemote("onAuthStateChange completed", "info");
          }
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Listen for user activity events when session is active
  useEffect(() => {
    if (!session) return;

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    
    // Initialize timer
    resetInactivityTimer();

    // Attach listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      // Remove listeners
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [session]);

  const value = {
    user,
    session,
    role,
    fullName,
    loading,
    signIn,
    signOut,
    checkLockout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
