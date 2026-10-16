import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { MetaAdsAdapter } from '@/lib/integrations/ads/meta-adapter';
import { GoogleAdsAdapter } from '@/lib/integrations/ads/google-adapter';

const metaAdapter = new MetaAdsAdapter();
const googleAdapter = new GoogleAdsAdapter();

// GET: verifikasi webhook dari Meta (hub.mode=subscribe handshake)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST: terima leads dari Meta atau Google
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const source = req.nextUrl.searchParams.get('source') || 'meta';
    const adapter = source === 'google' ? googleAdapter : metaAdapter;

    if (adapter.status === 'not_configured') {
      // Silent 200: platform ads kadang retry terus kalau dapat non-200
      console.warn(`[integrations/ads/webhook] ${source} not configured, dropping lead for workspace ${auth.workspace.id}`);
      return NextResponse.json({ received: true, processed: false, reason: 'not_configured' });
    }

    const lead = adapter.parseLead(payload);
    if (!lead) {
      return NextResponse.json({ received: true, processed: false, reason: 'parse_failed' });
    }

    // Log ke console (data real masuk tapi belum ada tabel leads — akan dihubungkan
    // ke Campaign.leads saat Fatur tambahkan relasi di schema).
    console.info(`[integrations/ads/webhook] New lead from ${source}:`, {
      workspaceId: auth.workspace.id,
      leadId: lead.id,
      name: lead.fullName,
      campaign: lead.campaignId,
    });

    return NextResponse.json({ received: true, processed: true, leadId: lead.id });
  },
  { minRole: 'VIEWER' }
);