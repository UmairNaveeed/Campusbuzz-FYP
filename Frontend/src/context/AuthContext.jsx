import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { clearProfileCache } from "../utils/profileCache";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const previousUserRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const previousUser = previousUserRef.current;

      // Check if session started (user logged in)
      if (currentUser && !previousUser) {
        console.log("✅ Session STARTED - User logged in:", {
          userId: currentUser.uid,
          email: currentUser.email,
          timestamp: new Date().toISOString()
        });
      }

      // Check if session ended (user logged out)
      if (!currentUser && previousUser) {
        console.log("❌ Session ENDED - User logged out:", {
          userId: previousUser.uid,
          email: previousUser.email,
          timestamp: new Date().toISOString()
        });
      }

      // Update previous user reference
      previousUserRef.current = currentUser;
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Firebase signOut error:', err);
    } finally {
      setUser(null);
      previousUserRef.current = null;
      localStorage.removeItem('user');
      localStorage.removeItem('admin');
      clearProfileCache();
      sessionStorage.clear();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
