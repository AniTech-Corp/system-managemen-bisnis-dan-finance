import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { dispatchWorkflowEvent } from '@/lib/workflow-engine';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { triggerSource, payload = {} } = await req.json();

      if (!triggerSource) {
        return NextResponse.json({ message: 'triggerSource wajib disertakan.' }, { status: 400 });
      }

      const result = await dispatchWorkflowEvent({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        triggerSource,
        payload,
      });

      return NextResponse.json({
        success: true,
        message: `Workflow event '${triggerSource}' berhasil diproses (${result.triggeredCount} aksi dieksekusi).`,
        ...result,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Workflow gagal dijalankan.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);

