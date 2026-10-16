'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  LogOut,
  Building,
  Sparkles,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  DollarSign,
  Megaphone,
  Activity,
  Layers,
  LayoutDashboard,
  FileText,
  Briefcase,
  Users,
  CheckSquare,
  Zap,
  BarChart2,
  Settings as SettingsIcon,
  ChevronDown,
  ScanSearch,
  Brain,
  History,
  Sliders,
  SlidersHorizontal,
  Bell,
  Bot,
} from 'lucide-react';
import KlirLandingV4 from './components/KlirLandingV4';
import KlirPolymarketAuthModal from './components/KlirPolymarketAuthModal';
import RoleVerificationModal from './components/RoleVerificationModal';
import CompanyDataDashboard from './components/CompanyDataDashboard';
import ExecutiveAIAssistantView from './components/ExecutiveAIAssistantView';
import FinanceModuleView from './components/FinanceModuleView';
import MarketingModuleView from './components/MarketingModuleView';
import MarketingAIAssistantView from './components/MarketingAIAssistantView';

export default function HomePage() {
  // Step 0: Auth Checking Guard to prevent FOUC / Layout Flash on Refresh
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Step 1: Initial General Authentication State (Landing -> Login)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // General Logged-in User Information
  const [user, setUser] = useState<{ email: string; fullName: string } | null>(null);
  const [workspace, setWorkspace] = useState<{ id: string; name: string }>({
    id: 'f451b290-1fc6-474d-8787-b8f1121c798b',
    name: 'Anitech Workspace',
  });

  // Step 2: Role Selection & Gated Portal State
  const [verifyingRole, setVerifyingRole] = useState<'CEO' | 'FINANCE' | 'MARKETING' | null>(null);
  const [activePortal, setActivePortal] = useState<'CEO' | 'FINANCE' | 'MARKETING' | null>(null);

  // CEO 2 Clean Views: 'dashboard' | 'ai-assistant'
  const [ceoActiveNav, setCeoActiveNav] = useState<'dashboard' | 'ai-assistant'>('dashboard');

  // Marketing 2 Clean Views: 'dashboard' | 'ai-studio'
  const [marketingActiveNav, setMarketingActiveNav] = useState<'dashboard' | 'ai-studio'>('dashboard');

  // Persistent Authentication State
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('klir_persistent_auth') || sessionStorage.getItem('klir_session_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed.user?.email || parsed.email) {
          setUser(parsed.user || parsed);
          if (parsed.workspace) setWorkspace(parsed.workspace);
          setIsAuthenticated(true);
        }
      }
    } catch (e) {
      console.warn('Auth restore error:', e);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleLoginSuccess = (data: any) => {
    const loggedUser = {
      email: data.user?.email || 'nimenimasi@gmail.com',
      fullName: data.user?.fullName || 'Nime Nimasi',
    };
    const ws = data.activeWorkspace || data.workspace;
    const loggedWs = {
      id: ws?.id || 'f451b290-1fc6-474d-8787-b8f1121c798b',
      name: ws?.name || 'Anitech Workspace',
    };

    setUser(loggedUser);
    setWorkspace(loggedWs);
    setIsAuthenticated(true);
    setAuthModalOpen(false);

    const payload = JSON.stringify({ user: loggedUser, workspace: loggedWs });
    localStorage.setItem('klir_persistent_auth', payload);
    sessionStorage.setItem('klir_session_auth', payload);
  };

  const handleFullLogout = () => {
    localStorage.removeItem('klir_persistent_auth');
    sessionStorage.clear();
    setActivePortal(null);
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleExitPortalToHub = () => {
    setActivePortal(null);
  };

  // ---------------------------------------------------------------------------
  // STEP 0: SEAMLESS AUTH RESTORE LOADER
  // ---------------------------------------------------------------------------
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-screen bg-[#06080C] text-[#F5F7FA] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <img src="/Logo-KLIR.png" alt="KLIR Logo" className="h-8 w-auto object-contain animate-pulse" />
          <div className="flex items-center gap-2 text-xs text-[#8A93A3]">
            <div className="w-3.5 h-3.5 border-2 border-[#00D2FF] border-t-transparent rounded-full animate-spin" />
            <span>Memuat Sesi Aman...</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 1: IF NOT AUTHENTICATED -> RENDER LANDING PAGE WITH AUTH MODAL
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#06080C] text-[#F5F7FA] relative font-sans">
        <KlirLandingV4
          onQuickDemo={() => {
            setAuthMode('login');
            setAuthModalOpen(true);
          }}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setAuthModalOpen(true);
          }}
        />

        <KlirPolymarketAuthModal
          isOpen={authModalOpen}
          initialMode={authMode}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 2: POST-LOGIN PORTAL SELECTION (ROLE SELECTION GATEWAY HUB)
  // ---------------------------------------------------------------------------
  if (!activePortal) {
    return (
      <div className="min-h-screen w-screen bg-[#06080C] text-[#F5F7FA] flex flex-col justify-between p-6 relative overflow-hidden select-none font-sans">
        {/* Background Ambient Glows */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-radial from-[#0058BE]/20 via-transparent to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-radial from-[#3FBF8F]/15 via-transparent to-transparent blur-3xl pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full pt-2">
          <div className="flex items-center gap-3">
            <img src="/Logo-KLIR.png" alt="KLIR Logo" className="h-7 w-auto object-contain" />
            <span className="font-heading font-black text-xl tracking-wider text-white">KLIR</span>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-[#0058BE]/20 text-[#4E9BFF] rounded-full border border-[#0058BE]/40">
              BUSINESS OS
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#8A93A3] bg-white/[0.03] border border-white/10 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#3FBF8F] animate-pulse" />
              <span>{user?.email || 'nimenimasi@gmail.com'}</span>
            </div>

            <button
              onClick={handleFullLogout}
              className="px-3.5 py-1.5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-xs font-semibold text-[#8A93A3] hover:text-red-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Main Selection Deck */}
        <main className="relative z-10 max-w-4xl mx-auto w-full my-auto py-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0058BE]/15 text-[#4E9BFF] border border-[#0058BE]/30 text-xs font-mono font-semibold mb-1">
              <Building className="w-3.5 h-3.5" />
              <span>{workspace.name}</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              Pilih Divisi & Masuk dengan Otorisasi
            </h2>
            <p className="text-xs sm:text-sm text-[#8A93A3] max-w-lg mx-auto">
              Setiap divisi memiliki lapisan keamanan terisolasi. Pilih portal kerja Anda dan masukkan PIN verifikasi untuk mengakses data.
            </p>
          </div>

          {/* 3 Dedicated Role Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* 1. CEO / OWNER PORTAL */}
            <div
              onClick={() => setVerifyingRole('CEO')}
              className="bg-gradient-to-b from-[#0B101A] to-[#080B10] border border-white/10 hover:border-[#00D2FF]/60 p-6 rounded-3xl space-y-5 cursor-pointer transition-all shadow-xl hover:shadow-2xl hover:shadow-[#0058BE]/20 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0058BE]/25 border border-[#00D2FF]/40 flex items-center justify-center text-2xl shadow-lg shadow-[#0058BE]/20 group-hover:scale-105 transition-transform">
                  👑
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/30">
                    EXECUTIVE DECK
                  </span>
                  <h3 className="font-heading font-extrabold text-lg text-white mt-1.5">
                    CEO / Owner Portal
                  </h3>
                </div>
                <p className="text-xs text-[#8A93A3] leading-relaxed">
                  Pusat kendali eksekutif: Dashboard Komprehensif Perusahaan (Keuangan, Marketing, SDM, Profil) & AI Asisten Cerdas Terhubung.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#00D2FF] group-hover:translate-x-1 transition-transform">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Verifikasi & Masuk</span>
                </span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* 2. FINANCE PORTAL */}
            <div
              onClick={() => setVerifyingRole('FINANCE')}
              className="bg-gradient-to-b from-[#0B101A] to-[#080B10] border border-white/10 hover:border-[#3FBF8F]/60 p-6 rounded-3xl space-y-5 cursor-pointer transition-all shadow-xl hover:shadow-2xl hover:shadow-[#3FBF8F]/20 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#3FBF8F]/20 border border-[#3FBF8F]/40 flex items-center justify-center text-2xl shadow-lg shadow-[#3FBF8F]/20 group-hover:scale-105 transition-transform">
                  💰
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#3FBF8F]/20 text-[#3FBF8F] border border-[#3FBF8F]/30">
                    FINANCE TERMINAL
                  </span>
                  <h3 className="font-heading font-extrabold text-lg text-white mt-1.5">
                    Finance & Kas Portal
                  </h3>
                </div>
                <p className="text-xs text-[#8A93A3] leading-relaxed">
                  Operasional keuangan: Buku Kas Masuk/Keluar riil, pencatatan mutasi otomatis, penerbitan faktur invoice QRIS, dan penagihan piutang.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#3FBF8F] group-hover:translate-x-1 transition-transform">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Verifikasi & Masuk</span>
                </span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* 3. MARKETING PORTAL */}
            <div
              onClick={() => setVerifyingRole('MARKETING')}
              className="bg-gradient-to-b from-[#0B101A] to-[#080B10] border border-white/10 hover:border-[#F2A83B]/60 p-6 rounded-3xl space-y-5 cursor-pointer transition-all shadow-xl hover:shadow-2xl hover:shadow-[#F2A83B]/20 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F2A83B]/20 border border-[#F2A83B]/40 flex items-center justify-center text-2xl shadow-lg shadow-[#F2A83B]/20 group-hover:scale-105 transition-transform">
                  📣
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#F2A83B]/20 text-[#F2A83B] border border-[#F2A83B]/30">
                    GROWTH STUDIO
                  </span>
                  <h3 className="font-heading font-extrabold text-lg text-white mt-1.5">
                    Marketing & Growth
                  </h3>
                </div>
                <p className="text-xs text-[#8A93A3] leading-relaxed">
                  Pemasaran & kampanye: Studio Naskah Video & Copywriting AI, manajemen kupon diskon promo, serta pemantauan unit economics ROAS.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#F2A83B] group-hover:translate-x-1 transition-transform">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Verifikasi & Masuk</span>
                </span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 text-center text-xs text-[#5C6474] py-2">
          KLIR Business Operating System • Sesi Kerja Aman & Data Terisolasi
        </footer>

        {/* Role Security Verification Modal Popup */}
        {verifyingRole && (
          <RoleVerificationModal
            isOpen={!!verifyingRole}
            role={verifyingRole}
            onClose={() => setVerifyingRole(null)}
            onVerified={() => {
              setActivePortal(verifyingRole);
              setVerifyingRole(null);
            }}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 3: INSIDE DEDICATED VERIFIED ROLE PORTAL (FULL-VIEWPORT ARCHITECTURE)
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen w-screen bg-[#06080C] text-[#F5F7FA] font-sans flex flex-col overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* 🚀 TOP NAVBAR */}
      {/* ========================================================================= */}
      <header className="h-[60px] shrink-0 z-50 w-full bg-[#080B10] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/Logo-KLIR.png" alt="KLIR Logo" className="h-7 w-auto object-contain shrink-0" />
          <span className="font-heading font-black text-xl tracking-wider text-white">KLIR</span>
        </div>

        {/* Center: 2 Clean Navigation Items for CEO */}
        {activePortal === 'CEO' ? (
          <div className="flex items-center p-1 bg-[#0E121A] border border-white/10 rounded-xl text-xs shrink-0 shadow-sm">
            {/* 1. Dashboard Perusahaan */}
            <button
              type="button"
              onClick={() => setCeoActiveNav('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                ceoActiveNav === 'dashboard'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white shadow-md shadow-[#6366F1]/20'
                  : 'text-[#8A93A3] hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Dashboard Perusahaan</span>
            </button>

            {/* 2. AI Asisten Perusahaan */}
            <button
              type="button"
              onClick={() => setCeoActiveNav('ai-assistant')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                ceoActiveNav === 'ai-assistant'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white shadow-md shadow-[#6366F1]/20'
                  : 'text-[#8A93A3] hover:text-white hover:bg-white/5'
              }`}
            >
              <Bot className="w-4 h-4 text-[#818CF8]" />
              <span>AI Asisten Perusahaan</span>
            </button>
          </div>
        ) : activePortal === 'MARKETING' ? (
          <div className="flex items-center p-1 bg-[#0E121A] border border-white/10 rounded-xl text-xs shrink-0 shadow-sm">
            {/* 1. Dashboard Marketing */}
            <button
              type="button"
              onClick={() => setMarketingActiveNav('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                marketingActiveNav === 'dashboard'
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/20'
                  : 'text-[#8A93A3] hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>1. Dashboard Marketing</span>
            </button>

            {/* 2. AI Asisten Gambar & Video */}
            <button
              type="button"
              onClick={() => setMarketingActiveNav('ai-studio')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                marketingActiveNav === 'ai-studio'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white shadow-md shadow-[#6366F1]/20'
                  : 'text-[#8A93A3] hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#A5B4FC]" />
              <span>2. AI Asisten Gambar & Video</span>
            </button>
          </div>
        ) : null}

        {/* Right Side: User Profile & Portal Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            onClick={handleExitPortalToHub}
            className="flex items-center gap-2 bg-[#0E121A] hover:bg-[#141820] border border-white/10 pl-1.5 pr-2.5 py-1 rounded-xl cursor-pointer transition-all shadow-xs"
            title="Klik untuk Ganti Divisi / Keluar"
          >
            <div className="w-6 h-6 rounded-lg bg-[#0058BE]/30 border border-[#00D2FF]/40 flex items-center justify-center text-xs font-bold shrink-0">
              👑
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="font-bold text-xs text-white leading-none">
                {user?.fullName || 'Nime Nimasi'}
              </span>
              <span className="text-[9px] text-[#8A93A3] mt-0.5">
                {activePortal === 'CEO' ? 'CEO / Owner' : `${activePortal} Access`}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[#8A93A3]" />
          </div>

          <button
            onClick={handleExitPortalToHub}
            className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[#8A93A3] hover:text-white transition-all cursor-pointer"
            title="Ganti Portal Divisi"
          >
            <ArrowLeft className="w-4 h-4 text-[#4E9BFF]" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN FULL-VIEWPORT CONTAINER (FILLS 100% OF REMAINING SCREEN) */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full h-[calc(100vh-60px)] bg-[#06080C] overflow-hidden">
        {/* VIEW: CEO PORTAL */}
        {activePortal === 'CEO' && (
          <>
            {ceoActiveNav === 'dashboard' && (
              <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
                <CompanyDataDashboard
                  workspaceName={workspace.name}
                  userName={user?.fullName || 'Nime Nimasi'}
                />
              </div>
            )}
            {ceoActiveNav === 'ai-assistant' && (
              <div className="w-full h-full p-2 sm:p-3 overflow-hidden">
                <ExecutiveAIAssistantView
                  workspaceName={workspace.name}
                  userName={user?.fullName || 'Nime Nimasi'}
                />
              </div>
            )}
          </>
        )}

        {/* VIEW: FINANCE PORTAL */}
        {activePortal === 'FINANCE' && (
          <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
            <FinanceModuleView
              workspaceId={workspace.id}
              workspaceName={workspace.name}
            />
          </div>
        )}

        {/* VIEW: MARKETING PORTAL */}
        {activePortal === 'MARKETING' && (
          <>
            {marketingActiveNav === 'dashboard' && (
              <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
                <MarketingModuleView
                  workspaceId={workspace.id}
                  workspaceName={workspace.name}
                />
              </div>
            )}
            {marketingActiveNav === 'ai-studio' && (
              <div className="w-full h-full p-2 sm:p-3 overflow-hidden">
                <MarketingAIAssistantView
                  workspaceName={workspace.name}
                  userName={user?.fullName || 'Nime Nimasi'}
                  onDeployCampaign={() => {
                    setMarketingActiveNav('dashboard');
                  }}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
