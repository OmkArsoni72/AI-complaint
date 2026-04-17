'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationKey, translations } from './translations';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'PUBLIC' | 'ADMIN' | 'SUPER_ADMIN' | 'OFFICER';
  department: string | null;
  departmentId?: string | null;
  isSubDepartment?: boolean;
  region: string | null;
  phone: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gender?: string;
  dob?: string;
  bio?: string;
}

interface AuthContextType {
  user: UserData | null;
  token: string | null;
  isLoading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  login: (email: string, password: string, requiredRole?: UserData['role']) => Promise<{ ok: boolean; user?: UserData; errorRole?: UserData['role'] }>;
  register: (data: any) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isPublic: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguageState] = useState<Language>('en');

  // Restore session & language on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('grievance_token');
      const savedUser = localStorage.getItem('grievance_user');
      const savedLang = localStorage.getItem('grievance_lang');
      
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
      
      if (savedLang === 'en' || savedLang === 'hi') {
        setLanguageState(savedLang as Language);
      }
    } catch {
      // Corrupt storage — clear it
      localStorage.removeItem('grievance_token');
      localStorage.removeItem('grievance_user');
    }
    setIsLoading(false);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('grievance_lang', lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  const saveSession = (tkn: string, usr: any) => {
    // Normalize user object structure (id vs _id)
    const normalizedUser = {
      ...usr,
      id: usr.id || usr._id
    };
    setToken(tkn);
    setUser(normalizedUser);
    localStorage.setItem('grievance_token', tkn);
    localStorage.setItem('grievance_user', JSON.stringify(normalizedUser));
  };

  const login = async (email: string, password: string, requiredRole?: UserData['role']): Promise<{ ok: boolean; user?: UserData; errorRole?: UserData['role'] }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        const userRole = data.data.user.role as UserData['role'];
        const isSub = Boolean(data.data.user?.isSubDepartment);
        if (requiredRole && userRole !== requiredRole) {
          if (!(requiredRole === 'OFFICER' && userRole === 'ADMIN' && isSub)) {
            localStorage.setItem('grievance_user_auth_error_role', userRole);
            return { ok: false, errorRole: userRole };
          }
        }
        saveSession(data.data.token, data.data.user);
        return { ok: true, user: { ...data.data.user, id: data.data.user.id || data.data.user._id } };
      }
    } catch (err) {
      console.error('Login error:', err);
    }
    return { ok: false };
  };

  const refreshUser = async () => {
    const activeToken = token || localStorage.getItem('grievance_token');
    if (!activeToken) return;

    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (data.success) {
        saveSession(activeToken, data.data);
      }
    } catch (err) {
      console.error('Failed to refresh user data', err);
    }
  };

  const register = async (formData: any): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        saveSession(data.data.token, data.data.user);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Registration failed' };
    } catch (err) {
      return { ok: false, error: 'Cannot connect to server. Is the backend running?' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('grievance_token');
    localStorage.removeItem('grievance_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        language,
        setLanguage,
        t,
        login,
        register,
        logout,
        refreshUser,
        isPublic: user?.role === 'PUBLIC',
        isAdmin: user?.role === 'ADMIN',
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
