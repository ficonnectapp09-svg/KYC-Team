import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiFetch, setAuthToken, removeAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  hasDepartment: (depts: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('connect_backoffice_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch<User>('/auth/me');
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('connect_backoffice_user', JSON.stringify(res.data));
        } else {
          logout();
        }
      } catch (err) {
        console.error('Session hydration failed:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res.success && res.data) {
      setAuthToken(res.data.accessToken);
      setUser(res.data.user);
      localStorage.setItem('connect_backoffice_user', JSON.stringify(res.data.user));
    }
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'overall_lead') return true;
    return roles.includes(user.role);
  };

  const hasDepartment = (depts: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'overall_lead' || user.department === 'Overall') return true;
    return depts.includes(user.department);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole,
        hasDepartment
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

