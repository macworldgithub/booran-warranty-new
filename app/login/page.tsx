'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { api } from '@/lib/api';
import { OtpInput } from '@/components/auth/otp-input';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedSite, setSelectedSite] = useState('site_cranbourne_byd');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration OTP State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtpBadge, setDevOtpBadge] = useState<string | null>(null);
  const [regCountdown, setRegCountdown] = useState(60);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'EMAIL' | 'OTP' | 'PASSWORD'>('EMAIL');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotCountdown, setForgotCountdown] = useState(60);

  // Clear any stale tokens when landing on login page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('booran_user');
      localStorage.removeItem('booran_jwt');
      localStorage.removeItem('booran_auth_token');
      localStorage.removeItem('booran_user_profile');
    }
  }, []);

  // Registration OTP 60s Countdown Timer
  useEffect(() => {
    if (!isOtpStep || regCountdown <= 0) return;
    const timer = setInterval(() => {
      setRegCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpStep, regCountdown]);

  // Forgot Password OTP 60s Countdown Timer
  useEffect(() => {
    if (!showForgotModal || forgotStep !== 'OTP' || forgotCountdown <= 0) return;
    const timer = setInterval(() => {
      setForgotCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showForgotModal, forgotStep, forgotCountdown]);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
  };

  const handleModeSwitch = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    if (mode === 'signup') {
      setSelectedRole('TECHNICIAN');
    }
    setIsOtpStep(false);
    setOtpCode('');
    setDevOtpBadge(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const saveAuthSession = (user: any, token?: string) => {
    const userStr = JSON.stringify(user);
    localStorage.setItem('booran_user', userStr);
    localStorage.setItem('booran_user_profile', userStr);
    if (token) {
      localStorage.setItem('booran_jwt', token);
      localStorage.setItem('booran_auth_token', token);
    } else {
      const mockToken = 'jwt_' + Date.now();
      localStorage.setItem('booran_jwt', mockToken);
      localStorage.setItem('booran_auth_token', mockToken);
    }
  };

  const handleSendOtp = async () => {
    if (!name.trim()) throw new Error('Please enter your full name');
    if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid work email address');
    if (!password.trim() || password.length < 6) throw new Error('Password must be at least 6 characters');
    if (confirmPassword && password !== confirmPassword) throw new Error('Passwords do not match');

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.auth.sendRegistrationOtp({
        email: email.trim().toLowerCase(),
        name: name.trim(),
      });

      setIsOtpStep(true);
      setRegCountdown(60);
      setOtpCode('');
      setDevOtpBadge(null);
      setSuccessMsg(`Verification code dispatched to ${email.trim().toLowerCase()}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to send verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegistrationOtp = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.auth.sendRegistrationOtp({
        email: email.trim().toLowerCase(),
        name: name.trim(),
      });
      setRegCountdown(60);
      setOtpCode('');
      setDevOtpBadge(null);
      setSuccessMsg(`A new verification code was sent to ${email.trim().toLowerCase()}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndCreate = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      throw new Error('Please enter the full 6-digit verification code.');
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await api.auth.verifyRegistrationOtp({
        email: email.trim().toLowerCase(),
        otp: otpCode.trim(),
        name: name.trim(),
        password: password.trim(),
        role: selectedRole,
        siteId: selectedSite,
      });

      saveAuthSession(response.user, response.accessToken);
      setSuccessMsg('Account verified and created successfully! Redirecting to workspace...');
      setTimeout(() => {
        router.replace(selectedRole === 'TECHNICIAN' ? '/cases/new' : '/dashboard');
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the 6-digit code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (authMode === 'signup') {
      if (isOtpStep) {
        await handleVerifyOtpAndCreate();
      } else {
        await handleSendOtp();
      }
      return;
    }

    // Sign In Mode
    setLoading(true);
    try {
      if (!email.trim()) throw new Error('Please enter your work email address.');
      if (!password.trim()) throw new Error('Please enter your password.');

      const response = await api.auth.login({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role: selectedRole,
      });

      if (!response || !response.user) {
        throw new Error('Authentication failed. Please check your credentials and try again.');
      }

      saveAuthSession(response.user, response.accessToken);
      router.replace(response.user.role === 'TECHNICIAN' ? '/cases/new' : '/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Actions
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid work email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await api.sendForgotPasswordOtp(forgotEmail.trim().toLowerCase());
      setForgotStep('OTP');
      setForgotCountdown(60);
      setForgotOtp('');
      setForgotSuccess(`Verification code dispatched to ${forgotEmail.trim().toLowerCase()}`);
    } catch (err: any) {
      setForgotError(err.message || 'Unable to send password reset code. Please check your email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendForgotOtp = async () => {
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const res = await api.sendForgotPasswordOtp(forgotEmail.trim().toLowerCase());
      setForgotCountdown(60);
      setForgotOtp('');
      setForgotSuccess(`A new reset code was dispatched to ${forgotEmail.trim().toLowerCase()}`);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the full 6-digit verification code.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      await api.verifyResetOtp({
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
      });
      setForgotStep('PASSWORD');
      setForgotSuccess('Verification code confirmed! Please enter your new password.');
    } catch (err: any) {
      setForgotError(err.message || 'Invalid or incorrect verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the full 6-digit verification code.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('New password must be at least 6 characters.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await api.resetPassword({
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword.trim(),
      });

      setForgotSuccess(res.message || 'Password reset successfully! You can now sign in.');
      setEmail(forgotEmail.trim().toLowerCase());
      setPassword(forgotNewPassword.trim());

      setTimeout(() => {
        setShowForgotModal(false);
        setForgotSuccess(null);
      }, 1200);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password. Please check the code.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Ambient Red Glow */}
      <div className="absolute top-[-10%] left-[25%] w-[500px] h-[500px] rounded-full bg-[#E11F26]/6 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[25%] w-[400px] h-[400px] rounded-full bg-[#E11F26]/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 border border-red-200 text-[#E11F26] text-xs font-bold uppercase tracking-widest mb-4">
            <span className="w-2 h-2 rounded-full bg-[#E11F26] animate-ping" />
            BOORAN MOTOR GROUP · AFTERSALES
          </div>
          <div className="flex justify-center mb-3">
            <img
              src="/booran-motors-transparent.png"
              alt="Booran Motors"
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Warranty Claim Portal
          </h1>
          <p className="text-xs text-slate-700 mt-1 max-w-xs mx-auto">
            Audit-Proof Evidence Collection & Compliance Engine
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => handleModeSwitch('signin')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('signup')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Register Account
            </button>
          </div>

          {/* Role Selector Tabs (Only for Sign In; Register Account is restricted to Technicians) */}
          {!isOtpStep && authMode === 'signin' && (
            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Select Workspace Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleChange('ADMIN')}
                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                    selectedRole === 'ADMIN'
                      ? 'border-[#E11F26] bg-red-50/50 ring-1 ring-[#E11F26]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedRole === 'ADMIN' ? 'bg-[#E11F26]' : 'bg-slate-300'
                      }`}
                    />
                    <span className="font-bold text-xs text-slate-900">Warranty Admin</span>
                  </div>
                  <p className="text-[11px] text-slate-700">Full audit, packs, sites & review</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('TECHNICIAN')}
                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                    selectedRole === 'TECHNICIAN'
                      ? 'border-[#E11F26] bg-red-50/50 ring-1 ring-[#E11F26]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedRole === 'TECHNICIAN' ? 'bg-[#E11F26]' : 'bg-slate-300'
                      }`}
                    />
                    <span className="font-bold text-xs text-slate-900">Workshop Tech</span>
                  </div>
                  <p className="text-[11px] text-slate-700">Mobile camera & quick evidence capture</p>
                </button>
              </div>
            </div>
          )}

          {/* Registration Notice for Techs */}
          {!isOtpStep && authMode === 'signup' && (
            <div className="mb-6 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Workshop Technician Registration</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-[#E11F26]">Tech Only</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Self-registration is available for Workshop Technicians. Warranty Admin accounts are provisioned internally by dealership management.
                </p>
              </div>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* OTP Verification Step for Sign Up */}
            {authMode === 'signup' && isOtpStep ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-black text-slate-900">Verify Your Work Email</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    We dispatched a 6-digit verification code to:
                  </p>
                  <p className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg inline-block my-2">
                    {email}
                  </p>

                  {/* 6 Individual Digit Boxes */}
                  <div className="py-2">
                    <OtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={loading}
                      autoFocus={true}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1">
                    Check your email inbox or spam folder for your 6-digit code.
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setIsOtpStep(false)}
                      className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                    >
                      ← Edit Details
                    </button>

                    {regCountdown > 0 ? (
                      <span className="text-slate-400 font-medium">
                        Resend code in <strong className="font-mono text-slate-700">{regCountdown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleResendRegistrationOtp}
                        className="text-[#E11F26] font-bold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Resend verification code
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Full Name */}
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. David Miller"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                      />
                      <div className="absolute right-3 top-2.5 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder={selectedRole === 'ADMIN' ? 'admin@booran.com.au' : 'technician@booran.com.au'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Sign Up: Dealership Rooftop */}
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Dealership Rooftop
                    </label>
                    <select
                      value={selectedSite}
                      onChange={(e) => setSelectedSite(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                    >
                      <option value="site_cranbourne_byd">Booran BYD Cranbourne</option>
                      <option value="site_dandenong_multi">Booran Dandenong Multi-Franchise</option>
                      <option value="site_cheltenham_mg">Booran MG & Chery Cheltenham</option>
                      <option value="site_berwick_toyota_ford">Booran Berwick Commercials</option>
                    </select>
                  </div>
                )}

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    {authMode === 'signin' && (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                          Default: Booran2026!
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(email || '');
                            setForgotStep('EMAIL');
                            setForgotOtp('');
                            setForgotNewPassword('');
                            setForgotConfirmPassword('');
                            setForgotError(null);
                            setForgotSuccess(null);
                            setForgotCountdown(60);
                            setShowForgotModal(true);
                          }}
                          className="text-[11px] text-[#E11F26] hover:underline cursor-pointer font-semibold"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password on Signup */}
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                    />
                  </div>
                )}
              </>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E11F26] shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (authMode === 'signup' && isOtpStep && otpCode.length !== 6)}
              className="w-full bg-[#E11F26] hover:bg-[#c9181e] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-2xl transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    {authMode === 'signin'
                      ? 'Sign In to Workspace'
                      : isOtpStep
                      ? 'Verify Code & Create Account'
                      : 'Send Verification Code'}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Attachment A Compliance Badge Footer */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>BYD-WB-2602-02 Active</span>
            </div>
            <span>v1.0 · Multi-Brand Engine</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
                  <p className="text-xs text-slate-500">
                    {forgotStep === 'EMAIL' ? 'Request email verification code' : 'Verify 6-digit code & reset password'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error / Success Alerts */}
            {forgotError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E11F26] shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* Step 1: Enter Email */}
            {forgotStep === 'EMAIL' ? (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered work email address. We will dispatch a 6-digit verification code to reset your account password.
                </p>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Work Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. technician@booran.com.au"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 bg-[#E11F26] hover:bg-[#c9181e] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <span>Send Reset Code</span>
                    )}
                  </button>
                </div>
              </form>
            ) : forgotStep === 'OTP' ? (
              /* Step 2: Enter & Verify 6-Digit OTP */
              <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Email Verification Code</span>
                    <button
                      type="button"
                      onClick={() => setForgotStep('EMAIL')}
                      className="text-xs text-[#E11F26] font-semibold hover:underline"
                    >
                      Change Email
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Enter the 6-digit code sent to <strong className="text-slate-900">{forgotEmail}</strong>
                  </p>

                  {/* 6 Individual Digit Boxes */}
                  <div className="py-1">
                    <OtpInput
                      value={forgotOtp}
                      onChange={setForgotOtp}
                      disabled={forgotLoading}
                      autoFocus={true}
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    {forgotCountdown > 0 ? (
                      <span className="text-slate-400 font-medium">
                        Resend code in <strong className="font-mono text-slate-700">{forgotCountdown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={forgotLoading}
                        onClick={handleResendForgotOtp}
                        className="text-[#E11F26] font-bold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Resend verification code
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || forgotOtp.trim().length !== 6}
                    className="px-5 py-2.5 bg-[#E11F26] hover:bg-[#c9181e] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify Code</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 3: Enter New Password (Only shown after OTP is verified!) */
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-black text-[11px]">✓</span>
                    <span>Code verified for <strong className="font-mono">{forgotEmail}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotStep('OTP')}
                    className="text-[11px] text-emerald-700 hover:underline font-semibold"
                  >
                    Change Code
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showForgotNewPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-type new password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showForgotConfirmPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 bg-[#E11F26] hover:bg-[#c9181e] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Saving Password...</span>
                      </>
                    ) : (
                      <span>Save New Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
