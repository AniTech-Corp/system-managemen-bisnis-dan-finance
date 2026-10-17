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
import FinanceAIAssistantView from '../components/FinanceAIAssistantView';
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

  const [user, setUser] = useState<{ email: string; fullName: string }>(DEFAULT_USER);
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
      <div className="min-h-screen bg-[#06080C] text-[#F5F7FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#3FBF8F] animate-spin" />
          <span className="font-heading text-sm text-[#8A93A3] tracking-wide">Memuat Sistem Finance KLIR...</span>
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
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} title="Kembali ke Portal Sistem">
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #3FBF8F 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(63, 191, 143, 0.4)' }}>
              <Sparkles size={15} color="#FFFFFF" />
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 800, letterSpacing: '0.08em', color: '#F5F7FA' }}>
              ANITECH
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
                background: 'rgba(63, 191, 143, 0.12)',
                border: '1px solid rgba(63, 191, 143, 0.28)',
                color: '#3FBF8F',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Wallet size={10} color="#3FBF8F" />
              SISTEM FINANCE
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
              <Building size={13} color="#3FBF8F" />
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
                      background: ws.id === workspace.id ? 'rgba(63, 191, 143, 0.12)' : 'transparent',
                      color: ws.id === workspace.id ? '#3FBF8F' : '#E2E8F0',
                      fontSize: '12px',
                      fontWeight: ws.id === workspace.id ? 600 : 400,
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                    {ws.id === workspace.id && <CheckCircle2 size={13} color="#3FBF8F" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Clean 2-Way View Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px', background: '#0B0E14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px' }}>
          {/* Tab 1: Dashboard Keuangan */}
          <button
            type="button"
            onClick={() => handleSwitchTab('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: '5px',
              background: activeTab === 'dashboard' ? 'rgba(63, 191, 143, 0.14)' : 'transparent',
              border: '1px solid ' + (activeTab === 'dashboard' ? 'rgba(63, 191, 143, 0.28)' : 'transparent'),
              color: activeTab === 'dashboard' ? '#F5F7FA' : '#8A93A3',
              fontSize: '12px',
              fontWeight: activeTab === 'dashboard' ? 600 : 500,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutDashboard className={`w-3.5 h-3.5 ${activeTab === 'dashboard' ? 'text-[#3FBF8F]' : ''}`} />
            <span>Dashboard Keuangan &amp; Kas</span>
          </button>

          {/* Tab 2: AI Asisten Keuangan */}
          <button
            type="button"
            onClick={() => handleSwitchTab('ai-assistant')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: '5px',
              background: activeTab === 'ai-assistant' ? 'rgba(63, 191, 143, 0.14)' : 'transparent',
              border: '1px solid ' + (activeTab === 'ai-assistant' ? 'rgba(63, 191, 143, 0.28)' : 'transparent'),
              color: activeTab === 'ai-assistant' ? '#F5F7FA' : '#8A93A3',
              fontSize: '12px',
              fontWeight: activeTab === 'ai-assistant' ? 600 : 500,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
          >
            <Bot className="w-3.5 h-3.5 text-[#3FBF8F]" />
            <span>AI Asisten Keuangan</span>
          </button>
        </div>

        {/* Right Side: Cross-Navigation, Refresh & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
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
            title="Muat ulang data transaksi kas & laporan keuangan"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#3FBF8F]' : ''}`} />
            <span className="hidden sm:inline">Segarkan Data</span>
          </button>

          {/* Quick Cross-Link: Monitoring Usaha */}
          <Link
            href="/monitoring"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              color: '#38BDF8',
              fontSize: '11.5px',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.15s ease',
            }}
            title="Buka Sistem Monitoring Usaha"
          >
            <TrendingUp size={12} color="#38BDF8" />
            <span>Monitoring Usaha →</span>
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
            title="Pengaturan Divisi Finance"
          >
            <SlidersHorizontal size={13} />
          </button>

          {/* Portal Exit Link */}
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
            title="Kembali ke Portal 2 Sistem"
          >
            <ArrowLeft size={12} />
            <span className="hidden md:inline">Portal</span>
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
                background: 'linear-gradient(135deg, #3FBF8F 0%, #15803d 100%)',
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
              onRoleChange={() => handleSwitchTab('dashboard')}
            />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {settingsModalOpen && (
        <FinanceSettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          workspaceId={workspace.id}
        />
      )}
    </div>
  );
}
