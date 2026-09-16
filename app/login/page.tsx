'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSite, setSelectedSite] = useState('site_cranbourne_byd');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration OTP State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtpBadge, setDevOtpBadge] = useState<string | null>(null);

  // Clear any stale tokens when landing on login page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('booran_user');
      localStorage.removeItem('booran_jwt');
      localStorage.removeItem('booran_auth_token');
      localStorage.removeItem('booran_user_profile');
    }
  }, []);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
  };

  const handleModeSwitch = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
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

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.auth.sendRegistrationOtp({
        email: email.trim().toLowerCase(),
        name: name.trim(),
      });

      setIsOtpStep(true);
      if (res.devOtp) {
        setDevOtpBadge(res.devOtp);
        setOtpCode(res.devOtp);
      }
      setSuccessMsg(`Verification code sent to ${email.trim().toLowerCase()}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to send verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndCreate = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      throw new Error('Please enter the 6-digit verification code.');
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
      setSuccessMsg('Account verified and created successfully! Redirecting...');
      setTimeout(() => {
        router.replace(selectedRole === 'TECHNICIAN' ? '/cases/new' : '/dashboard');
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the code.');
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
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl mb-6 border border-slate-200">
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

          {/* Role Selector Tabs */}
          {!isOtpStep && (
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

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* OTP Verification Step for Sign Up */}
            {authMode === 'signup' && isOtpStep ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Email Verification Code</span>
                    <button
                      type="button"
                      onClick={() => setIsOtpStep(false)}
                      className="text-xs text-[#E11F26] font-semibold hover:underline"
                    >
                      Change Details
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    We sent a 6-digit verification code to <span className="font-semibold text-slate-900">{email}</span>
                  </p>

                  {devOtpBadge && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                      <span>Development Code:</span>
                      <span className="font-mono font-bold text-sm text-[#E11F26]">{devOtpBadge}</span>
                    </div>
                  )}

                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full text-center tracking-[0.3em] font-mono text-xl font-bold bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E11F26] focus:ring-1 focus:ring-[#E11F26] transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Didn't receive code?</span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendOtp}
                    className="text-[#E11F26] font-semibold hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Resend Code
                  </button>
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
                      placeholder={
                        selectedRole === 'ADMIN' ? 'admin@booran.com.au' : 'technician@booran.com.au'
                      }
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
                      <span className="text-[11px] text-[#E11F26] hover:underline cursor-pointer font-semibold">
                        Default: Booran2026!
                      </span>
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
              </>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#E11F26] hover:bg-[#c81a20] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
    </div>
  );
}
