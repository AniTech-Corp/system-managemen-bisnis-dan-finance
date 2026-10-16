import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { deductCredit, refundCredit } from '@/lib/credit';
import { streamChatText } from '@/lib/ai-gateway';
import { buildWorkspaceContext } from '@/lib/workspace-context';

const SessionType = { REQUEST: 'REQUEST', UNDERSTAND: 'UNDERSTAND' } as any;

const CHAT_SYSTEM_INSTRUCTION =
  'Anda adalah "AniVirtual", asisten AI pribadi serba bisa untuk pemilik UMKM Indonesia. Anda bisa membantu apa pun: menjawab pertanyaan, menganalisis data, menulis dokumen, brainstorming ide, memberi saran bisnis, dan lainnya. Jawab dengan bahasa Indonesia yang ramah, jelas, dan bermanfaat. Jika diminta membuat konten/teks, langsung buatkan.\n\n' +
  'PENTING — ATURAN ANTI-MENGARANG (WAJIB):\n' +
  '1. Anda akan diberikan blok "DATA PERUSAHAAN" yang berisi data RIIL dari database. HANYA gunakan data yang ada di blok tersebut untuk menjawab pertanyaan tentang perusahaan.\n' +
  '2. Jika ditanya soal perusahaan/user (nama usaha, bidang usaha, omzet, produk, kondisi keuangan, dll) TAPI data yang bersangkutan TIDAK ADA di blok "DATA PERUSAHAAN" (kosong atau tidak tercantum), maka JANGAN mengarang. Jawab jujur: "Maaf, saya belum punya data [hal tersebut] untuk usaha Anda. Silakan unggah/isi data atau ketik datanya, nanti saya bantu analisis."\n' +
  '3. JANGAN PERNAH membuat angka, nama, produk, atau kondisi keuangan yang tidak ada di data. Mengarang data = kesalahan fatal.\n' +
  '4. Jika blok DATA PERUSAHAAN kosong total, katakan bahwa data usaha belum terisi. Jangan menebak jenis usahanya.';

/**
 * POST /anivirtual/chat/stream
 * Streaming chat (SSE) — jawaban AI muncul token demi token (seperti ChatGPT).
 * Riwayat percakapan otomatis tersimpan ke anivirtual_sessions + anivirtual_messages.
 *
 * Body: { message: string, sessionId?: string }
 * Response: text/event-stream (data: {"text":"..."} ... data: [DONE])
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateTenantRequest(req, { minRole: 'MEMBER' });
  if (authResult.errorResponse) return authResult.errorResponse;

  const { auth } = authResult;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Body JSON tidak valid.' }, { status: 400 });
  }

  const message = (body.message || '').trim();
  if (!message) {
    return NextResponse.json({ message: 'Pesan tidak boleh kosong.' }, { status: 400 });
  }

  const workspaceId = auth.workspace.id;

  // Potong kredit
  try {
    await deductCredit({
      workspaceId,
      cost: 10,
      source: 'CHAT_ANIVIRTUAL',
      userId: auth.user.id,
      metadata: { description: 'AniVirtual Chat Streaming' },
    });
  } catch {
    return NextResponse.json({ message: publicApiError('Kredit AniVirtual tidak dapat diproses.') }, { status: 402 });
  }

  // Ambil atau buat session
  const prismaAny = prisma as any;
  let session = body.sessionId
    ? await prismaAny.aniVirtualSession.findFirst({
        where: { id: body.sessionId, workspaceId },
      })
    : null;

  if (!session) {
    session = await prismaAny.aniVirtualSession.create({
      data: {
        workspaceId,
        userId: auth.user.id,
        type: SessionType.REQUEST,
        title: message.slice(0, 60),
      },
    });
  }

  // Muat riwayat percakapan
  const prevMessages = await prismaAny.aniVirtualMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  const historyText = prevMessages
    .map((m: any) => `${m.sender === 'user' ? 'User' : 'AI'}: ${(m.content as any)?.text || ''}`)
    .join('\n');

  const prompt = historyText ? `Riwayat percakapan:\n${historyText}\n\nPesan terbaru User: ${message}` : message;

  // Suntikkan data perusahaan nyata agar AI bisa menjawab berdasarkan data riil
  const workspaceContext = await buildWorkspaceContext(workspaceId);
  const fullSystemInstruction = workspaceContext
    ? `${CHAT_SYSTEM_INSTRUCTION}\n\nBerikut DATA PERUSAHAAN riil saat ini yang bisa kamu gunakan untuk menjawab:\n${workspaceContext}`
    : CHAT_SYSTEM_INSTRUCTION;

  const encoder = new TextEncoder();
  let creditsRefunded = false;

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = '';
      try {
        const gen = await streamChatText(prompt, fullSystemInstruction);
        for await (const chunk of gen) {
          fullText += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }

        // Simpan user + assistant message ke DB
        await prismaAny.aniVirtualMessage.create({
          data: { sessionId: session.id, sender: 'user', content: { text: message } },
        });
        await prismaAny.aniVirtualMessage.create({
          data: { sessionId: session.id, sender: 'assistant', content: { text: fullText } },
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId: session.id })}\n\n`));
      } catch (err: any) {
        if (!creditsRefunded) {
          creditsRefunded = true;
          try {
            await refundCredit({
              workspaceId,
              cost: 10,
              source: 'CHAT_ANIVIRTUAL',
              userId: auth.user.id,
              reason: 'Streaming error',
            });
          } catch {}
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: publicApiError('Terjadi kesalahan saat memproses jawaban AI.'),
            })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
