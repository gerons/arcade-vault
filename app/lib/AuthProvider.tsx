"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AuthUser } from "./data";

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("av_user") || "null"));
    } catch {
      setUser(null);
    }
  }, []);

  const login = (u: AuthUser | null) => {
    setUser(u);
    if (u) localStorage.setItem("av_user", JSON.stringify(u));
    else localStorage.removeItem("av_user");
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("av_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
