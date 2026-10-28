import React, { useState, useMemo } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../contexts/AuthContext.js';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isForced?: boolean; // When user has mustChangePassword === true
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  isForced = false
}) => {
  const { user, updateUserAndTokens } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  // Dynamic Rule Validation
  const rules = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword);

    let notUsernameOrEmail = true;
    if (user?.username && user.username.length >= 3 && newPassword.toLowerCase().includes(user.username.toLowerCase())) {
      notUsernameOrEmail = false;
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      if (prefix && prefix.length >= 3 && newPassword.toLowerCase().includes(prefix.toLowerCase())) {
        notUsernameOrEmail = false;
      }
    }

    const notSameAsCurrent = currentPassword ? newPassword !== currentPassword : true;

    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      notUsernameOrEmail,
      notSameAsCurrent
    };
  }, [newPassword, currentPassword, user]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const errors: typeof fieldErrors = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else {
      if (!rules.hasMinLength) {
        errors.newPassword = 'Password must be at least 8 characters long';
      } else if (!rules.hasUpper) {
        errors.newPassword = 'Password must contain at least one uppercase letter';
      } else if (!rules.hasLower) {
        errors.newPassword = 'Password must contain at least one lowercase letter';
      } else if (!rules.hasNumber) {
        errors.newPassword = 'Password must contain at least one number';
      } else if (!rules.hasSpecial) {
        errors.newPassword = 'Password must contain at least one special character';
      } else if (!rules.notUsernameOrEmail) {
        errors.newPassword = 'Password cannot contain your username or email prefix';
      } else if (!rules.notSameAsCurrent) {
        errors.newPassword = 'New password cannot be the same as your current password';
      }
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Password changed successfully!');
        if (res.data.data?.accessToken) {
          updateUserAndTokens(
            res.data.data.accessToken,
            res.data.data.refreshToken,
            { ...res.data.data.user, mustChangePassword: false }
          );
        }
        // Reset form state
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setFieldErrors({});
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to change password');
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.field && data?.message) {
        setFieldErrors(prev => ({ ...prev, [data.field]: data.message }));
      } else if (data?.message) {
        setFieldErrors(prev => ({ ...prev, general: data.message }));
      } else {
        setFieldErrors(prev => ({ ...prev, general: 'An error occurred while changing password.' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      onClick={isForced ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white relative">
          {!isForced && (
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm shadow-inner">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {isForced ? 'Password Update Required' : 'Change Password'}
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                {isForced
                  ? 'Your administrator or policy requires you to change your password before continuing.'
                  : 'Update your account password to keep your profile secure.'}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fieldErrors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <span>{fieldErrors.general}</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors(prev => ({ ...prev, currentPassword: undefined }));
                  }
                }}
                placeholder="Enter current password"
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${
                  fieldErrors.currentPassword ? 'border-red-500 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                } rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.currentPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors.currentPassword}
              </p>
            )}
          </div>

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
                  if (fieldErrors.newPassword) {
                    setFieldErrors(prev => ({ ...prev, newPassword: undefined }));
                  }
                }}
                placeholder="Enter strong new password"
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${
                  fieldErrors.newPassword ? 'border-red-500 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                } rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.newPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors.newPassword}
              </p>
            )}

            {/* Live Strength Meter */}
            {newPassword && (
              <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Password Strength:</span>
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
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors(prev => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                placeholder="Re-type new password"
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${
                  fieldErrors.confirmPassword ? 'border-red-500 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                } rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Live Checklist of Security Rules */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
            <p className="font-semibold text-slate-700 mb-1">Security requirements:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                {rules.hasMinLength ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={rules.hasMinLength ? 'text-emerald-700 font-medium' : ''}>8+ characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.hasUpper ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={rules.hasUpper ? 'text-emerald-700 font-medium' : ''}>1+ Uppercase (A-Z)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.hasLower ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={rules.hasLower ? 'text-emerald-700 font-medium' : ''}>1+ Lowercase (a-z)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.hasNumber ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={rules.hasNumber ? 'text-emerald-700 font-medium' : ''}>1+ Number (0-9)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.hasSpecial ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={rules.hasSpecial ? 'text-emerald-700 font-medium' : ''}>1+ Special char (!@#$)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.notSameAsCurrent && currentPassword && newPassword ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={rules.notSameAsCurrent && currentPassword && newPassword ? 'text-emerald-700 font-medium' : ''}>
                  Different from current
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            {!isForced && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 ${
                isForced ? 'w-full' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
