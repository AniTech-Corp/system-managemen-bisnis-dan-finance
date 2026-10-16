import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { executeAIRequest } from '@/lib/ai-gateway';

/**
 * POST /anivirtual/chat
 * Asisten AI serba bisa (general assistant) — menjawab pertanyaan, membantu analisis,
 * menulis, brainstorming, dan tugas umum apa pun (seperti ChatGPT/Claude).
 * Mendukung riwayat percakapan via field `history`.
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { message, history } = await req.json();

      if (!message || !message.trim()) {
        return NextResponse.json({ message: 'Pesan tidak boleh kosong.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'anivirtual.chat',
          userId: auth.user.id,
          customCost: 5,
          metadata: { messageLength: message.length },
        },
        async () => {
          let historyText = '';
          if (Array.isArray(history) && history.length > 0) {
            historyText = history
              .slice(-10)
              .map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
              .join('\n');
          }

          const prompt = historyText
            ? `Riwayat percakapan:\n${historyText}\n\nPesan terbaru User: ${message}`
            : message;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            systemInstruction:
              'Anda adalah "AniVirtual", asisten AI pribadi yang serba bisa untuk pemilik UMKM Indonesia. Anda bisa membantu apa pun: menjawab pertanyaan, menganalisis data, menulis dokumen, brainstorming ide, memberi saran bisnis, dan lainnya. Jawab dengan bahasa Indonesia yang ramah, jelas, dan bermanfaat. Jika diminta membuat konten/teks, langsung buatkan. Jangan menolak permintaan yang wajar.',
            temperature: 0.8,
          });

          return {
            reply: aiRes.text,
            provider: aiRes.provider,
            modelUsed: aiRes.modelUsed,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Chat AniVirtual gagal diproses.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);
