import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "./api";
import type { Meta, User } from "./types";

const TOKEN_KEY = "nook_token";

type AuthValue = {
  token: string | null;
  user: User | null;
  meta: Meta | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  setSession: (token: string) => Promise<User>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Meta>("/api/meta")
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const refresh = useCallback(async () => {
    const current = localStorage.getItem(TOKEN_KEY);
    if (!current) {
      setUser(null);
      setToken(null);
      return;
    }
    const body = await api<{ user: User }>("/api/auth/me", {}, current);
    setToken(current);
    setUser(body.user);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const setSession = useCallback(async (next: string) => {
    localStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    const body = await api<{ user: User }>("/api/auth/me", {}, next);
    setUser(body.user);
    return body.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const body = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, body.token);
      setToken(body.token);
      setUser(body.user);
      return body.user;
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, meta, loading, login, setSession, refresh, logout }),
    [token, user, meta, loading, login, setSession, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
