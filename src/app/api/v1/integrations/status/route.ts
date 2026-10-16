import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { getWhatsAppStatus } from '@/lib/integrations/whatsapp/adapter';
import { MetaAdsAdapter } from '@/lib/integrations/ads/meta-adapter';
import { GoogleAdsAdapter } from '@/lib/integrations/ads/google-adapter';
import { isLocalDemoRequest } from '@/lib/local-demo-guard';

export const GET = withTenantGuard(
  async (req) => {
    const isDevLocal = isLocalDemoRequest(req.headers.get('host') || '');

    const whatsApp = getWhatsAppStatus();
    const metaAds = new MetaAdsAdapter();
    const googleAds = new GoogleAdsAdapter();

    return NextResponse.json({
      isDemo: isDevLocal,
      integrations: [
        {
          id: 'whatsapp',
          name: 'WhatsApp Gateway',
          provider: isDevLocal && !whatsApp.configured ? 'fonnte (demo)' : whatsApp.provider,
          status: isDevLocal ? 'connected' : whatsApp.status,
          configured: isDevLocal ? true : whatsApp.configured,
          description: 'Kirim struk digital & penagihan kasbon via WhatsApp',
        },
        {
          id: 'meta-ads',
          name: 'Meta Ads (Facebook/Instagram)',
          provider: 'meta',
          status: isDevLocal ? 'connected' : metaAds.status,
          configured: isDevLocal ? true : (metaAds.status === 'connected'),
          description: 'Sync leads dari kampanye Facebook & Instagram Ads',
        },
        {
          id: 'google-ads',
          name: 'Google Ads',
          provider: 'google',
          status: isDevLocal ? 'connected' : googleAds.status,
          configured: isDevLocal ? true : (googleAds.status === 'connected'),
          description: 'Sync leads dari kampanye Google Search & Display Ads',
        },
      ],
    });
  },
  { minRole: 'MEMBER' }
);
