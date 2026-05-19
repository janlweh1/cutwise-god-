import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

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
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }
      return data;
    } catch (e) {
      console.error("Unexpected profile fetch error:", e);
      return null;
    }
  };

  // Sign In implementation
  const signIn = async (email, password) => {
    // 1. Check lockout status
    const lockoutStatus = checkLockout(email);
    if (lockoutStatus.isLocked) {
      throw new Error(
        `This account is temporarily locked. Please try again in ${lockoutStatus.remainingMinutes} minutes.`
      );
    }

    // 2. Perform Supabase authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
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

    // 3. Clear failures on success
    clearFailures(email);
    return data;
  };

  // Sign Out implementation
  const signOut = async () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setFullName(null);
  };

  // Initialize and track auth states
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      
      if (activeSession) {
        setSession(activeSession);
        setUser(activeSession.user);
        
        const profile = await fetchUserProfile(activeSession.user.id);
        if (profile) {
          setRole(profile.role);
          setFullName(profile.full_name);
        }
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);

        if (newSession) {
          const profile = await fetchUserProfile(newSession.user.id);
          if (profile) {
            setRole(profile.role);
            setFullName(profile.full_name);
          }
        } else {
          setRole(null);
          setFullName(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
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
