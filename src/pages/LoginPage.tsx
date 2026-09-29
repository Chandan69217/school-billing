import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { SchoolLogo } from '../components/common/SchoolLogo.js';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await login({ username, password });
      if (res.success) {
        navigate('/');
      } else {
        setErrorMessage(res.message || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-8 sm:py-12 px-3.5 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="relative">
            <SchoolLogo className="h-16 w-16 drop-shadow-xl" />
          </div>
        </div>
        <h2 className="mt-3 sm:mt-4 text-center text-xl sm:text-2xl font-black tracking-tight text-white">
          Pragya Bharti Public School
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400 font-medium">
          PBPS · Student Admission & Fee Management System
        </p>
      </div>

      <div className="mt-5 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/90 border border-slate-800 py-6 px-4 sm:py-8 sm:px-10 shadow-2xl rounded-2xl backdrop-blur-xl">
          {errorMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-950/50 border border-rose-800 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email or Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="superadmin"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 sm:py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[42px] sm:min-h-[auto]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 sm:py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[42px] sm:min-h-[auto]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* 1-Click Role Logins for Fast Review */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <span className="block text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider mb-2.5">
              1-Click Instant Demo Logins
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickLogin('superadmin', 'Admin@123')}
                className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-left transition-colors min-h-[44px]"
              >
                <div className="font-bold text-indigo-400">Super Admin</div>
                <div className="text-[10px] text-slate-500">Full Access</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('accountant', 'Admin@123')}
                className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-left transition-colors min-h-[44px]"
              >
                <div className="font-bold text-amber-400">Accountant</div>
                <div className="text-[10px] text-slate-500">Fees & Receipts</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('principal', 'Admin@123')}
                className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-left transition-colors min-h-[44px]"
              >
                <div className="font-bold text-emerald-400">Principal</div>
                <div className="text-[10px] text-slate-500">Reports & Students</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admission_staff', 'Staff@123')}
                className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-left transition-colors min-h-[44px]"
              >
                <div className="font-bold text-sky-400">Admission Staff</div>
                <div className="text-[10px] text-slate-500">Enrollments</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
