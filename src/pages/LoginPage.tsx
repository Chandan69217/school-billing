import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { apiClient } from '../api/client.js';
import {
  DEFAULT_BRAND_CONFIG,
  DEFAULT_SCHOOL_LOGO,
  DEFAULT_SCHOOL_BG,
  BrandConfig
} from '../config/logo.js';
import { BrandPanel, CompactBrandHeader } from '../components/auth/BrandPanel.js';
import { LoginForm } from '../components/auth/LoginForm.js';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm.js';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: 'login' | 'forgot'
  const [mode, setMode] = useState<'login' | 'forgot'>(() => {
    return searchParams.get('forgot') === '1' ? 'forgot' : 'login';
  });

  // Authentication & UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic School Branding & Campus Backdrop
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(DEFAULT_BRAND_CONFIG);
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_SCHOOL_LOGO);
  const [bgImageUrl, setBgImageUrl] = useState<string>(DEFAULT_SCHOOL_BG);

  // Load school branding & sync page title + favicon
  useEffect(() => {
    let isMounted = true;

    const fetchBranding = async () => {
      try {
        const res = await apiClient.get('/public/settings');
        if (res.data?.success && res.data.data) {
          const s = res.data.data;
          if (isMounted) {
            setBrandConfig(prev => ({
              ...prev,
              schoolName: s.schoolName || prev.schoolName,
              tagline: s.tagline || prev.tagline,
              motto: s.motto || prev.motto,
              description: s.description || prev.description
            }));
            if (s.logoUrl) {
              setLogoUrl(s.logoUrl);
            }
            if (s.bgImageUrl || s.coverImageUrl) {
              setBgImageUrl(s.bgImageUrl || s.coverImageUrl);
            }
          }
        }
      } catch {
        // Graceful fallback to DEFAULT_BRAND_CONFIG and DEFAULT_SCHOOL_BG
      }
    };

    fetchBranding();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update document title dynamically
  useEffect(() => {
    document.title = `Login | ${brandConfig.schoolName}`;
  }, [brandConfig.schoolName]);

  const handleLogin = async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await login({
        username: credentials.username,
        password: credentials.password
      });

      if (res.success) {
        if (credentials.rememberMe) {
          localStorage.setItem('pbps_remembered_username', credentials.username);
        } else {
          localStorage.removeItem('pbps_remembered_username');
        }
        navigate('/');
      } else {
        setErrorMessage(res.message || 'Invalid username or password. Please try again.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please verify your credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Left Split-Screen Panel: Brand Showcase (Desktop >= 1024px) */}
      <BrandPanel config={brandConfig} logoUrl={logoUrl} bgImageUrl={bgImageUrl} />

      {/* Right Split-Screen Panel: Login / Forgot Password Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 py-8 sm:py-12 lg:py-16 relative bg-gradient-to-b from-slate-50 via-white to-slate-50">
        {/* Subtle decorative background accents */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-50/60 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile/Tablet Compact Brand Header */}
          <CompactBrandHeader config={brandConfig} logoUrl={logoUrl} />

          {/* Form Card */}
          {mode === 'login' ? (
            <LoginForm
              initialUsername={localStorage.getItem('pbps_remembered_username') || 'superadmin'}
              initialPassword="Admin@123"
              loading={loading}
              errorMessage={errorMessage}
              onLogin={handleLogin}
              onForgotPasswordClick={() => {
                setMode('forgot');
                setErrorMessage(null);
              }}
              onClearError={() => setErrorMessage(null)}
            />
          ) : (
            <ForgotPasswordForm
              onBackToLogin={() => {
                setMode('login');
                setErrorMessage(null);
              }}
            />
          )}

          {/* Mobile/Tablet Feature Highlights (Below Card) */}
          <div className="lg:hidden mt-8 pt-6 border-t border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-700 text-center uppercase tracking-wider mb-3">
              School Billing & Accounting Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {brandConfig.features.slice(0, 2).map(feature => (
                <div
                  key={feature.id}
                  className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs text-left"
                >
                  <span className="text-xs font-semibold text-slate-800 block">
                    {feature.title}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                    {feature.description}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-4">
              © {new Date().getFullYear()} {brandConfig.schoolName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
