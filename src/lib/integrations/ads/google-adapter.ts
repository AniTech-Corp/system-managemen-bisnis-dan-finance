/**
 * Google Ads lead sync adapter — parse webhook payload dari Google Ads Lead Form Extensions.
 */
import type { AdsLead, AdsLeadProvider, IntegrationStatus } from '../types';

interface GoogleLeadPayload {
  google_key?: string;
  user_column_data?: Array<{ column_name: string; string_value?: string }>;
  campaign_id?: string;
  ad_group_id?: string;
  creative_id?: string;
  lead_id?: string;
  adgroup_id?: string;
  gcl_id?: string;
}

function extractGoogleField(data: Array<{ column_name: string; string_value?: string }>, key: string): string | undefined {
  return data.find((d) => d.column_name === key)?.string_value;
}

export class GoogleAdsAdapter implements AdsLeadProvider {
  readonly name = 'google';
  readonly status: IntegrationStatus;

  constructor() {
    this.status = process.env.GOOGLE_ADS_TOKEN ? 'connected' : 'not_configured';
  }

  parseLead(rawPayload: unknown): AdsLead | null {
    try {
      const payload = rawPayload as GoogleLeadPayload;
      const fields = payload.user_column_data || [];

      const fullName = extractGoogleField(fields, 'FULL_NAME') ||
        [extractGoogleField(fields, 'FIRST_NAME'), extractGoogleField(fields, 'LAST_NAME')]
          .filter(Boolean).join(' ') || 'Unknown';

      return {
        id: payload.lead_id || payload.gcl_id || crypto.randomUUID(),
        fullName,
        phoneNumber: extractGoogleField(fields, 'PHONE_NUMBER'),
        email: extractGoogleField(fields, 'EMAIL'),
        campaignId: payload.campaign_id,
        adId: payload.creative_id || payload.ad_group_id,
        source: 'google',
        createdAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
}