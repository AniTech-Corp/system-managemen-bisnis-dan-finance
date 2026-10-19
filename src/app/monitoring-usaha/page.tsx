'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  Bot,
  Building,
  ChevronDown,
  CheckCircle2,
  ArrowLeft,
  Wallet,
  RefreshCw,
  Activity,
  ShieldCheck,
  User,
  Bell,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import CompanyDataDashboard from '../components/CompanyDataDashboard';
import MonitoringDashboard from '../components/v0/MonitoringDashboard';
import ModernAICopilotView from '../components/v0/ModernAICopilotView';
import ExecutiveAIAssistantView from '../components/ExecutiveAIAssistantView';
import { CEOSettingsModal } from '../components/settings/CEOSettingsModal';
import CEOApprovalModal from '../components/notifications/CEOApprovalModal';
import type { ApprovalRequest } from '@/lib/security-guardrail';
import { writeInitialPrompt } from '@/lib/initial-prompt-storage';
import { DEFAULT_ENABLED_MODULES } from '@/lib/module-guard';

const DEFAULT_WORKSPACE = {
  id: 'a1000000-0000-0000-0000-000000000001',
  name: 'Anitech Enterprise',
  enabledModules: DEFAULT_ENABLED_MODULES,
};

const DEFAULT_USER = {
  email: 'admin@anitech.id',
  fullName: 'Executive Lead',
};

export default function MonitoringUsahaStandalonePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-assistant'>('dashboard');
  const [isReady, setIsReady] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);

  const [user, setUser] = useState<{ email: string; fullName: string }>(DEFAULT_USER);
  const [workspace, setWorkspace] = useState<{ id: string; name: string; enabledModules?: string[] }>(DEFAULT_WORKSPACE);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<{ id: string; name: string; enabledModules?: string[] }>>([]);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  const fetchPendingApprovals = useCallback(async (targetWsId?: string) => {
    try {
      const wsId = targetWsId || workspace?.id;
      if (!wsId) return;
      const res = await fetch(`/api/v1/security/approvals?workspaceId=${encodeURIComponent(wsId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPendingApprovals(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch (err) {
      console.warn('[MonitoringUsahaPage] Non-fatal pending approvals fetch error:', err);
    }
  }, [workspace?.id]);

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
      const savedTab = localStorage.getItem('klir_monitoring_standalone_tab');
      if (savedTab === 'dashboard' || savedTab === 'ai-assistant') {
        setActiveTab(savedTab);
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
              const enriched = {
                id: data.activeWorkspace.id || workspace.id,
                name: data.activeWorkspace.name || workspace.name,
                enabledModules: Array.isArray(data.activeWorkspace.enabledModules) && data.activeWorkspace.enabledModules.length > 0
                  ? data.activeWorkspace.enabledModules
                  : DEFAULT_ENABLED_MODULES,
              };
              setWorkspace(enriched);
              void fetchPendingApprovals(enriched.id);
            }
          }
        } catch (syncErr) {
          console.warn('[MonitoringUsahaPage] Auth sync fallback:', syncErr);
        }
      })();
    } catch (err) {
      console.warn('[MonitoringUsahaPage] Auth initialization error:', err);
    } finally {
      setIsReady(true);
    }
  }, [fetchPendingApprovals]);

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

  // Polling for approvals
  useEffect(() => {
    if (workspace?.id) {
      fetchPendingApprovals(workspace.id);
      const pollTimer = setInterval(() => fetchPendingApprovals(workspace.id), 20000);
      return () => clearInterval(pollTimer);
    }
  }, [workspace?.id, fetchPendingApprovals]);

  const handleSwitchTab = (tab: 'dashboard' | 'ai-assistant') => {
    setActiveTab(tab);
    localStorage.setItem('klir_monitoring_standalone_tab', tab);
  };

  const handleSwitchWorkspace = (ws: { id: string; name: string; enabledModules?: string[] }) => {
    setWorkspace(ws);
    setWorkspaceDropdownOpen(false);
    localStorage.setItem('klir_active_workspace_id', ws.id);
    const payload = JSON.stringify({ user, workspace: ws });
    localStorage.setItem('klir_persistent_auth', payload);
    sessionStorage.setItem('klir_session_auth', payload);

    void fetchPendingApprovals(ws.id);
    window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    window.dispatchEvent(new CustomEvent('klir-marketing-updated'));
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchPendingApprovals(workspace.id);
    window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    window.dispatchEvent(new CustomEvent('klir-marketing-updated'));
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  }, [workspace.id, fetchPendingApprovals]);

  const handleOpenAIWithPrompt = (prompt: string) => {
    if (prompt) writeInitialPrompt('CEO', prompt);
    handleSwitchTab('ai-assistant');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-sky-600 animate-spin" />
          <span className="font-heading text-sm text-slate-500 tracking-wide">Memuat Monitoring Usaha KLIR...</span>
        </div>
      </div>
    );
  }

  if (activeTab === 'ai-assistant') {
    return (
      <div className="h-screen w-full max-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden font-sans">
        <ModernAICopilotView
          mode="EXECUTIVE"
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
    <MonitoringDashboard
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userName={user.fullName}
      initialTab="overview"
      onOpenAI={handleOpenAIWithPrompt}
    />
  );
}
