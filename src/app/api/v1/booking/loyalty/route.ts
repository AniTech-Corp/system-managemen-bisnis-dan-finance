import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { customerName, customerPhone, rating = 5, feedback, spendingAmount = 150000 } = await req.json();

      if (!customerName) {
        return NextResponse.json({ message: 'Nama pelanggan wajib diisi.' }, { status: 400 });
      }

      const numRating = Number(rating) || 5;
      const spending = Number(spendingAmount) || 0;
      const pointsEarned = Math.floor(spending / 10000); // 1 poin per Rp 10.000

      let alertStatus = 'SATISFIED_CUSTOMER';
      let managementAction = 'Kirimkan voucher terima kasih untuk kunjungan berikutnya.';

      if (numRating <= 2) {
        alertStatus = 'EARLY_COMPLAINT_ALERT';
        managementAction = '🚨 PERHATIAN KHUSUS: Hubungi pelanggan via WhatsApp dalam 2 jam untuk mendengar keluhan dan tawarkan kompensasi / diskon layanan ulang.';
      } else if (numRating === 3) {
        alertStatus = 'NEUTRAL_FEEDBACK';
        managementAction = 'Evaluasi catatan layanan staf terkait untuk peningkatan mutu berkala.';
      }

      return NextResponse.json({
        success: true,
        loyaltyEvaluation: {
          customerName: customerName.trim(),
          rating: numRating,
          stars: '⭐'.repeat(Math.min(numRating, 5)),
          pointsEarned,
          // FIX (audit workflow, sesi ini): dulu "+50" hardcode permanen berlabel
          // "Akumulasi poin profil" -- padahal tidak ada model database yang menyimpan
          // histori poin pelanggan sama sekali (endpoint ini 100% stateless), jadi angka
          // itu karangan yang muncul identik untuk pelanggan manapun. Jujur: total poin
          // yang bisa dijamin cuma dari transaksi kali ini, sampai ada tabel loyalty
          // profile nyata yang mengakumulasi lintas kunjungan.
          totalLoyaltyPoints: pointsEarned,
          alertStatus,
          managementAction,
          feedbackText: feedback || 'Pelayanan sangat memuaskan dan ramah.',
          evaluatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Data loyalti booking gagal disimpan.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
