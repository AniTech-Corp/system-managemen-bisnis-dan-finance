import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { generateImage } from '@/lib/ai-gateway';

/**
 * POST /anivirtual/generate-image
 * Generate gambar AI dari prompt teks (pakai Gemini image model — gratis).
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { prompt } = await req.json();

      if (!prompt || !prompt.trim()) {
        return NextResponse.json({ message: 'Prompt gambar tidak boleh kosong.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'anivirtual.generate_image',
          userId: auth.user.id,
          customCost: 30,
          metadata: { promptLength: prompt.length },
        },
        async () => {
          const img = await generateImage(prompt);
          return {
            imageBase64: img.imageBase64,
            mimeType: img.mimeType,
            provider: img.provider,
            modelUsed: img.modelUsed,
            prompt,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Generate gambar AniVirtual gagal.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);
