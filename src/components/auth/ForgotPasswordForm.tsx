import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/client.js';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const [resetEmail, setResetEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetDispatched, setResetDispatched] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setEmailError('Please enter your registered email address');
      emailInputRef.current?.focus();
      return;
    }

    setSendingReset(true);
    setResetError(null);
    setEmailError(null);

    try {
      const res = await apiClient.post('/auth/forgot-password', {
        email: resetEmail.trim()
      });

      if (res.data?.success) {
        setResetDispatched(true);
        setCooldown(60);
        toast.success(res.data?.message || 'Password reset link sent to your registered email');
      } else {
        const msg = res.data?.message || 'Failed to send reset link.';
        setResetError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to process reset request. Please check email address.';
      setResetError(msg);
      toast.error(msg);
    } finally {
      setSendingReset(false);
    }
  };

  const handleResendLink = async () => {
    if (cooldown > 0 || !resetEmail.trim()) return;

    setSendingReset(true);
    setResetError(null);

    try {
      const res = await apiClient.post('/auth/resend-reset-link', {
        email: resetEmail.trim()
      });

      if (res.data?.success) {
        setCooldown(60);
        toast.success(res.data?.message || 'New password reset link dispatched');
      } else {
        const msg = res.data?.message || 'Failed to resend link';
        setResetError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const remaining = err.response?.data?.remainingSeconds;
      if (remaining) {
        setCooldown(remaining);
      }
      const msg = err.response?.data?.message || 'Unable to resend reset link.';
      setResetError(msg);
      toast.error(msg);
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-9 transition-all">
        {/* Header & Back Button */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onBackToLogin}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Back to Sign In"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Reset Your Password
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
          Enter your registered school email address and we will send you a secure verification link to set a new password. The link is valid for 15 minutes.
        </p>

        {resetError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 animate-in fade-in duration-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{resetError}</div>
          </div>
        )}

        {resetDispatched ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Reset Instructions Dispatched</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                If <strong className="text-slate-900">{resetEmail}</strong> is registered with our school system, you will receive an email shortly with your secure reset link.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleResendLink}
                disabled={cooldown > 0 || sendingReset}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-800 disabled:opacity-50 transition cursor-pointer min-h-[44px]"
              >
                {cooldown > 0 ? (
                  <>
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>Resend link in {cooldown}s</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`h-3.5 w-3.5 ${sendingReset ? 'animate-spin' : ''}`} />
                    <span>Resend Reset Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Registered Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  ref={emailInputRef}
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (emailError) setEmailError(null);
                    if (resetError) setResetError(null);
                  }}
                  placeholder="name@pragyabhartipschool.com"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'reset-email-error' : undefined}
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-hidden min-h-[44px] ${
                    emailError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                  }`}
                />
              </div>
              {emailError && (
                <p id="reset-email-error" className="mt-1 text-[11px] font-medium text-rose-600">
                  {emailError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sendingReset}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 min-h-[44px] cursor-pointer"
            >
              <span>{sendingReset ? 'Sending link...' : 'Send Password Reset Link'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition cursor-pointer"
              >
                Remember your password? Sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
