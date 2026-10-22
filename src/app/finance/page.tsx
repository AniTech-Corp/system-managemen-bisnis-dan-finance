'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Bot,
  Building,
  ChevronDown,
  CheckCircle2,
  ArrowLeft,
  TrendingUp,
  RefreshCw,
  Wallet,
  ShieldCheck,
  User,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import FinanceModuleView from '../components/FinanceModuleView';
import ModernAICopilotView from '../components/v0/ModernAICopilotView';
import FinanceDashboard from '../components/v0/FinanceDashboard';
import { FinanceSettingsModal } from '../components/settings/FinanceSettingsModal';
import { writeInitialPrompt } from '@/lib/initial-prompt-storage';
import { DEFAULT_ENABLED_MODULES } from '@/lib/module-guard';

const DEFAULT_WORKSPACE = {
  id: 'a1000000-0000-0000-0000-000000000001',
  name: 'Anitech Enterprise',
  enabledModules: DEFAULT_ENABLED_MODULES,
};

const DEFAULT_USER = {
  email: 'finance@anitech.id',
  fullName: 'Finance Lead',
};

export default function FinanceStandalonePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-assistant'>('dashboard');
  const [isReady, setIsReady] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [user, setUser] = useState<{ email: string; fullName: string; role?: string; id?: string }>(DEFAULT_USER);
  const [workspace, setWorkspace] = useState<{ id: string; name: string; enabledModules?: string[] }>(DEFAULT_WORKSPACE);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<{ id: string; name: string; enabledModules?: string[] }>>([]);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // Restore auth, token, and workspace on mount
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
            role: userObj.role || userObj.membership?.role,
            id: userObj.id || userObj.userId,
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

      // Restore active sub-nav if previously chosen
      const savedTab = localStorage.getItem('klir_finance_standalone_tab');
      if (savedTab === 'dashboard' || savedTab === 'ai-assistant') {
        setActiveTab(savedTab);
      }

      // Check URL query params for direct AI view
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('view') === 'ai' || urlParams.get('tab') === 'ai' || urlParams.get('tab') === 'ai-lead') {
        setActiveTab('ai-assistant');
      }

      // Silent sync with auth/me
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
            if (data?.user) {
              setUser(prev => ({
                ...prev,
                role: data.user.role || data.user.membership?.role,
                id: data.user.id,
              }));
            }
          }
        } catch (syncErr) {
          console.warn('[FinancePage] Auth sync fallback:', syncErr);
        }
      })();
    } catch (err) {
      console.warn('[FinancePage] Auth initialization error:', err);
    } finally {
      setIsReady(true);
    }
  }, []);

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

  const handleSwitchTab = (tab: 'dashboard' | 'ai-assistant') => {
    setActiveTab(tab);
    localStorage.setItem('klir_finance_standalone_tab', tab);
  };

  const handleSwitchWorkspace = (ws: { id: string; name: string; enabledModules?: string[] }) => {
    setWorkspace(ws);
    setWorkspaceDropdownOpen(false);
    localStorage.setItem('klir_active_workspace_id', ws.id);
    const payload = JSON.stringify({ user, workspace: ws });
    localStorage.setItem('klir_persistent_auth', payload);
    sessionStorage.setItem('klir_session_auth', payload);

    window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  }, []);

  const handleOpenAIWithPrompt = (prompt: string) => {
    writeInitialPrompt('FINANCE', prompt);
    handleSwitchTab('ai-assistant');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
          <span className="font-heading text-sm text-slate-500 tracking-wide">Memuat Sistem Finance KLIR...</span>
        </div>
      </div>
    );
  }

  if (activeTab === 'ai-assistant') {
    return (
      <div className="h-screen w-full max-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden font-sans">
        <ModernAICopilotView
          mode="FINANCE"
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          userName={user.fullName}
          onClose={() => handleSwitchTab('dashboard')}
          onNavigateTab={() => handleSwitchTab('dashboard')}
        />
      </div>
    );
  }

  return (
    <FinanceDashboard
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userName={user.fullName}
      initialTab="cashflow"
      onOpenAI={handleOpenAIWithPrompt}
      userRole={user.role || 'MEMBER'}
      userId={user.id || ''}
    />
  );
}
