import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { SchoolLogo } from '../components/common/SchoolLogo.js';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [userInfo, setUserInfo] = useState<{ fullName?: string; maskedEmail?: string } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setErrorMessage('Missing password reset token. Please request a new password reset link.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await apiClient.post('/auth/verify-reset-token', { token });
        if (res.data?.success && res.data?.valid) {
          setTokenValid(true);
          setUserInfo(res.data.data);
        } else {
          setTokenValid(false);
          setErrorMessage(res.data?.message || 'This reset link is invalid or has expired.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setErrorMessage(
          err.response?.data?.message ||
          'This password reset link is invalid, expired, or has already been used.'
        );
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // Dynamic Rule Validation
  const rules = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword);

    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial
    };
  }, [newPassword]);

  // Password Strength Calculation (0 - 4)
  const strength = useMemo(() => {
    if (!newPassword) return 0;
    let score = 0;
    if (rules.hasMinLength) score++;
    if (rules.hasUpper && rules.hasLower) score++;
    if (rules.hasNumber) score++;
    if (rules.hasSpecial) score++;
    return score;
  }, [newPassword, rules]);

  const strengthMeta = useMemo(() => {
    switch (strength) {
      case 0:
      case 1:
        return { label: 'Weak', color: 'bg-red-500', text: 'text-red-600', width: 'w-1/4' };
      case 2:
        return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600', width: 'w-2/4' };
      case 3:
        return { label: 'Good', color: 'bg-blue-500', text: 'text-blue-600', width: 'w-3/4' };
      case 4:
        return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600', width: 'w-full' };
      default:
        return { label: 'Weak', color: 'bg-gray-300', text: 'text-gray-500', width: 'w-0' };
    }
  }, [strength]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: typeof formErrors = {};
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else {
      if (!rules.hasMinLength) errors.newPassword = 'Minimum 8 characters required';
      else if (!rules.hasUpper) errors.newPassword = 'Must contain an uppercase letter';
      else if (!rules.hasLower) errors.newPassword = 'Must contain a lowercase letter';
      else if (!rules.hasNumber) errors.newPassword = 'Must contain a number';
      else if (!rules.hasSpecial) errors.newPassword = 'Must contain a special symbol';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword
      });

      if (res.data?.success) {
        setResetSuccess(true);
        toast.success('Password successfully reset! Please sign in with your new password.');
      } else {
        toast.error(res.data?.message || 'Failed to reset password');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'An error occurred while resetting your password.';
      setFormErrors({ general: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <SchoolLogo size="xl" className="shadow-lg rounded-2xl bg-white p-2 border border-white/20" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Pragya Bharti Public School</h1>
        <p className="mt-1 text-xs text-blue-200">School ERP & Fee Management Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {verifying ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">Verifying your reset link security...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-xs">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Reset Link Invalid or Expired</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{errorMessage}</p>

              <div className="pt-4 flex flex-col gap-2">
                <Link
                  to="/login?forgot=1"
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
                >
                  Request a New Reset Link
                </Link>
                <Link
                  to="/login"
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : resetSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Password Reset Completed</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your password has been securely updated and all previous device sessions have been invalidated.
              </p>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
                >
                  Proceed to Sign In <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center pb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mb-2 border border-blue-100">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Create New Password</h2>
                {userInfo?.fullName && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    For <span className="font-semibold text-slate-700">{userInfo.fullName}</span> ({userInfo.maskedEmail})
                  </p>
                )}
              </div>

              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  <span>{formErrors.general}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      if (formErrors.newPassword) setFormErrors(prev => ({ ...prev, newPassword: undefined }));
                    }}
                    placeholder="Enter new strong password"
                    className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${
                      formErrors.newPassword ? 'border-red-500 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                    } rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formErrors.newPassword && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{formErrors.newPassword}</p>
                )}

                {/* Strength Meter */}
                {newPassword && (
                  <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Strength:</span>
                      <span className={`font-bold ${strengthMeta.text}`}>{strengthMeta.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${strengthMeta.color} ${strengthMeta.width} transition-all duration-300 rounded-full`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value);
                      if (formErrors.confirmPassword) setFormErrors(prev => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Re-enter password"
                    className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${
                      formErrors.confirmPassword ? 'border-red-500 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                    } rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{formErrors.confirmPassword}</p>
                )}
              </div>

              {/* Security requirements checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">Required rules:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {rules.hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                    <span className={rules.hasMinLength ? 'text-emerald-700 font-medium' : ''}>8+ characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rules.hasUpper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                    <span className={rules.hasUpper ? 'text-emerald-700 font-medium' : ''}>1+ Uppercase (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rules.hasLower ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                    <span className={rules.hasLower ? 'text-emerald-700 font-medium' : ''}>1+ Lowercase (a-z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rules.hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                    <span className={rules.hasNumber ? 'text-emerald-700 font-medium' : ''}>1+ Number (0-9)</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    {rules.hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                    <span className={rules.hasSpecial ? 'text-emerald-700 font-medium' : ''}>1+ Special character (!@#$)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
