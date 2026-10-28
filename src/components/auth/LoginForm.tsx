import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Loader2,
  HelpCircle,
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface LoginFormProps {
  initialUsername?: string;
  initialPassword?: string;
  loading: boolean;
  errorMessage: string | null;
  onLogin: (credentials: { username: string; password: string; rememberMe?: boolean }) => Promise<void>;
  onForgotPasswordClick: () => void;
  onClearError: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  initialUsername = '',
  initialPassword = '',
  loading,
  errorMessage,
  onLogin,
  onForgotPasswordClick,
  onClearError
}) => {
  const [username, setUsername] = useState(initialUsername || 'superadmin');
  const [password, setPassword] = useState(initialPassword || 'Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Field-level validation errors
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Focus on username input on initial mount
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  // Update credentials when props change (e.g. initial values)
  useEffect(() => {
    if (initialUsername) setUsername(initialUsername);
    if (initialPassword) setPassword(initialPassword);
  }, [initialUsername, initialPassword]);

  // Handle Caps Lock detection
  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCaps = e.getModifierState && e.getModifierState('CapsLock');
    setCapsLockActive(Boolean(isCaps));
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (usernameError) setUsernameError(null);
    if (errorMessage) onClearError();
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError) setPasswordError(null);
    if (errorMessage) onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    let firstInvalidRef: React.RefObject<HTMLInputElement | null> | null = null;

    if (!username.trim()) {
      setUsernameError('Username or email is required');
      hasError = true;
      firstInvalidRef = usernameInputRef;
    } else {
      setUsernameError(null);
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
      if (!firstInvalidRef) firstInvalidRef = passwordInputRef;
    } else {
      setPasswordError(null);
    }

    if (hasError) {
      firstInvalidRef?.current?.focus();
      return;
    }

    await onLogin({
      username: username.trim(),
      password,
      rememberMe
    });
  };

  const selectDemoRole = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setUsernameError(null);
    setPasswordError(null);
    if (errorMessage) onClearError();
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-9 transition-all">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Sign in to continue to the school billing system.
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 animate-in fade-in duration-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Username / Email Field */}
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Username or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                ref={usernameInputRef}
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Enter username or email"
                aria-invalid={Boolean(usernameError)}
                aria-describedby={usernameError ? 'username-error' : undefined}
                className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-hidden min-h-[44px] ${
                  usernameError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                }`}
              />
            </div>
            {usernameError && (
              <p
                id="username-error"
                className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1"
              >
                {usernameError}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Password
              </label>
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors focus-visible:outline-hidden focus-visible:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                ref={passwordInputRef}
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onKeyDown={handlePasswordKeyEvent}
                onKeyUp={handlePasswordKeyEvent}
                placeholder="••••••••"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-hidden min-h-[44px] ${
                  passwordError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-hidden"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Caps Lock Alert */}
            {capsLockActive && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Caps Lock is ON</span>
              </div>
            )}

            {passwordError && (
              <p
                id="password-error"
                className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1"
              >
                {passwordError}
              </p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-600 font-normal">Remember my device</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 min-h-[44px] cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Role Accounts Drawer for Fast Review */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowDemoAccounts(!showDemoAccounts)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>1-Click Demo Accounts</span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showDemoAccounts ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showDemoAccounts && (
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => selectDemoRole('superadmin', 'Admin@123')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-indigo-700">Director</div>
                <div className="text-[10px] text-slate-500">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => selectDemoRole('accountant', 'Admin@123')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-amber-700">Accountant</div>
                <div className="text-[10px] text-slate-500">Fee Billing</div>
              </button>
              <button
                type="button"
                onClick={() => selectDemoRole('principal', 'Admin@123')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-emerald-700">Principal</div>
                <div className="text-[10px] text-slate-500">Ledger & SLC</div>
              </button>
              <button
                type="button"
                onClick={() => selectDemoRole('admission_staff', 'Staff@123')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-sky-700">Admission Staff</div>
                <div className="text-[10px] text-slate-500">Enrollments</div>
              </button>
            </div>
          )}
        </div>

        {/* Card Footer Note */}
        <div className="mt-5 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <HelpCircle className="h-3 w-3" />
            <span>Need help? Contact the school administrator.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
