/**
 * WhatsApp adapter — provider registry dengan lazy-init.
 * Saat env vars belum diisi → status not_configured, tidak crash.
 */
import type { WhatsAppProvider, WhatsAppMessageResult, IntegrationStatus } from '../types';

// ─── Stub (selalu not_configured) ────────────────────────────────────────────

class StubWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'stub';
  readonly status: IntegrationStatus = 'not_configured';
  async sendMessage(): Promise<WhatsAppMessageResult> {
    return { success: false, error: 'WhatsApp belum dikonfigurasi. Set WHATSAPP_PROVIDER dan WHATSAPP_TOKEN di .env.' };
  }
  async sendMedia(): Promise<WhatsAppMessageResult> {
    return { success: false, error: 'WhatsApp belum dikonfigurasi.' };
  }
}

// ─── Fonnte provider ─────────────────────────────────────────────────────────

class FonnteProvider implements WhatsAppProvider {
  readonly name = 'fonnte';
  readonly status: IntegrationStatus;
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
    this.status = token ? 'connected' : 'not_configured';
  }

  async sendMessage(to: string, text: string): Promise<WhatsAppMessageResult> {
    if (!this.token) return { success: false, error: 'Fonnte token tidak ada.' };
    try {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: this.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: to, message: text }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (json.status) return { success: true, messageId: String(json.id ?? '') };
      return { success: false, error: String(json.reason ?? 'Fonnte error tidak diketahui') };
    } catch (err) {
      return { success: false, error: `Fonnte network error: ${String(err)}` };
    }
  }

  async sendMedia(to: string, mediaUrl: string, caption: string): Promise<WhatsAppMessageResult> {
    if (!this.token) return { success: false, error: 'Fonnte token tidak ada.' };
    try {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: this.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: to, message: caption, url: mediaUrl }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (json.status) return { success: true, messageId: String(json.id ?? '') };
      return { success: false, error: String(json.reason ?? 'Fonnte error tidak diketahui') };
    } catch (err) {
      return { success: false, error: `Fonnte network error: ${String(err)}` };
    }
  }
}

// ─── Meta Cloud API provider ──────────────────────────────────────────────────

class MetaCloudProvider implements WhatsAppProvider {
  readonly name = 'meta-cloud';
  readonly status: IntegrationStatus;
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor(token: string, phoneNumberId: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.status = token && phoneNumberId ? 'connected' : 'not_configured';
  }

  async sendMessage(to: string, text: string): Promise<WhatsAppMessageResult> {
    if (!this.token || !this.phoneNumberId) return { success: false, error: 'Meta Cloud belum dikonfigurasi.' };
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (Array.isArray(json.messages) && json.messages.length > 0) {
        return { success: true, messageId: String((json.messages as Record<string, unknown>[])[0].id ?? '') };
      }
      return { success: false, error: JSON.stringify(json.error ?? json) };
    } catch (err) {
      return { success: false, error: `Meta Cloud network error: ${String(err)}` };
    }
  }

  async sendMedia(to: string, mediaUrl: string, caption: string): Promise<WhatsAppMessageResult> {
    if (!this.token || !this.phoneNumberId) return { success: false, error: 'Meta Cloud belum dikonfigurasi.' };
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'image', image: { link: mediaUrl, caption } }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (Array.isArray(json.messages) && json.messages.length > 0) {
        return { success: true, messageId: String((json.messages as Record<string, unknown>[])[0].id ?? '') };
      }
      return { success: false, error: JSON.stringify(json.error ?? json) };
    } catch (err) {
      return { success: false, error: `Meta Cloud network error: ${String(err)}` };
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createWhatsAppProvider(): WhatsAppProvider {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  const token = process.env.WHATSAPP_TOKEN || '';

  if (provider === 'fonnte' && token) return new FonnteProvider(token);
  if (provider === 'meta-cloud') {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    return new MetaCloudProvider(token, phoneId);
  }
  return new StubWhatsAppProvider();
}

export function getWhatsAppStatus(): { status: string; provider: string; configured: boolean } {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase() || 'stub';
  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const configured = !!(token && (provider !== 'meta-cloud' || phoneId));
  return { status: configured ? 'connected' : 'not_configured', provider, configured };
}