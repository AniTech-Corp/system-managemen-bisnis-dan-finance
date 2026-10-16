'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Bot,
  Building,
  ChevronDown,
  CheckCircle2,
  Wallet,
  RefreshCw,
  Activity,
  ShieldCheck,
  User,
  Bell,
  SlidersHorizontal,
  TrendingUp,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';

import CompanyDataDashboard from './components/CompanyDataDashboard';
import ExecutiveAIAssistantView from './components/ExecutiveAIAssistantView';
import FinanceModuleView from './components/FinanceModuleView';
import FinanceAIAssistantView from './components/FinanceAIAssistantView';

import { CEOSettingsModal } from './components/settings/CEOSettingsModal';
import { FinanceSettingsModal } from './components/settings/FinanceSettingsModal';
import CEOApprovalModal from './components/notifications/CEOApprovalModal';
import type { ApprovalRequest } from '@/lib/security-guardrail';
import { writeInitialPrompt } from '@/lib/initial-prompt-storage';
import { DEFAULT_ENABLED_MODULES } from '@/lib/module-guard';

const DEFAULT_FINANCE_MONITORING_MODULES = ['finance', 'corplan', 'analytics', 'dashboard'];

const DEFAULT_WORKSPACE = {
  id: 'f451b290-1fc6-474d-8787-b8f1121c798b',
  name: 'KLIR Workspace',
  enabledModules: DEFAULT_FINANCE_MONITORING_MODULES,
};

const DEFAULT_USER = {
  email: 'admin@klir.id',
  fullName: 'Owner / Executive Lead',
};

export default function UnifiedFinanceMonitoringHub() {
  // Top-level module: 'monitoring' (Monitoring Usaha) vs 'finance' (Sistem Finance)
  const [activeModule, setActiveModule] = useState<'monitoring' | 'finance'>('monitoring');
  // Sub-view: 'dashboard' vs 'ai-assistant'
  const [viewMode, setViewMode] = useState<'dashboard' | 'ai-assistant'>('dashboard');

  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);

  const [user, setUser] = useState<{ email: string; fullName: string }>(DEFAULT_USER);
  const [workspace, setWorkspace] = useState<{ id: string; name: string; enabledModules?: string[] }>(DEFAULT_WORKSPACE);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<{ id: string; name: string; enabledModules?: string[] }>>([]);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // Restore state from storage on mount
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('klir_persistent_auth') || sessionStorage.getItem('klir_session_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        const userObj = parsed.user || parsed;
        const wsObj = parsed.workspace || DEFAULT_WORKSPACE;

        if (userObj?.fullName) {
          setUser({
            email: userObj.email || DEFAULT_USER.email,
            fullName: userObj.fullName,
          });
        }
        if (wsObj?.id) {
          setWorkspace({
            id: wsObj.id,
            name: wsObj.name || DEFAULT_WORKSPACE.name,
            enabledModules: Array.isArray(wsObj.enabledModules) ? wsObj.enabledModules : DEFAULT_ENABLED_MODULES,
          });
        }
      }

      const savedModule = localStorage.getItem('klir_hub_active_module');
      if (savedModule === 'monitoring' || savedModule === 'finance') {
        setActiveModule(savedModule);
      }

      const savedView = localStorage.getItem('klir_hub_view_mode');
      if (savedView === 'dashboard' || savedView === 'ai-assistant') {
        setViewMode(savedView);
      }

      // Silent auth sync
      (async () => {
        try {
          const activeWsId = localStorage.getItem('klir_active_workspace_id') || workspace.id;
          const meUrl = activeWsId ? `/api/v1/auth/me?workspaceId=${encodeURIComponent(activeWsId)}` : '/api/v1/auth/me';
          const res = await fetch(meUrl, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data?.tokens?.accessToken) {
              localStorage.setItem('klir_token', data.tokens.accessToken);
            }
            if (Array.isArray(data?.workspaces) && data.workspaces.length > 0) {
              setAvailableWorkspaces(data.workspaces);
            }
            if (data?.activeWorkspace) {
              setWorkspace((prev) => ({
                id: data.activeWorkspace.id || prev.id,
                name: data.activeWorkspace.name || prev.name,
                enabledModules: Array.isArray(data.activeWorkspace.enabledModules) && data.activeWorkspace.enabledModules.length > 0
                  ? data.activeWorkspace.enabledModules
                  : prev.enabledModules,
              }));
            }
          }
        } catch (syncErr) {
          console.warn('[Hub] Auth sync fallback:', syncErr);
        }
      })();
    } catch (err) {
      console.warn('[Hub] Auth init err:', err);
    } finally {
      setIsReady(true);
    }
  }, []);

  // Fetch approvals for Monitoring Usaha
  const fetchPendingApprovals = useCallback(async (wsId: string) => {
    try {
      const res = await fetch(`/api/v1/corplan/approvals?workspaceId=${encodeURIComponent(wsId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.approvals)) {
          setPendingApprovals(data.approvals);
        }
      }
    } catch (err) {
      console.warn('[Hub] Fetch approvals error:', err);
    }
  }, []);

  useEffect(() => {
    if (workspace.id) {
      void fetchPendingApprovals(workspace.id);
    }
  }, [workspace.id, fetchPendingApprovals]);

  // Dropdown outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(e.target as Node)) {
        setWorkspaceDropdownOpen(false);
      }
    };
    if (workspaceDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [workspaceDropdownOpen]);

  const handleSwitchModule = (mod: 'monitoring' | 'finance') => {
    setActiveModule(mod);
    localStorage.setItem('klir_hub_active_module', mod);
  };

  const handleSwitchView = (mode: 'dashboard' | 'ai-assistant') => {
    setViewMode(mode);
    localStorage.setItem('klir_hub_view_mode', mode);
  };

  const handleOpenAIWithPrompt = (promptText: string) => {
    const role = activeModule === 'monitoring' ? 'CEO' : 'FINANCE';
    writeInitialPrompt(role, promptText);
    handleSwitchView('ai-assistant');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPendingApprovals(workspace.id);
      window.dispatchEvent(new CustomEvent('klir_refresh_brain'));
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#07090E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-400 font-mono tracking-wider">MEMUAT SISTEM KLIR...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* 🌟 MASTER EXECUTIVE HEADER */}
      <header
        className="w-full h-16 border-b border-white/[0.08] px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 23, 0.95) 0%, rgba(7, 9, 14, 0.90) 100%)',
        }}
      >
        {/* Brand & Module Selector */}
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white font-['Outfit']">KLIR</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  SYSTEM HUB
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">Finance & Monitoring Usaha</p>
            </div>
          </div>

          {/* Module Switcher Tabs (Monitoring Usaha vs Finance) */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <button
              onClick={() => handleSwitchModule('monitoring')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeModule === 'monitoring'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={14} />
              <span>Monitoring Usaha</span>
            </button>

            <button
              onClick={() => handleSwitchModule('finance')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeModule === 'finance'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wallet size={14} />
              <span>Sistem Finance</span>
            </button>
          </div>
        </div>

        {/* Center Sub-nav: Dashboard vs AI Assistant */}
        <div className="hidden lg:flex items-center p-1 rounded-lg bg-black/40 border border-white/[0.06]">
          <button
            onClick={() => handleSwitchView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === 'dashboard'
                ? 'bg-white/10 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={13} />
            <span>Dashboard Data</span>
          </button>
          <button
            onClick={() => handleSwitchView('ai-assistant')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === 'ai-assistant'
                ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-300 border border-emerald-500/30 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot size={13} className="text-emerald-400" />
            <span>AI Assistant {activeModule === 'monitoring' ? 'CEO' : 'Finance'}</span>
          </button>
        </div>

        {/* Right Tools & User Info */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile view switcher */}
          <div className="flex lg:hidden items-center p-0.5 rounded bg-white/[0.05] border border-white/10">
            <button
              onClick={() => handleSwitchView('dashboard')}
              className={`p-1.5 rounded ${viewMode === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400'}`}
              title="Dashboard"
            >
              <LayoutDashboard size={14} />
            </button>
            <button
              onClick={() => handleSwitchView('ai-assistant')}
              className={`p-1.5 rounded ${viewMode === 'ai-assistant' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}
              title="AI Assistant"
            >
              <Bot size={14} />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 transition-all hover:text-white"
            title="Refresh Data & Brain"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
          </button>

          {/* Pending Approvals (for Monitoring) */}
          {activeModule === 'monitoring' && pendingApprovals.length > 0 && (
            <button
              onClick={() => setApprovalModalOpen(true)}
              className="relative p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all"
              title="Pending CEO Approvals"
            >
              <Bell size={14} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 transition-all hover:text-white"
            title="Pengaturan Module"
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* User Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-sm">
              <User size={13} />
            </div>
            <span className="text-xs font-semibold text-slate-200 hidden sm:block font-['Outfit']">
              {user.fullName}
            </span>
          </div>
        </div>
      </header>

      {/* 🚀 MAIN CONTENT VIEW AREA */}
      <main className="flex-1 w-full flex flex-col overflow-hidden relative">
        {activeModule === 'monitoring' ? (
          /* MODULE 1: MONITORING USAHA */
          viewMode === 'dashboard' ? (
            <div className="w-full flex-1 flex flex-col overflow-y-auto">
              <CompanyDataDashboard
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                userName={user.fullName}
                activeNav="dashboard"
                onNavChange={(nav) => {
                  if (nav === 'ai-assistant') handleSwitchView('ai-assistant');
                }}
                onOpenAI={handleOpenAIWithPrompt}
                enabledModules={workspace.enabledModules}
              />
            </div>
          ) : (
            <div className="w-full flex-1 overflow-hidden">
              <ExecutiveAIAssistantView
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                userName={user.fullName}
                portalRole="CEO"
                onRoleChange={() => handleSwitchView('dashboard')}
              />
            </div>
          )
        ) : (
          /* MODULE 2: SISTEM FINANCE */
          viewMode === 'dashboard' ? (
            <div className="w-full flex-1 overflow-y-auto" style={{ padding: '24px 32px' }}>
              <FinanceModuleView
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                onOpenAI={handleOpenAIWithPrompt}
                onRefreshBrain={handleRefresh}
              />
            </div>
          ) : (
            <div className="w-full flex-1 overflow-hidden">
              <FinanceAIAssistantView
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                userName={user.fullName}
                onRoleChange={() => handleSwitchView('dashboard')}
              />
            </div>
          )
        )}
      </main>

      {/* MODALS */}
      {/* CEO Approvals Modal */}
      {approvalModalOpen && (
        <CEOApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => {
            setApprovalModalOpen(false);
            void fetchPendingApprovals(workspace.id);
          }}
          workspaceId={workspace.id}
          approvals={pendingApprovals}
          isLoading={isRefreshing}
          onRefresh={() => void fetchPendingApprovals(workspace.id)}
        />
      )}

      {/* Settings Modal (CEO or Finance dynamically) */}
      {settingsModalOpen && (
        activeModule === 'monitoring' ? (
          <CEOSettingsModal
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            workspaceId={workspace.id}
          />
        ) : (
          <FinanceSettingsModal
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            workspaceId={workspace.id}
          />
        )
      )}
    </div>
  );
}
