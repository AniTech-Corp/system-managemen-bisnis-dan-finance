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
} from 'lucide-react';
import CompanyDataDashboard from '../components/CompanyDataDashboard';
import ExecutiveAIAssistantView from '../components/ExecutiveAIAssistantView';
import { CEOSettingsModal } from '../components/settings/CEOSettingsModal';
import CEOApprovalModal from '../components/notifications/CEOApprovalModal';
import type { ApprovalRequest } from '@/lib/security-guardrail';
import { writeInitialPrompt } from '@/lib/initial-prompt-storage';
import { DEFAULT_ENABLED_MODULES } from '@/lib/module-guard';

const DEFAULT_WORKSPACE = {
  id: 'f451b290-1fc6-474d-8787-b8f1121c798b',
  name: 'KLIR Workspace',
  enabledModules: DEFAULT_ENABLED_MODULES,
};

const DEFAULT_USER = {
  email: 'admin@klir.id',
  fullName: 'Owner / CEO',
};

export default function MonitoringUsahaStandalonePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-assistant'>('dashboard');
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
      <div className="min-h-screen bg-[#06080C] text-[#F5F7FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#4E9BFF] animate-spin" />
          <span className="font-heading text-sm text-[#8A93A3] tracking-wide">Memuat Monitoring Usaha KLIR...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#06080C] text-[#F5F7FA] flex flex-col overflow-hidden font-sans">
      {/* 🚀 TOP ENTERPRISE NAVBAR */}
      <header
        className="sap-shell-bar"
        style={{
          height: '56px',
          flex: '0 0 56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '0 20px',
          background: '#080B10',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 50,
          boxSizing: 'border-box',
        }}
      >
        {/* Left Side: Brand Logo, Module Badge & Workspace Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} title="Kembali ke Beranda KLIR">
            <img
              src="/Logo-KLIR.png"
              alt="KLIR"
              width={20}
              height={20}
              style={{ display: 'block', filter: 'drop-shadow(0 0 8px rgba(78, 155, 255, 0.45))' }}
            />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 800, letterSpacing: '0.08em', color: '#F5F7FA' }}>
              KLIR
            </span>
          </Link>

          {/* Module Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(78, 155, 255, 0.12)',
                border: '1px solid rgba(78, 155, 255, 0.28)',
                color: '#8CBEFF',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Activity size={10} color="#4E9BFF" />
              MONITORING USAHA
            </span>
          </div>

          {/* Workspace Pill / Switcher */}
          <div ref={workspaceDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                if (availableWorkspaces.length > 1) {
                  setWorkspaceDropdownOpen((prev) => !prev);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#E2E8F0',
                fontSize: '12px',
                fontWeight: 600,
                cursor: availableWorkspaces.length > 1 ? 'pointer' : 'default',
                fontFamily: "'Outfit', sans-serif",
                maxWidth: '220px',
                transition: 'all 0.15s ease',
              }}
              title={availableWorkspaces.length > 1 ? 'Klik untuk beralih workspace' : `Workspace: ${workspace.name}`}
            >
              <Building size={13} color="#4E9BFF" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspace.name || 'KLIR Workspace'}
              </span>
              {availableWorkspaces.length > 1 && (
                <ChevronDown
                  size={12}
                  color="#8A93A3"
                  style={{
                    transform: workspaceDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              )}
            </button>

            {workspaceDropdownOpen && availableWorkspaces.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  width: '240px',
                  background: '#0D1117',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                  padding: '5px',
                  zIndex: 100,
                }}
              >
                <div style={{ padding: '6px 8px', fontSize: '10.5px', color: '#8A93A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pilih Workspace
                </div>
                {availableWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSwitchWorkspace(ws)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: ws.id === workspace.id ? 'rgba(78, 155, 255, 0.12)' : 'transparent',
                      color: ws.id === workspace.id ? '#4E9BFF' : '#E2E8F0',
                      fontSize: '12px',
                      fontWeight: ws.id === workspace.id ? 600 : 400,
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                    {ws.id === workspace.id && <CheckCircle2 size={13} color="#4E9BFF" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Clean 2-Way View Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px', background: '#0B0E14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px' }}>
          {/* Tab 1: Dashboard Monitoring Usaha */}
          <button
            type="button"
            onClick={() => handleSwitchTab('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: '5px',
              background: activeTab === 'dashboard' ? 'rgba(78, 155, 255, 0.14)' : 'transparent',
              border: '1px solid ' + (activeTab === 'dashboard' ? 'rgba(78, 155, 255, 0.28)' : 'transparent'),
              color: activeTab === 'dashboard' ? '#F5F7FA' : '#8A93A3',
              fontSize: '12px',
              fontWeight: activeTab === 'dashboard' ? 600 : 500,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart2 className={`w-3.5 h-3.5 ${activeTab === 'dashboard' ? 'text-[#4E9BFF]' : ''}`} />
            <span>Dashboard Pemantau Usaha</span>
          </button>

          {/* Tab 2: AI Asisten Eksekutif */}
          <button
            type="button"
            onClick={() => handleSwitchTab('ai-assistant')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: '5px',
              background: activeTab === 'ai-assistant' ? 'rgba(78, 155, 255, 0.14)' : 'transparent',
              border: '1px solid ' + (activeTab === 'ai-assistant' ? 'rgba(78, 155, 255, 0.28)' : 'transparent'),
              color: activeTab === 'ai-assistant' ? '#F5F7FA' : '#8A93A3',
              fontSize: '12px',
              fontWeight: activeTab === 'ai-assistant' ? 600 : 500,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
          >
            <Bot className="w-3.5 h-3.5 text-[#4E9BFF]" />
            <span>AI Asisten Eksekutif</span>
          </button>
        </div>

        {/* Right Side: Approvals, Cross-Navigation, Refresh & User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          {/* Bell Notification for Approvals */}
          <button
            type="button"
            onClick={() => {
              void fetchPendingApprovals();
              setApprovalModalOpen(true);
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: pendingApprovals.length > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(255, 255, 255, 0.04)',
              border: pendingApprovals.length > 0 ? '1px solid rgba(239, 68, 68, 0.38)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: pendingApprovals.length > 0 ? '#F87171' : '#8A93A3',
              cursor: 'pointer',
            }}
            title={pendingApprovals.length > 0 ? `${pendingApprovals.length} persetujuan pengeluaran pending` : 'Pusat Otorisasi Eksekutif (Semua aman)'}
          >
            <Bell className="w-3.5 h-3.5" />
            {pendingApprovals.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  minWidth: '15px',
                  height: '15px',
                  borderRadius: '10px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)',
                }}
              >
                {pendingApprovals.length}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#8A93A3',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: isRefreshing ? 'wait' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
            title="Segarkan metrik data bisnis & performa"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#4E9BFF]' : ''}`} />
            <span className="hidden sm:inline">Segarkan Data</span>
          </button>

          {/* Quick Cross-Link: Sistem Finance */}
          <Link
            href="/finance"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '6px',
              background: 'rgba(63, 191, 143, 0.08)',
              border: '1px solid rgba(63, 191, 143, 0.24)',
              color: '#3FBF8F',
              fontSize: '11.5px',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
            title="Buka Halaman Sistem Finance"
          >
            <Wallet size={12} color="#3FBF8F" />
            <span>Sistem Finance</span>
          </Link>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#8A93A3',
              cursor: 'pointer',
            }}
            title="Pengaturan Direksi & Target Perusahaan"
          >
            <SlidersHorizontal size={13} />
          </button>

          {/* Hub Exit Link */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#8A93A3',
              fontSize: '11.5px',
              textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif",
            }}
            title="Kembali ke Beranda Hub KLIR"
          >
            <ArrowLeft size={12} />
            <span className="hidden md:inline">Hub Utama</span>
          </Link>

          {/* User Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4E9BFF 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={10} color="#FFFFFF" />
            </div>
            <span style={{ fontSize: '11px', color: '#E2E8F0', fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>
              {user.fullName}
            </span>
          </div>
        </div>
      </header>

      {/* 🚀 MAIN CONTENT VIEW AREA */}
      <main className="flex-1 w-full flex flex-col overflow-hidden relative">
        {activeTab === 'dashboard' ? (
          <div className="w-full flex-1 flex flex-col overflow-y-auto">
            <CompanyDataDashboard
              workspaceId={workspace.id}
              workspaceName={workspace.name}
              userName={user.fullName}
              activeNav="dashboard"
              onNavChange={(nav) => {
                if (nav === 'ai-assistant') handleSwitchTab('ai-assistant');
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
              onRoleChange={() => handleSwitchTab('dashboard')}
            />
          </div>
        )}
      </main>

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

      {/* CEO Settings Modal */}
      {settingsModalOpen && (
        <CEOSettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          workspaceId={workspace.id}
        />
      )}
    </div>
  );
}
