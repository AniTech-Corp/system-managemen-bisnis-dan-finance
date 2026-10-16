'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, X } from 'lucide-react';
import {
  collectProactiveAlerts,
  dismissStorageKey,
  mergeAndRank,
  pruneDismissed,
  type DismissRecord,
  type ProactiveAlert,
  type ProactiveRole,
} from '@/lib/ai-brain/proactive-alerts';
import { INVENTORY_AI_PROMPT } from '@/lib/ai-brain/inventory-product-command';

// ProactiveAlertsPanel -- panel "Perlu perhatian" di atas area chat AI Assistant
// (F2 kontrak Tingkat B, 10 Sep 2026). Ini WADAH reusable: sumber peringatan datang dari
// registry PROACTIVE_SOURCES di src/lib/ai-brain/proactive-alerts.ts; komponen ini tidak
// tahu-menahu isi sumbernya. Dipasang 1 baris di Executive + Finance AI Assistant (dan
// nanti Marketing kalau ada keputusan akses). Tidak render apa pun kalau 0 kartu -- tidak
// ada kotak kosong yang bikin berisik. Dismiss per kartu disimpan di localStorage
// ter-namespace per role + workspaceId (pola E Fatur), kadaluarsa 24 jam.
// Refresh: saat mount, saat event 'klir-inventory-updated' dan 'klir-ai-state-updated'.

export interface ProactiveAlertsPanelProps {
  role: ProactiveRole;
  workspaceId: string;
  onOpenInventory?: () => void;
  onOpenDashboard?: () => void;
  /** Mengisi composer dengan prompt siap kirim. TIDAK auto-kirim -- user yang menekan kirim. */
  onAskAI?: (prompt: string) => void;
}

const TONE: Record<ProactiveAlert['severity'], { dot: string; bg: string; label: string }> = {
  kritis: { dot: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: 'Kritis' },
  waspada: { dot: '#F2A83B', bg: 'rgba(242,168,59,0.08)', label: 'Waspada' },
  info: { dot: '#4E9BFF', bg: 'rgba(78,155,255,0.08)', label: 'Info' },
};

function readDismissed(key: string): DismissRecord[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as DismissRecord[]) : [];
    return Array.isArray(parsed) ? pruneDismissed(parsed) : [];
  } catch {
    return [];
  }
}

function writeDismissed(key: string, records: DismissRecord[]) {
  try {
    localStorage.setItem(key, JSON.stringify(pruneDismissed(records)));
  } catch {
    /* storage blocked -- dismiss cuma bertahan selama sesi komponen */
  }
}

export default function ProactiveAlertsPanel({ role, workspaceId, onOpenInventory, onOpenDashboard, onAskAI }: ProactiveAlertsPanelProps) {
  const storageKey = dismissStorageKey(role, workspaceId);
  const [raw, setRaw] = useState<ProactiveAlert[]>([]);
  const [dismissed, setDismissed] = useState<DismissRecord[]>([]);

  const refresh = useCallback(async () => {
    const alerts = await collectProactiveAlerts({ role, workspaceId });
    setRaw(alerts);
    setDismissed(readDismissed(storageKey));
  }, [role, workspaceId, storageKey]);

  useEffect(() => {
    let cancelled = false;
    void refresh().catch(() => { if (!cancelled) setRaw([]); });
    const handler = () => { void refresh(); };
    window.addEventListener('klir-inventory-updated', handler);
    window.addEventListener('klir-ai-state-updated', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-inventory-updated', handler);
      window.removeEventListener('klir-ai-state-updated', handler);
    };
  }, [refresh]);

  const visible = mergeAndRank(raw, dismissed);
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = pruneDismissed([...dismissed.filter((d) => d.id !== id), { id, at: Date.now() }]);
    setDismissed(next);
    writeDismissed(storageKey, next);
  };

  const runCta = (alert: ProactiveAlert) => {
    const cta = alert.cta;
    if (!cta) return;
    if (cta.action === 'open-inventory') {
      // Inventory actions stay inside the AI Assistant. If the caller can
      // populate the composer, prefer that path so no raw CRUD surface opens.
      if (onAskAI) onAskAI(INVENTORY_AI_PROMPT);
      else onOpenInventory?.();
    }
    else if (cta.action === 'open-dashboard') onOpenDashboard?.();
    else if (cta.action === 'ask-ai' && cta.prompt) onAskAI?.(cta.prompt);
  };

  return (
    <section
      aria-label="Perlu perhatian"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', margin: '0 0 10px', borderRadius: '14px', background: '#0D1117', border: 0, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(242,168,59,0.14)', color: '#F2A83B' }}>
          <Bell size={13} strokeWidth={1.9} />
        </span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Perlu perhatian</span>
        <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>{visible.length} hal dari data workspace ini</span>
      </div>
      {visible.map((alert) => {
        const tone = TONE[alert.severity];
        const summaryCard = alert.id.includes(':lainnya:');
        return (
          <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: tone.bg }}>
            <span style={{ marginTop: '4px', width: '8px', height: '8px', borderRadius: '999px', background: tone.dot, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{alert.title}</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: tone.dot, background: 'rgba(6,8,12,0.55)', padding: '2px 7px', borderRadius: '999px' }}>{tone.label}</span>
              </div>
              {alert.body && <p style={{ margin: '4px 0 0', fontSize: '11.5px', lineHeight: 1.5, color: '#A9B4C7' }}>{alert.body}</p>}
              {alert.cta && !summaryCard && (
                <button
                  type="button"
                  onClick={() => runCta(alert)}
                  style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 11px', borderRadius: '8px', border: 0, background: 'rgba(255,255,255,0.06)', color: '#F5F7FA', fontFamily: 'inherit', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {alert.cta.action === 'ask-ai' && <AlertTriangle size={12} strokeWidth={1.9} />}
                  {alert.cta.label}
                </button>
              )}
            </div>
            {!summaryCard && (
              <button
                type="button"
                aria-label="Tutup peringatan ini"
                title="Sembunyikan 24 jam"
                onClick={() => dismiss(alert.id)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '7px', border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
              >
                <X size={13} strokeWidth={1.9} />
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
