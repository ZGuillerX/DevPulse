import { useCallback, useEffect, useState } from "react";
import type { User } from "@/types";
import { apiRequest, setAuthToken, clearAuthToken, isAuthenticated } from "@/lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loginWithGithub: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      clearAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email: string, password: string) {
    setError(null);
    try {
      const data = await apiRequest<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuthToken(data.token);
      setUser(data.user);
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }

  async function register(email: string, password: string, name: string) {
    setError(null);
    try {
      const data = await apiRequest<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: { email, password, name },
      });
      setAuthToken(data.token);
      setUser(data.user);
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }

  function logout() {
    clearAuthToken();
    setUser(null);
  }

  function loginWithGithub() {
    window.location.href = "/api/auth/github";
  }

  return { user, loading, error, login, register, logout, loginWithGithub };
}
