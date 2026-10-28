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
  mustChangePassword?: boolean;
  tokenVersion?: number;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserAndTokens: (newAccessToken: string, newRefreshToken?: string, updatedUser?: Partial<User>) => void;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  canAccess: (module: 'dashboard' | 'admissions' | 'students' | 'fees' | 'payments' | 'receipts' | 'reports' | 'staff' | 'settings' | 'transport' | 'store' | 'discounts') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('edumanage_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('edumanage_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
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

  useEffect(() => {
    fetchCurrentUser();
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

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const updateUserAndTokens = (newAccessToken: string, newRefreshToken?: string, updatedUser?: Partial<User>) => {
    setToken(newAccessToken);
    localStorage.setItem('edumanage_token', newAccessToken);
    if (newRefreshToken) {
      localStorage.setItem('edumanage_refresh_token', newRefreshToken);
    }
    setUser(prev => {
      const merged = prev ? { ...prev, ...updatedUser } : (updatedUser as User);
      localStorage.setItem('edumanage_user', JSON.stringify(merged));
      return merged;
    });
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(permissionCode);
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return permissionCodes.some(code => hasPermission(code));
  };

  const canAccess = (module: 'dashboard' | 'admissions' | 'students' | 'fees' | 'payments' | 'receipts' | 'reports' | 'staff' | 'settings' | 'transport' | 'store' | 'discounts'): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    switch (module) {
      case 'dashboard':
        return true;
      case 'admissions':
        return hasAnyPermission(['admission.view', 'admission.manage']);
      case 'students':
        return hasPermission('student.view');
      case 'fees':
        return hasAnyPermission(['fee.structure.manage', 'fee.view']);
      case 'payments':
        return hasAnyPermission(['fee.collect', 'fee.view']);
      case 'receipts':
        return hasAnyPermission(['receipt.print', 'receipt.reprint']);
      case 'reports':
        return hasPermission('report.view');
      case 'transport':
        return hasAnyPermission(['transport.manage', 'transport.assign', 'report.view']);
      case 'store':
        return hasAnyPermission(['store.manage', 'store.sell', 'store.return']);
      case 'discounts':
        return hasAnyPermission(['discount.manage', 'discount.assign', 'discount.approve']);
      case 'staff':
        return hasAnyPermission(['user.manage', 'roles.manage']);
      case 'settings':
        return hasAnyPermission(['settings.manage', 'backup.manage']);
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
        updateUserAndTokens,
        hasPermission,
        hasAnyPermission,
        canAccess,
      }}
    >
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
