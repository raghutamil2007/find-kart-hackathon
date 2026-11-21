import React, { useState } from 'react';
import { STITCH_IMAGES } from '../data/catalog.ts';
import type { CartItem, DeliveryLocation, Order, UserProfile } from '../types/findkart.ts';
import { ProductImage } from './ProductImage.tsx';

interface AuthSuccessPayload {
  token: string;
  user: UserProfile & {
    cart: CartItem[];
    wishlist: string[];
    orders: Order[];
    location: DeliveryLocation;
  };
}

interface AuthViewProps {
  guestCart: CartItem[];
  guestWishlist: string[];
  onAuthSuccess: (payload: AuthSuccessPayload) => void;
  onBackToStore: () => void;
}

export function AuthView({
  guestCart,
  guestWishlist,
  onAuthSuccess,
  onBackToStore,
}: AuthViewProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [alertState, setAlertState] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Sign In fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRemember, setLoginRemember] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regErrors, setRegErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [regSubmitting, setRegSubmitting] = useState(false);

  const switchMode = (nextMode: 'signin' | 'register') => {
    setMode(nextMode);
    setAlertState(null);
    setLoginErrors({});
    setRegErrors({});
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertState(null);
    const errors: { email?: string; password?: string } = {};
    const emailTrimmed = loginEmail.trim();

    if (!isValidEmail(emailTrimmed)) {
      errors.email = 'Enter a valid email address';
    }
    if (!loginPassword || loginPassword.length < 6) {
      errors.password = 'Enter your password (minimum 6 characters)';
    }
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoginSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'FindKart',
        },
        body: JSON.stringify({
          email: emailTrimmed,
          password: loginPassword,
          remember: loginRemember,
          guestCart,
          guestWishlist,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to sign in. Please check your credentials.');
      }
      setAlertState({ type: 'success', message: 'Signed in successfully. Opening FindKart...' });
      window.setTimeout(() => {
        onAuthSuccess(data);
      }, 450);
    } catch (err) {
      setAlertState({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not reach FindKart authentication service.',
      });
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertState(null);
    const errors: { name?: string; email?: string; password?: string; confirm?: string } = {};
    const nameTrimmed = regName.trim();
    const emailTrimmed = regEmail.trim();

    if (nameTrimmed.length < 2) {
      errors.name = 'Enter your full name';
    }
    if (!isValidEmail(emailTrimmed)) {
      errors.email = 'Enter a valid email address';
    }
    if (regPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (!regConfirm || regConfirm !== regPassword) {
      errors.confirm = 'Passwords do not match';
    }

    setRegErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setRegSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'FindKart',
        },
        body: JSON.stringify({
          name: nameTrimmed,
          email: emailTrimmed,
          password: regPassword,
          guestCart,
          guestWishlist,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to create account. Please try again.');
      }
      setAlertState({ type: 'success', message: 'Account created! Welcome to FindKart.' });
      window.setTimeout(() => {
        onAuthSuccess(data);
      }, 450);
    } catch (err) {
      setAlertState({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not reach FindKart registration service.',
      });
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-background text-light-on-background flex flex-col lg:grid lg:grid-cols-12">
      {/* Compact Mobile Brand Header */}
      <header className="lg:hidden bg-light-primary text-light-on-primary px-gutter-md sm:px-page-margin py-gutter-md sm:py-gutter-lg flex flex-col gap-gutter-md">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-gutter-sm text-left min-w-0 cursor-pointer"
          >
            <div className="w-9 h-9 rounded bg-accent-yellow text-on-accent-yellow flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                shopping_bag
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline text-title-lg text-light-on-primary leading-none">FindKart</span>
              <span className="font-label text-label-sm text-accent-yellow truncate">INDIA&apos;S TRUSTED STORE</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onBackToStore}
            className="font-label text-label-sm px-2.5 py-1.5 rounded bg-light-primary-container text-light-on-primary shrink-0 cursor-pointer"
          >
            Back to Store
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-headline text-headline-lg-mobile text-light-on-primary text-balance">
            Smart everyday shopping across India
          </h1>
          <p className="font-body text-body-sm text-light-inverse-primary text-pretty">
            Track orders, save delivery addresses, and check out faster.
          </p>
        </div>
      </header>

      {/* Left Brand & Shopping Showcase Panel (Desktop Split-Screen) */}
      <aside className="hidden lg:flex lg:col-span-5 bg-light-primary text-light-on-primary flex-col justify-between p-section">
        <div className="flex flex-col gap-gutter-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-gutter-sm w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow rounded text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded bg-accent-yellow text-on-accent-yellow flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                  shopping_bag
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline text-headline-sm text-light-on-primary leading-none">
                  FindKart
                </span>
                <span className="font-label text-label-sm text-accent-yellow tracking-wide">
                  INDIA&apos;S TRUSTED STORE
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-light-primary-container text-light-on-primary hover:bg-light-primary-container/80 font-label text-label-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                arrow_back
              </span>
              <span>Back to Store</span>
            </button>
          </div>

          <div className="flex flex-col gap-gutter-sm pt-gutter-md">
            <h1 className="font-display text-display-lg text-light-on-primary text-balance">
              Smart everyday shopping across India
            </h1>
            <p className="font-body text-body-lg text-light-inverse-primary text-pretty max-w-md">
              Electronics, fashion, home essentials, and curated daily deals — delivered fast with Cash on Delivery.
            </p>
          </div>
        </div>

        <div className="my-gutter-lg rounded-md overflow-hidden border border-light-on-primary/15 bg-light-primary-container shadow-md">
          <ProductImage
            src={STITCH_IMAGES.authShowcase}
            alt="Curated FindKart electronics, accessories, and sealed delivery parcel"
            className="w-full h-64 object-cover"
            fallbackIcon="local_shipping"
          />
        </div>

        <div className="grid grid-cols-3 gap-gutter-md pt-gutter-md border-t border-light-on-primary/15">
          <div className="flex flex-col gap-1">
            <span className="material-symbols-outlined text-[20px] text-accent-yellow" aria-hidden="true">
              verified
            </span>
            <span className="font-label text-label-md text-light-on-primary">100% Genuine</span>
            <span className="font-body text-body-sm text-light-inverse-primary">Verified sellers</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="material-symbols-outlined text-[20px] text-accent-yellow" aria-hidden="true">
              payments
            </span>
            <span className="font-label text-label-md text-light-on-primary">Cash on Delivery</span>
            <span className="font-body text-body-sm text-light-inverse-primary">Pay at doorstep</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="material-symbols-outlined text-[20px] text-accent-yellow" aria-hidden="true">
              local_shipping
            </span>
            <span className="font-label text-label-md text-light-on-primary">Fast Dispatch</span>
            <span className="font-body text-body-sm text-light-inverse-primary">19,000+ pin codes</span>
          </div>
        </div>
      </aside>

      {/* Right Authentication Panel */}
      <main className="flex-1 lg:col-span-7 flex flex-col items-center justify-center p-gutter-md sm:p-gutter-xl bg-light-background">
        <div className="w-full max-w-md bg-light-surface-container-lowest rounded-md border border-light-outline-variant/80 shadow-md p-gutter-md sm:p-gutter-xl flex flex-col gap-gutter-md sm:gap-gutter-lg">
          {/* Form Header */}
          <div className="flex flex-col gap-1">
            <h2 className="font-headline text-headline-sm sm:text-headline-md text-light-on-surface">
              {mode === 'signin' ? 'Welcome back to FindKart' : 'Create your FindKart account'}
            </h2>
            <p className="font-body text-body-sm sm:text-body-md text-light-on-surface-variant">
              {mode === 'signin'
                ? 'Sign in to access your orders, saved addresses, and cart.'
                : 'Join FindKart for fast checkout and Cash on Delivery across India.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 p-1 rounded bg-light-surface-container border border-light-outline-variant/60"
          >
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'signin'}
              onClick={() => switchMode('signin')}
              className={`py-2 px-gutter-md rounded-sm font-label text-label-md sm:text-label-lg transition-colors duration-150 cursor-pointer ${
                mode === 'signin'
                  ? 'bg-light-surface-container-lowest text-light-primary shadow-sm'
                  : 'text-light-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              Sign in
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`py-2 px-gutter-md rounded-sm font-label text-label-md sm:text-label-lg transition-colors duration-150 cursor-pointer ${
                mode === 'register'
                  ? 'bg-light-surface-container-lowest text-light-primary shadow-sm'
                  : 'text-light-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Feedback Alert */}
          {alertState && (
            <div
              role={alertState.type === 'success' ? 'status' : 'alert'}
              className={`flex items-start gap-gutter-sm p-3.5 rounded border ${
                alertState.type === 'success'
                  ? 'bg-success-container border-success/30 text-on-success-container'
                  : alertState.type === 'info'
                    ? 'bg-light-surface-container border-light-outline-variant text-light-on-surface'
                    : 'bg-light-error-container border-light-error/30 text-light-on-error-container'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                  alertState.type === 'success'
                    ? 'text-success'
                    : alertState.type === 'info'
                      ? 'text-light-primary'
                      : 'text-light-error'
                }`}
                aria-hidden="true"
              >
                {alertState.type === 'success'
                  ? 'check_circle'
                  : alertState.type === 'info'
                    ? 'info'
                    : 'error'}
              </span>
              <span className="font-body text-body-md flex-1">{alertState.message}</span>
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'signin' ? (
            <form onSubmit={handleLoginSubmit} noValidate className="flex flex-col gap-gutter-md">
              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-md text-light-on-surface">Email address</span>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  >
                    mail
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="aarav.sharma@gmail.com"
                    aria-invalid={Boolean(loginErrors.email)}
                    className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded border bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none ${
                      loginErrors.email ? 'border-light-error' : 'border-light-outline-variant'
                    }`}
                  />
                </div>
                {loginErrors.email && (
                  <span role="alert" className="font-body text-body-sm text-light-error">
                    {loginErrors.email}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label text-label-md text-light-on-surface">Password</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAlertState({
                        type: 'info',
                        message:
                          'Enter your registered email address and contact FindKart support at support@findkart.in to reset your password.',
                      })
                    }
                    className="font-label text-label-sm text-light-primary hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  >
                    lock
                  </span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(loginErrors.password)}
                    className={`w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded border bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none ${
                      loginErrors.password ? 'border-light-error' : 'border-light-outline-variant'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 inline-flex items-center justify-center w-9 h-9 rounded text-light-on-surface-variant hover:bg-light-surface-container hover:text-light-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {showLoginPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {loginErrors.password && (
                  <span role="alert" className="font-body text-body-sm text-light-error">
                    {loginErrors.password}
                  </span>
                )}
              </label>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-gutter-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loginRemember}
                    onChange={(e) => setLoginRemember(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
                  />
                  <span className="font-body text-body-sm text-light-on-surface-variant">
                    Keep me signed in on this device
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full min-h-12 inline-flex items-center justify-center gap-gutter-sm px-gutter-lg py-3 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm font-label text-label-lg cursor-pointer"
              >
                {loginSubmitting ? 'Signing in...' : 'Sign in to FindKart'}
              </button>

              <p className="font-body text-body-sm text-center text-light-on-surface-variant pt-gutter-xs">
                New to FindKart?
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-label text-label-md text-light-primary hover:underline ml-1 cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} noValidate className="flex flex-col gap-gutter-md">
              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-md text-light-on-surface">Full name</span>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  >
                    person
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Aarav Sharma"
                    aria-invalid={Boolean(regErrors.name)}
                    className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded border bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none ${
                      regErrors.name ? 'border-light-error' : 'border-light-outline-variant'
                    }`}
                  />
                </div>
                {regErrors.name && (
                  <span role="alert" className="font-body text-body-sm text-light-error">
                    {regErrors.name}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-md text-light-on-surface">Email address</span>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  >
                    mail
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="aarav.sharma@gmail.com"
                    aria-invalid={Boolean(regErrors.email)}
                    className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded border bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none ${
                      regErrors.email ? 'border-light-error' : 'border-light-outline-variant'
                    }`}
                  />
                </div>
                {regErrors.email && (
                  <span role="alert" className="font-body text-body-sm text-light-error">
                    {regErrors.email}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-md text-light-on-surface">Create password</span>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  >
                    lock
                  </span>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    aria-invalid={Boolean(regErrors.password)}
                    className={`w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded border bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none ${
                      regErrors.password ? 'border-light-error' : 'border-light-outline-variant'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 inline-flex items-center justify-center w-9 h-9 rounded text-light-on-surface-variant hover:bg-light-surface-container hover:text-light-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {showRegPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <span className="font-body text-body-sm text-light-on-surface-variant">
                  Use at least 8 characters with letters and numbers
                </span>
                {regErrors.password && (
                  <span role="alert" className="font-body text-body-sm text-light-error">
                    {regErrors.password}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-md text-light-on-surface">Confirm password</span>
                <div className="relative flex items-center">
                  <span
                    className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  >
                    lock_reset
                  </span>
                  <input
                    type={showRegConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    aria-invalid={Boolean(regErrors.confirm)}
                    className={`w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded border bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none ${
                      regErrors.confirm ? 'border-light-error' : 'border-light-outline-variant'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirm((prev) => !prev)}
                    aria-label={showRegConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-1.5 inline-flex items-center justify-center w-9 h-9 rounded text-light-on-surface-variant hover:bg-light-surface-container hover:text-light-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {showRegConfirm ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {regErrors.confirm && (
                  <span role="alert" className="font-body text-body-sm text-light-error">
                    {regErrors.confirm}
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={regSubmitting}
                className="w-full min-h-12 inline-flex items-center justify-center gap-gutter-sm px-gutter-lg py-3 rounded bg-accent-yellow text-on-accent-yellow hover:bg-light-secondary-container active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm font-label text-label-lg cursor-pointer"
              >
                {regSubmitting ? 'Creating account...' : 'Create FindKart account'}
              </button>

              <p className="font-body text-body-sm text-center text-light-on-surface-variant pt-gutter-xs">
                Already have a FindKart account?
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="font-label text-label-md text-light-primary hover:underline ml-1 cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Terms & Security Footer */}
          <div className="pt-gutter-md border-t border-light-outline-variant/60 flex items-center justify-center gap-gutter-sm text-light-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-success" aria-hidden="true">
              encrypted
            </span>
            <span className="font-body text-body-sm">
              256-bit encrypted sign-in • Protected by FindKart
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
