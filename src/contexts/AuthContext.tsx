import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';

export type RoleType = 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'ADMISSION_STAFF' | 'STAFF';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: RoleType;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  canAccess: (module: 'dashboard' | 'admissions' | 'students' | 'fees' | 'payments' | 'receipts' | 'reports' | 'staff' | 'settings') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('edumanage_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('edumanage_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await apiClient.get('/auth/me');
          if (res.data?.success && res.data?.data) {
            setUser(res.data.data);
            localStorage.setItem('edumanage_user', JSON.stringify(res.data.data));
          }
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = async ({ username, password }: { username: string; password: string }) => {
    try {
      const res = await apiClient.post('/auth/login', { username, password });
      if (res.data?.success && res.data?.data) {
        const { user: userData, accessToken, refreshToken } = res.data.data;
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('edumanage_token', accessToken);
        localStorage.setItem('edumanage_refresh_token', refreshToken);
        localStorage.setItem('edumanage_user', JSON.stringify(userData));
        return { success: true };
      }
      return { success: false, message: res.data?.message || 'Login failed' };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Login failed'
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('edumanage_token');
    localStorage.removeItem('edumanage_refresh_token');
    localStorage.removeItem('edumanage_user');
  };

  const canAccess = (module: 'dashboard' | 'admissions' | 'students' | 'fees' | 'payments' | 'receipts' | 'reports' | 'staff' | 'settings'): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    switch (module) {
      case 'dashboard':
        return true;
      case 'admissions':
        return ['PRINCIPAL', 'ADMISSION_STAFF'].includes(user.role);
      case 'students':
        return ['PRINCIPAL', 'ADMISSION_STAFF', 'ACCOUNTANT', 'STAFF'].includes(user.role);
      case 'fees':
      case 'payments':
      case 'receipts':
        return ['PRINCIPAL', 'ACCOUNTANT'].includes(user.role);
      case 'reports':
        return ['PRINCIPAL', 'ACCOUNTANT'].includes(user.role);
      case 'staff':
      case 'settings':
        return false; // Only SUPER_ADMIN can access, which is already handled above
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
