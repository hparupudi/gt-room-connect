import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, api } from "./api";
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
  // Bumped whenever a newer session is committed, so a slow /api/auth/me from
  // page load cannot log out the account that was just created.
  const epoch = useRef(0);

  useEffect(() => {
    api<Meta>("/api/meta")
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const refresh = useCallback(async () => {
    const generation = epoch.current;
    const current = localStorage.getItem(TOKEN_KEY);
    if (!current) {
      if (epoch.current !== generation) return;
      setUser(null);
      setToken(null);
      return;
    }
    try {
      const body = await api<{ user: User }>("/api/auth/me", {}, current);
      if (epoch.current !== generation || localStorage.getItem(TOKEN_KEY) !== current) return;
      setToken(current);
      setUser(body.user);
    } catch (error) {
      if (epoch.current !== generation || localStorage.getItem(TOKEN_KEY) !== current) return;
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    refresh().finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, 12000);
    return () => window.clearInterval(id);
  }, [token, refresh]);

  const commit = useCallback((next: string, nextUser: User) => {
    epoch.current += 1;
    localStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    setUser(nextUser);
    setLoading(false);
  }, []);

  const setSession = useCallback(
    async (next: string) => {
      const body = await api<{ user: User }>("/api/auth/me", {}, next);
      commit(next, body.user);
      return body.user;
    },
    [commit],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const body = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      commit(body.token, body.user);
      return body.user;
    },
    [commit],
  );

  const logout = useCallback(() => {
    epoch.current += 1;
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
