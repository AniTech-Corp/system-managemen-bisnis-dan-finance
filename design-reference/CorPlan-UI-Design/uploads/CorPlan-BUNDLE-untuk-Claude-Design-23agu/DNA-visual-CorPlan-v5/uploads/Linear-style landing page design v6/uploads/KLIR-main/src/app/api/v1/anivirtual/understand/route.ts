import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { deductCredit } from '@/lib/credit';
import { SessionType } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await req.json();
    const workspaceId = userPayload.workspaceId;

    // Deduct 10 credits atomically
    await deductCredit(workspaceId, 10, 'anivirtual.understand', userPayload.userId);

    const assistantContent = {
      summary: `Analisis pesan operasional: "${message.slice(0, 80)}..."`,
      sentiment: 'PROPOSIONAL & TERANSTRUKTUR',
      suggestedAction: 'Tindak lanjuti dengan konfirmasi tim operasional.',
      draftReplies: [
        { tone: 'Formal Eksekutif', text: `Dengan hormat, kami telah menerima instruksi terkait "${message.slice(0, 30)}...". Tim kami sedang memprosesnya.` },
        { tone: 'Semi-Formal (Tim)', text: `Halo Kak, instruksi mengenai "${message.slice(0, 30)}..." sudah kami catat dan langsung diproses ya!` },
        { tone: 'Gen Z Startup', text: `Gokil! Langsung kita eksekusi ya pesannya tentang "${message.slice(0, 25)}..."!` },
      ],
    };

    const session = await prisma.aniVirtualSession.create({
      data: {
        workspaceId,
        userId: userPayload.userId,
        type: SessionType.UNDERSTAND,
        title: message.slice(0, 50),
        messages: {
          create: [
            { sender: 'user', content: { text: message } },
            { sender: 'assistant', content: assistantContent },
          ],
        },
      },
      include: { messages: true },
    });

    return NextResponse.json(session);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
