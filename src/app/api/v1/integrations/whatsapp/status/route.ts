import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { getWhatsAppStatus } from '@/lib/integrations/whatsapp/adapter';

export const GET = withTenantGuard(
  async () => {
    const status = getWhatsAppStatus();
    return NextResponse.json(status);
  },
  { minRole: 'MEMBER' }
);