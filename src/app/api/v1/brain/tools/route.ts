import { NextResponse } from 'next/server';
import { DOCUMENT_TEMPLATES } from '@/lib/template-library';
import { KLIR_AI_TOOLS } from '@/lib/ai-tools-registry';

/**
 * GET /api/v1/brain/tools
 * Registry kemampuan AI Brain — dipakai UI (panel Plugins / tombol quick-action)
 * untuk menampilkan tools yang tersedia tanpa hardcode di frontend. Sumber
 * datanya di src/lib/ai-tools-registry.ts, dipakai bareng oleh chat brain
 * (fitur "apa yang bisa kamu lakukan") supaya dua tempat ini tidak beda daftar.
 * status: 'ready' = bisa dipakai sekarang, 'planned' = jujur belum tersedia.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: { tools: KLIR_AI_TOOLS, availableTemplates: DOCUMENT_TEMPLATES },
  });
}
