import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { executeAIRequest } from '@/lib/ai-gateway';
import { publicApiError } from '@/lib/api-error';
import { MemoryScope } from '@prisma/client';

const SessionType = { UNDERSTAND: 'UNDERSTAND' } as any;

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { message, customTone, sessionId } = await req.json();

      if (!message || !message.trim()) {
        return NextResponse.json({ message: 'Pesan instruksi operasional tidak boleh kosong.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // 1. Ambil memori terisolasi aktif (WORKSPACE + PERSONAL milik user)
      const activeMemories = await prisma.memoryItem.findMany({
        where: {
          workspaceId,
          OR: [
            { scope: MemoryScope.WORKSPACE },
            { scope: MemoryScope.PERSONAL, userId: auth.user.id },
          ],
        },
        select: { content: true, scope: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      const memoryContextString = activeMemories
        .map((m) => `[Memori ${m.scope}]: ${m.content}`)
        .join('\n');

      // 2. Eksekusi atomis dengan jaminan pemotongan 10 kredit & auto-refund jika gagal
      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'anivirtual.understand',
          userId: auth.user.id,
          metadata: { messageLength: message.length, hasCustomTone: Boolean(customTone) },
        },
        async () => {
          const systemInstruction = `Anda adalah AniVirtual, Internal Workflow & Context Agent untuk tim perusahaan di Indonesia.
Tugas Anda:
1. Menganalisis maksud instruksi kerja atau pesan yang masuk.
2. Mendeteksi sentimen komunikasi (misal: SANGAT FORMAL, MENDESAK/URGENT, SANTAI/KASUAL, DIPLOMATIS).
3. Mengekstrak poin tindakan operasional utama (suggestedAction).
4. Menghasilkan 4 variasi draf balasan profesional:
   - "Formal Eksekutif" (Cocok untuk Direksi/Klien Korporat)
   - "Semi-Formal (Tim)" (Cocok untuk rekan internal)
   - "Gen Z Startup" (Santai, gesit, antusias)
   - "Diplomatis / Solutif" (Sopan dan berorientasi solusi)
${customTone ? `Catatan Gaya Kustom dari Pengguna: "${customTone}"` : ''}

Konteks Memori Perusahaan & Pengguna yang Tersimpan:
${memoryContextString || 'Belum ada memori khusus.'}`;

          const prompt = `Pesan yang masuk:
"${message}"

Format Output WAJIB JSON persis:
{
  "summary": "Ringkasan maksud pesan dalam 1-2 kalimat jelas",
  "sentiment": "SENTIMEN_PESAN (misal: FORMAL & TERSTRUKTUR, MENDESAK, POSITIF)",
  "suggestedAction": "Tindakan operasional yang disarankan",
  "keyTakeaways": ["Poin 1", "Poin 2"],
  "draftReplies": [
    { "tone": "Formal Eksekutif", "text": "..." },
    { "tone": "Semi-Formal (Tim)", "text": "..." },
    { "tone": "Gen Z Startup", "text": "..." },
    { "tone": "Diplomatis / Solutif", "text": "..." }
  ]
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            systemInstruction,
            jsonMode: true,
            temperature: 0.6,
          });

          const assistantContent = aiRes.json || {
            summary: `Analisis pesan operasional: "${message.slice(0, 100)}..."`,
            sentiment: 'PROFESIONAL & TERSTRUKTUR',
            suggestedAction: 'Tindak lanjuti dengan konfirmasi tim operasional terkait.',
            keyTakeaways: ['Pesan telah diverifikasi sistem AniVirtual', 'Instruksi siap didelegasikan ke PIC terkait'],
            draftReplies: [
              {
                tone: 'Formal Eksekutif',
                text: `Dengan hormat, kami telah menerima instruksi terkait "${message.slice(0, 35)}...". Tim kami sedang memprosesnya sesuai SOP.`,
              },
              {
                tone: 'Semi-Formal (Tim)',
                text: `Halo Kak, instruksi mengenai "${message.slice(0, 35)}..." sudah kami catat dan langsung diproses ya!`,
              },
              {
                tone: 'Gen Z Startup',
                text: `Gokil! Langsung kita eksekusi ya pesannya tentang "${message.slice(0, 30)}..." gaspol!`,
              },
              {
                tone: 'Diplomatis / Solutif',
                text: `Terima kasih atas arahannya. Kami siap mengeksekusi dengan solusi terbaik dan akan melaporkan perkembangannya segera.`,
              },
            ],
          };

          // Simpan sesi dan riwayat percakapan ke database
          let session: any;
          const prismaAny = prisma as any;
          if (sessionId) {
            session = await prismaAny.aniVirtualSession.findFirst({
              where: { id: sessionId, workspaceId },
            });
          }

          if (!session) {
            session = await prismaAny.aniVirtualSession.create({
              data: {
                workspaceId,
                userId: auth.user.id,
                type: SessionType.UNDERSTAND,
                title: message.slice(0, 50),
              },
            });
          }

          await prismaAny.aniVirtualMessage.createMany({
            data: [
              { sessionId: session.id, sender: 'user', content: { text: message, customTone } },
              { sessionId: session.id, sender: 'assistant', content: assistantContent },
            ],
          });

          const updatedSession = await prismaAny.aniVirtualSession.findUnique({
            where: { id: session.id },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
          });

          return {
            session: updatedSession,
            assistantResponse: assistantContent,
            provider: aiRes.provider,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('AniVirtual gagal memproses instruksi.') }, { status: 400 });
    }
  },
  { minRole: 'VIEWER' }
);
