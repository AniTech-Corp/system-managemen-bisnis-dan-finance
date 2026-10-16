import { NextResponse } from 'next/server';
import { generateNotebook } from '@/lib/notebook-engine';
import { mediaErrorResponse, readMediaJson, withMediaGuard } from '@/lib/media-http';
import { recordActivity } from '@/lib/activity-log';

export const runtime = 'nodejs';

export const POST = withMediaGuard(async (req, { auth }) => {
  try {
    const body = await readMediaJson(req);
    const data = await generateNotebook(body, auth.workspace.id);
    void recordActivity(auth.workspace.id, auth.user.id, 'brain.notebook_generate', { kind: data.kind });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return mediaErrorResponse(error);
  }
});
