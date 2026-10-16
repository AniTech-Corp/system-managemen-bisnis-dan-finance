import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { createWhatsAppProvider } from '@/lib/integrations/whatsapp/adapter';
import { buildKasbonMessage, buildReceiptMessage } from '@/lib/integrations/whatsapp/templates';
import type { KasbonTone } from '@/lib/integrations/types';

export const POST = withTenantGuard(
  async (req: NextRequest) => {
    const provider = createWhatsAppProvider();

    if (provider.status === 'not_configured') {
      return NextResponse.json(
        { success: false, error: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp gateway belum dikonfigurasi. Tambahkan WHATSAPP_PROVIDER dan WHATSAPP_TOKEN di .env.local.' },
        { status: 503 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_BODY', message: 'Body harus JSON.' }, { status: 400 });
    }

    const { to, type, tone, data } = body as {
      to?: string;
      type?: 'kasbon' | 'receipt' | 'custom';
      tone?: KasbonTone;
      data?: Record<string, unknown>;
      message?: string;
    };

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ success: false, error: 'MISSING_TO', message: 'Field `to` (nomor WA tujuan) wajib diisi.' }, { status: 400 });
    }

    let text = '';
    if (type === 'kasbon' && data) {
      text = buildKasbonMessage(data as unknown as Parameters<typeof buildKasbonMessage>[0], (tone ?? 'sopan') as KasbonTone);
    } else if (type === 'receipt' && data) {
      text = buildReceiptMessage(data as unknown as Parameters<typeof buildReceiptMessage>[0]);
    } else if (type === 'custom') {
      const msg = (body as Record<string, unknown>).message;
      if (!msg || typeof msg !== 'string') {
        return NextResponse.json({ success: false, error: 'MISSING_MESSAGE', message: 'Custom type butuh field `message`.' }, { status: 400 });
      }
      text = msg;
    } else {
      return NextResponse.json({ success: false, error: 'INVALID_TYPE', message: 'Field `type` harus salah satu: kasbon | receipt | custom.' }, { status: 400 });
    }

    const result = await provider.sendMessage(to, text);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  },
  { minRole: 'MEMBER' }
);