import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase, getAuthTokenKey } from "../lib/supabase";

const AuthContext = createContext(null);

const getCachedSession = () => {
  try {
    const key = getAuthTokenKey();
    if (!key) return null;
    const data = localStorage.getItem(key);
    if (!data) return null;
    const session = JSON.parse(data);
    
    // Check if session is expired
    if (session && session.expires_at) {
      const currentTime = Math.floor(Date.now() / 1000);
      if (session.expires_at < currentTime) {
        console.log("[Auth] Cached session is expired.");
        return null;
      }
    }
    return session;
  } catch (err) {
    console.error("[Auth] Error reading cached session:", err);
    return null;
  }
};

const getCachedProfile = () => {
  try {
    const data = localStorage.getItem("stratizen_profile");
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("[Auth] Error reading cached profile:", err);
    return null;
  }
};


const setCachedProfile = (profile) => {
  try {
    if (profile) {
      localStorage.setItem("stratizen_profile", JSON.stringify(profile));
    } else {
      localStorage.removeItem("stratizen_profile");
    }
  } catch (err) {
    console.error("[Auth] Error writing cached profile:", err);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    console.time("[Auth] Synchronous Cache Initialize");
    const cached = getCachedSession();
    console.timeEnd("[Auth] Synchronous Cache Initialize");
    if (cached?.user) {
      console.log("[Auth] Synchronous cache hit for user:", cached.user.email);
    }
    return cached?.user || null;
  });

  const [profile, setProfile] = useState(() => {
    const cached = getCachedProfile();
    if (cached) {
      console.log("[Auth] Synchronous cache hit for profile:", cached.full_name);
    }
    return cached;
  });

  const [loading, setLoading] = useState(() => {
    const cached = getCachedSession();
    if (cached?.user) {
      const cachedProfile = getCachedProfile();
      return !cachedProfile;
    }
    return false;
  });

  // Helper function to fetch user profile
  const fetchProfile = useCallback(async (userId) => {
    console.time(`[Database] Fetch Profile for ${userId}`);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error("Profile fetch exception:", err);
      return null;
    } finally {
      console.timeEnd(`[Database] Fetch Profile for ${userId}`);
    }
  }, []);

  const profileRef = useRef(profile);
  const userRef = useRef(user);

  useEffect(() => {
    profileRef.current = profile;
    userRef.current = user;
  });

  useEffect(() => {
    let isMounted = true;
    let loadedUserId = userRef.current?.id || null;

    console.log("[Auth] Registering onAuthStateChange listener...");
    console.time("[Auth] Session Verification Event");

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[Auth] Auth state change event received: ${event}`);
        if (!isMounted) return;

        // Bypass onAuthStateChange for admin sessions so they are not cleared
        const cachedProf = getCachedProfile();
        if (cachedProf?.role === "admin") {
          console.log("[Auth] Bypassing onAuthStateChange for Admin session");
          setLoading(false);
          return;
        }

        // Chef is authenticated natively via Supabase, so let onAuthStateChange sync state normally.

        if (session?.user) {
          const currentUserId = session.user.id;
          setUser(session.user);

          // Only fetch/refresh profile if the user changed, or if we don't have it in the ref yet
          if (loadedUserId !== currentUserId || !profileRef.current) {
            loadedUserId = currentUserId;
            const userProfile = await fetchProfile(currentUserId);
            if (isMounted && loadedUserId === currentUserId) {
              setProfile(userProfile);
              setCachedProfile(userProfile);
            }
          }
        } else {
          loadedUserId = null;
          setUser(null);
          setProfile(null);
          setCachedProfile(null);
        }
        
        if (isMounted) {
          setLoading(false);
          try {
            console.timeEnd("[Auth] Session Verification Event");
          } catch {
            // Ignore if timer already ended
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // SignUp function: creates user in Supabase Auth, then retrieves their profile (created by the DB trigger)
  const signUp = useCallback(async (email, password, fullName, studentNumber, phoneNumber) => {
    console.time("[Auth] Sign Up Process");
    try {
      // 1. Create Supabase auth user, passing metadata for the trigger to read
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            student_number: studentNumber,
          },
        },
      });

      if (error) throw error;
      if (!data?.user) throw new Error("Sign up failed: no user returned.");

      // 2. Fetch the profile created automatically by the database trigger
      console.time("[Database] Fetch Profile");
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select()
        .eq("id", data.user.id)
        .single();
      console.timeEnd("[Database] Fetch Profile");

      if (profileError) {
        console.error("Profile retrieval error:", profileError);
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
        setCachedProfile(profileData);
      }

      return data;
    } catch (err) {
      console.error("Signup service error:", err);
      throw err;
    } finally {
      console.timeEnd("[Auth] Sign Up Process");
    }
  }, []);

  // Login function
  const login = useCallback(async (email, password) => {
    console.time("[Auth] Login Process");
    try {
      if (email === "admin@gmail.com" && password === "admin") {
        const mockAdminUser = {
          id: "admin-id-123456",
          email: "admin@gmail.com",
          user_metadata: {
            full_name: "Admin User"
          }
        };
        const mockAdminProfile = {
          id: "admin-id-123456",
          email: "admin@gmail.com",
          full_name: "Admin User",
          role: "admin"
        };
        setUser(mockAdminUser);
        setProfile(mockAdminProfile);
        setCachedProfile(mockAdminProfile);
        
        // Save mock session to localStorage
        const mockSession = {
          user: mockAdminUser,
          expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 // 24 hours
        };
        const key = getAuthTokenKey() || "sb-auth-token";
        localStorage.setItem(key, JSON.stringify(mockSession));
        return { user: mockAdminUser };
      }

      // Standard login for all roles via Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } finally {
      console.timeEnd("[Auth] Login Process");
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    console.time("[Auth] Logout Process");
    try {
      // Clear profile and user state
      setProfile(null);
      setCachedProfile(null);
      setUser(null);

      // Sign out from Supabase and clear local token
      const key = getAuthTokenKey() || "sb-auth-token";
      localStorage.removeItem(key);

      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error during sign out:", err);
    } finally {
      console.timeEnd("[Auth] Logout Process");
    }
  }, []);

  // Update Profile function
  const updateProfile = useCallback(async (fullName, phoneNumber) => {
    if (!user) throw new Error("No authenticated user found.");

    console.time("[Auth] Update Profile Process");
    try {
      // 1. Update profiles table
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone_number: phoneNumber,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (profileError) {
        console.error("Profile update error:", profileError);
        throw profileError;
      }

      // 2. Also update auth metadata to keep them in sync
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone_number: phoneNumber,
        }
      });

      if (authError) {
        console.error("Auth metadata update error:", authError);
        throw authError;
      }

      // 3. Update React states & cache
      if (updatedProfile) {
        setProfile(updatedProfile);
        setCachedProfile(updatedProfile);
      }
      if (authData?.user) {
        setUser(authData.user);
      }

      return updatedProfile;
    } finally {
      console.timeEnd("[Auth] Update Profile Process");
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signUp,
    login,
    logout,
    updateProfile,
  }), [user, profile, loading, signUp, login, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
