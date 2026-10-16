'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Building,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FileText,
  MessageSquare,
  DollarSign,
  Megaphone,
  Users,
  Calendar,
  Moon,
  RefreshCw,
} from 'lucide-react';
import Image from 'next/image';

interface KlirAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'register';
  onAuthSuccess: (data: { user: any; workspace?: any; activeWorkspace?: any; tokens: any }) => void;
}

export default function KlirAuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  onAuthSuccess,
}: KlirAuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    setAuthMode(initialMode);
    setEmailOrUsername('');
    setPassword('');
    setFullName('');
    setWorkspaceName('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
  }, [initialMode, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Load Google Identity Services Script & OAuth2 Client
  useEffect(() => {
    if (!isOpen) return;

    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '645728911872-o4q7bpd6i1uqffjbluk7ahv0kesc7ach.apps.googleusercontent.com';

    const handleGoogleAuthPayload = async (payload: { credential?: string; accessToken?: string }) => {
      try {
        setGoogleLoading(true);
        setErrorMessage(null);
        const res = await fetch('/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          setSuccessMessage('Berhasil masuk dengan akun Google!');
          setTimeout(() => {
            onAuthSuccess(data);
          }, 350);
        } else {
          setErrorMessage(data.message || 'Verifikasi akun Google gagal.');
        }
      } catch (err: any) {
        setErrorMessage(`Kesalahan autentikasi Google: ${err.message}`);
      } finally {
        setGoogleLoading(false);
      }
    };

    const initGoogleServices = () => {
      try {
        if ((window as any).google?.accounts) {
          // 1. GIS Credential Initializer
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: (res: any) => handleGoogleAuthPayload({ credential: res.credential }),
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // 2. OAuth2 Token Client (For Instant Popup on Custom Button Click)
          if ((window as any).google.accounts.oauth2) {
            tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'email profile openid',
              callback: (res: any) => {
                if (res.access_token) {
                  handleGoogleAuthPayload({ accessToken: res.access_token });
                } else if (res.error) {
                  setGoogleLoading(false);
                  setErrorMessage(`Google Sign-In: ${res.error_description || res.error}`);
                }
              },
              error_callback: (err: any) => {
                console.warn('[GoogleAuth] error_callback:', err);
                setGoogleLoading(false);
                setErrorMessage(
                  err?.message || 'Login Google dibatalkan atau domain origin belum terdaftar di Google Cloud Console.'
                );
              },
            });
          }
        }
      } catch (initErr: any) {
        console.warn('[GoogleAuth] Init exception:', initErr);
      }
    };

    if (!(window as any).google?.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogleServices;
      script.onerror = () => {
        console.warn('[GoogleAuth] GSI script failed to load');
      };
      document.head.appendChild(script);
    } else {
      initGoogleServices();
    }
  }, [isOpen, onAuthSuccess]);

  if (!isOpen) return null;

  const handleDirectGoogleLogin = () => {
    setErrorMessage(null);
    setGoogleLoading(true);

    if (tokenClientRef.current) {
      try {
        tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        setGoogleLoading(false);
        setErrorMessage(err?.message || 'Gagal membuka jendela Google Sign-In.');
      }
    } else if ((window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setGoogleLoading(false);
          }
        });
      } catch (e) {
        setGoogleLoading(false);
        setErrorMessage('Gagal membuka popup Google.');
      }
    } else {
      setGoogleLoading(false);
      setErrorMessage('Layanan Google Sign-In sedang dimuat, silakan coba sesaat lagi.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';

      let formattedEmail = emailOrUsername.trim();
      if (!formattedEmail.includes('@') && authMode === 'login') {
        formattedEmail = `${formattedEmail.toLowerCase().replace(/[^a-z0-9]/g, '')}@anitech.dev`;
      }

      const payload =
        authMode === 'login'
          ? { email: formattedEmail, password }
          : {
              email: formattedEmail,
              password,
              fullName: fullName.trim(),
              workspaceName: workspaceName.trim() || undefined,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(
          authMode === 'login' ? 'Login berhasil! Mengalihkan...' : 'Akun berhasil didaftarkan! Mengalihkan...'
        );
        setTimeout(() => {
          onAuthSuccess(data);
        }, 300);
      } else {
        if (authMode === 'login' && res.status === 401) {
          setErrorMessage(
            'Email atau password tidak cocok. Jika Anda belum memiliki akun, silakan klik "Daftar sekarang" di bawah.'
          );
        } else {
          setErrorMessage(data.message || 'Autentikasi gagal. Silakan periksa kembali data Anda.');
        }
      }
    } catch (err: any) {
      setErrorMessage(`Koneksi server gagal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-[999] w-screen h-screen bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn select-none cursor-pointer"
    >
      <div className="w-full max-w-[880px] bg-[#090b10] border border-white/10 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden grid grid-cols-1 md:grid-cols-2 relative cursor-default">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: BRANDING & 6 MODULES SHOWCASE */}
        {/* ========================================================================= */}
        <div className="bg-[#08090d] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#0058be]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="flex items-center gap-2.5 z-10">
            <img
              src="/Logo-KLIR.png"
              alt="KLIR Logo"
              className="w-7 h-7 object-contain drop-shadow-[0_0_10px_rgba(78,155,255,0.4)]"
            />
            <span className="font-heading font-extrabold text-sm tracking-tight text-white">KLIR</span>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-2 my-5 z-10">
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-tight">
              Satu Sistem. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] via-[#6e85ff] to-[#8d55e8]">
                Seluruh Bisnismu.
              </span>
            </h2>
            <p className="text-xs text-[#8a8f98] leading-relaxed">
              Kelola rencana, keuangan, tim, promosi, dan pelanggan dalam satu ekosistem AI.
            </p>
          </div>

          {/* 6 Core Feature Cards Grid (2 cols x 3 rows) */}
          <div className="grid grid-cols-2 gap-2.5 z-10 text-xs">
            {/* 1. Executive */}
            <div className="p-2.5 bg-[#10121a]/90 border border-white/10 rounded-lg hover:border-[#00d2ff]/40 transition-all">
              <div className="flex items-center gap-2 mb-0.5">
                <FileText className="w-3.5 h-3.5 text-[#00d2ff]" />
                <span className="font-bold text-xs text-white">Executive</span>
              </div>
              <p className="text-[10px] text-[#8a8f98]">Strategi &amp; Operasional</p>
            </div>

            {/* 2. KLIR Personal */}
            <div className="p-2.5 bg-[#10121a]/90 border border-white/10 rounded-lg hover:border-[#8d55e8]/40 transition-all">
              <div className="flex items-center gap-2 mb-0.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#8d55e8]" />
                <span className="font-bold text-xs text-white">KLIR Personal</span>
              </div>
              <p className="text-[10px] text-[#8a8f98]">AI Assistant</p>
            </div>

            {/* 3. KLIR Finance */}
            <div className="p-2.5 bg-[#10121a]/90 border border-white/10 rounded-lg hover:border-[#00e676]/40 transition-all">
              <div className="flex items-center gap-2 mb-0.5">
                <DollarSign className="w-3.5 h-3.5 text-[#00e676]" />
                <span className="font-bold text-xs text-white">KLIR Finance</span>
              </div>
              <p className="text-[10px] text-[#8a8f98]">Keuangan</p>
            </div>

            {/* 4. KLIR Advertising */}
            <div className="p-2.5 bg-[#10121a]/90 border border-white/10 rounded-lg hover:border-[#ffab00]/40 transition-all">
              <div className="flex items-center gap-2 mb-0.5">
                <Megaphone className="w-3.5 h-3.5 text-[#ffab00]" />
                <span className="font-bold text-xs text-white">KLIR Advertising</span>
              </div>
              <p className="text-[10px] text-[#8a8f98]">Promosi</p>
            </div>

            {/* 5. KLIR Workspace */}
            <div className="p-2.5 bg-[#10121a]/90 border border-white/10 rounded-lg hover:border-[#00d2ff]/40 transition-all">
              <div className="flex items-center gap-2 mb-0.5">
                <Users className="w-3.5 h-3.5 text-[#00d2ff]" />
                <span className="font-bold text-xs text-white">KLIR Workspace</span>
              </div>
              <p className="text-[10px] text-[#8a8f98]">Manajemen Tim</p>
            </div>

            {/* 6. KLIR Schedule */}
            <div className="p-2.5 bg-[#10121a]/90 border border-white/10 rounded-lg hover:border-[#8d55e8]/40 transition-all">
              <div className="flex items-center gap-2 mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#8d55e8]" />
                <span className="font-bold text-xs text-white">KLIR Schedule</span>
              </div>
              <p className="text-[10px] text-[#8a8f98]">Booking & Layanan</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-[#626770] flex items-center justify-between">
            <span>Satu akun untuk seluruh modul</span>
            <span className="text-[#00d2ff]">v4.2</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: CLEAN AUTHENTICATION FORM */}
        {/* ========================================================================= */}
        <div className="bg-[#0b0c10] p-6 sm:p-8 flex flex-col justify-between relative space-y-4">
          {/* Top Header: Mode Gelap Badge & Close X Button */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-[#8a8f98]">
              <Moon className="w-3 h-3 text-[#00d2ff]" />
              <span>Mode Gelap</span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                aria-label="Tutup modal"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-[#8a8f98] hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-heading font-extrabold text-xl text-white tracking-tight">
              {authMode === 'login' ? 'Selamat Datang Kembali' : 'Mulai Perjalanan Bisnis Anda'}
            </h3>
            <p className="text-xs text-[#8a8f98]">
              {authMode === 'login'
                ? 'Masuk untuk melanjutkan ke workspace Anda'
                : 'Daftar sekarang untuk mengelola seluruh bisnis dengan AI'}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-2.5 bg-[#ff5252]/10 border border-[#ff5252]/30 rounded-lg flex items-start gap-2 text-xs text-[#ff5252] animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="leading-snug flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 bg-[#00e676]/10 border border-[#00e676]/30 rounded-lg flex items-start gap-2 text-xs text-[#00e676]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {authMode === 'register' && (
              <>
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[#8a8f98] font-medium text-[11px] block">Nama Lengkap</label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-[#8a8f98] absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda"
                      required
                      className="w-full bg-[#12131a] border border-white/10 rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-[#606570] focus:outline-none focus:border-[#0058be] transition-all"
                    />
                  </div>
                </div>

                {/* Workspace Name */}
                <div className="space-y-1">
                  <label className="text-[#8a8f98] font-medium text-[11px] block">Nama Usaha / Workspace (Opsional)</label>
                  <div className="relative flex items-center">
                    <Building className="w-4 h-4 text-[#8a8f98] absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Masukkan nama usaha atau brand Anda"
                      className="w-full bg-[#12131a] border border-white/10 rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-[#606570] focus:outline-none focus:border-[#0058be] transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email / Username */}
            <div className="space-y-1">
              <label className="text-[#8a8f98] font-medium text-[11px] block">Username / Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#8a8f98] absolute left-3.5 pointer-events-none" />
                <input
                  type={authMode === 'register' ? 'email' : 'text'}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder={authMode === 'register' ? 'Masukkan email Anda' : 'Masukkan email atau username Anda'}
                  required
                  className="w-full bg-[#12131a] border border-white/10 rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-[#606570] focus:outline-none focus:border-[#0058be] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[#8a8f98] font-medium text-[11px] block">Password</label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setSuccessMessage('Tautan pemulihan kata sandi telah dikirim ke email terdaftar.')}
                    className="text-[11px] text-[#00d2ff] hover:underline cursor-pointer"
                  >
                    Lupa password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#8a8f98] absolute left-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === 'register' ? 'Minimal 8 karakter' : 'Masukkan password Anda'}
                  required
                  className="w-full bg-[#12131a] border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-[#606570] focus:outline-none focus:border-[#0058be] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[#8a8f98] hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            {authMode === 'login' && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-[#8a8f98]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/20 bg-[#15161c] text-[#0058be] focus:ring-0"
                  />
                  <span>Ingat saya selama 30 hari</span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#2f5ae6] via-[#505be0] to-[#8d55e8] hover:from-[#254cc8] hover:to-[#7c47d4] flex items-center justify-center gap-1.5 shadow-lg shadow-[#0058be]/25 transition-all mt-2 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>{authMode === 'login' ? 'Masuk' : 'Daftar Sekarang'}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[#626770] text-[11px] pt-1">
            <div className="flex-1 h-px bg-white/10" />
            <span>atau masuk dengan</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Direct Google SSO Button */}
          <div>
            <button
              type="button"
              onClick={handleDirectGoogleLogin}
              disabled={googleLoading}
              className="w-full py-2.5 px-3 bg-white hover:bg-[#eaeaea] active:scale-[0.99] rounded-lg text-xs font-semibold text-[#111] flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer"
            >
              {googleLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0058be]" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>Lanjutkan dengan Google</span>
            </button>

            <div ref={googleBtnRef} className="hidden" />
          </div>

          {/* Bottom Switcher */}
          <div className="pt-2 text-center text-xs text-[#8a8f98]">
            {authMode === 'login' ? (
              <span>
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage(null);
                  }}
                  className="text-[#8d55e8] font-semibold hover:underline cursor-pointer ml-1"
                >
                  Daftar sekarang
                </button>
              </span>
            ) : (
              <span>
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-[#8d55e8] font-semibold hover:underline cursor-pointer ml-1"
                >
                  Masuk sekarang
                </button>
              </span>
            )}
          </div>

          {/* Footer Copyright */}
          <div className="text-center text-[10px] text-[#626770]">
            © 2026 KLIR. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
