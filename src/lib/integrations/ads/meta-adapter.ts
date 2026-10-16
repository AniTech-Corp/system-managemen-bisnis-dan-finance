/**
 * Meta Ads lead sync adapter — parse webhook leadgen payload dari Graph API.
 */
import type { AdsLead, AdsLeadProvider, IntegrationStatus } from '../types';

interface MetaLeadEntry {
  id?: string;
  field_data?: Array<{ name: string; values: string[] }>;
  created_time?: string;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        ad_id?: string;
        campaign_id?: string;
        leadgen_id?: string;
        created_time?: number;
        form_id?: string;
      };
    }>;
  }>;
  leads?: MetaLeadEntry[];
}

function extractField(fields: Array<{ name: string; values: string[] }>, key: string): string | undefined {
  return fields.find((f) => f.name === key)?.values?.[0];
}

export class MetaAdsAdapter implements AdsLeadProvider {
  readonly name = 'meta';
  readonly status: IntegrationStatus;

  constructor() {
    this.status = process.env.META_ADS_TOKEN ? 'connected' : 'not_configured';
  }

  parseLead(rawPayload: unknown): AdsLead | null {
    try {
      const payload = rawPayload as MetaWebhookPayload;
      // Format dari Facebook Ads Manager webhook leadgen
      const change = payload?.entry?.[0]?.changes?.[0]?.value;
      if (!change) return null;

      const leadgenId = change.leadgen_id || change.form_id || '';
      const campaignId = change.campaign_id || undefined;
      const adId = change.ad_id || undefined;
      const createdAt = change.created_time
        ? new Date(change.created_time * 1000).toISOString()
        : new Date().toISOString();

      // Kalau ada array leads langsung di payload (format batch)
      const leadEntry = payload.leads?.[0];
      const fields = leadEntry?.field_data || [];

      return {
        id: leadgenId || leadEntry?.id || crypto.randomUUID(),
        fullName: extractField(fields, 'full_name') || extractField(fields, 'name') || 'Unknown',
        phoneNumber: extractField(fields, 'phone_number') || extractField(fields, 'phone'),
        email: extractField(fields, 'email'),
        campaignId,
        adId,
        source: 'meta',
        createdAt: leadEntry?.created_time || createdAt,
      };
    } catch {
      return null;
    }
  }
}