import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getAuthToken, setAuthToken } from '../services/api';
import { ensureStudentDeviceRegistered } from '../services/device';
import { User } from '../types/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on launch
  useEffect(() => {
    async function loadUser() {
      try {
        const storedToken = await getAuthToken();
        if (storedToken) {
          setTokenState(storedToken);
          const currentUser = await api.getMe();
          setUser(currentUser);
        }
      } catch (err) {
        console.warn('Failed to restore session:', err);
        await setAuthToken(null);
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const authRes = await api.login(email, password);
      setUser(authRes.user);
      setTokenState(authRes.access_token);

      // If student, check or trigger device registration
      if (authRes.user.role === 'student') {
        ensureStudentDeviceRegistered().catch((err) =>
          console.warn('Device registration check:', err)
        );
      }

      return authRes.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
    }
  };

  const refreshMe = async (): Promise<User | null> => {
    try {
      const u = await api.getMe();
      setUser(u);
      return u;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
