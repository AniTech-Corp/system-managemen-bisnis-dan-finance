/**
 * FASE 1 — 13 Sep 2026: Wadah Gateway Integrasi KLIR.
 * Adapter pattern: provider manapun bisa dipasang tanpa mengubah caller.
 * Semua file di src/lib/integrations/ adalah NEW, tidak mengubah file existing.
 */

export type IntegrationStatus = 'connected' | 'not_configured' | 'error';

export interface IntegrationHealth {
  name: string;
  status: IntegrationStatus;
  message: string;
  configuredAt?: string;
}

// ─── WhatsApp ───────────────────────────────────────────────────────────────

export type WhatsAppMessageResult = { success: boolean; messageId?: string; error?: string };

export interface WhatsAppProvider {
  readonly name: string;
  readonly status: IntegrationStatus;
  sendMessage(to: string, text: string): Promise<WhatsAppMessageResult>;
  sendMedia(to: string, mediaUrl: string, caption: string): Promise<WhatsAppMessageResult>;
}

export type KasbonTone = 'sopan' | 'formal' | 'tegas';

export interface KasbonTemplateData {
  namaPelanggan: string;
  namaBisnis: string;
  nomorInvoice: string;
  nominal: string;
  tanggalTempo: string;
  hariTertahan?: number;
  namaBank?: string;
  nomorRekening?: string;
  nomorFinance?: string;
  linkInvoice?: string;
}

export interface ReceiptTemplateData {
  namaPelanggan: string;
  namaBisnis: string;
  nomorStruk: string;
  items: Array<{ nama: string; qty: number; harga: string }>;
  total: string;
  tanggal: string;
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export interface AdsLead {
  id: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  campaignId?: string;
  adId?: string;
  source: 'meta' | 'google' | 'tiktok';
  createdAt: string;
}

export interface AdsLeadProvider {
  readonly name: string;
  readonly status: IntegrationStatus;
  parseLead(rawPayload: unknown): AdsLead | null;
}