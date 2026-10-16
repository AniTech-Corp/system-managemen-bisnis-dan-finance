import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { getWorkspaceTierEntitlements } from '@/lib/tier-hardening';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { bookingCode, customerName, customerPhone, serviceName, bookingDate, bookingTime, location = 'Kantor / Studio Pusat' } = await req.json();

      if (!customerName || !customerPhone || !serviceName || !bookingDate) {
        return NextResponse.json({ message: 'Nama, No WhatsApp, Layanan, dan Tanggal wajib diisi.' }, { status: 400 });
      }

      const formattedDate = new Date(bookingDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // FIX (audit workflow, sesi ini): dulu cuma buang karakter non-digit, awalan '0'
      // lokal (mis. 081234567890) tidak dikonversi ke kode negara '62' -- link wa.me
      // butuh format internasional, nomor berawalan 0 mentah umumnya tidak dikenali.
      let cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }

      const reminderMessage = `Halo Kak ${customerName}! 👋

Ini adalah pesan pengingat resmi jadwal reservasi Anda di *${auth.workspace.name}*:

📅 *Jadwal*: ${formattedDate}
⏰ *Waktu*: ${bookingTime || '14:00'} WIB
💅 *Layanan*: ${serviceName}
📍 *Lokasi*: ${location}
🔖 *Kode Booking*: #${bookingCode || 'BKG-2026'}

Mohon hadir 10 menit sebelum waktu reservasi dimulai. Jika butuh penyesuaian jadwal atau konfirmasi ulang, silakan balas pesan ini. Terima kasih! 🙏`;

      // FIX (permintaan Mecca sesi205, 23 Agu -- baru dieksekusi sekarang, ditemukan
      // lewat audit ELIPS): dulu SEMUA tier workspace dapat link wa.me, padahal tier
      // Public (PUBLIC_SAAS) seharusnya pakai notifikasi in-app satu-arah, BUKAN
      // WhatsApp -- link wa.me cuma untuk tier Private (PRIVATE_ENTERPRISE). Tidak ada
      // migrasi schema/kolom DB baru di sini: status delivery cuma field baru di
      // response JSON (channel/status), endpoint ini dari awal memang tidak menulis
      // apapun ke database (murni generate pesan + link, lihat komentar lama di atas).
      const tierEntitlements = await getWorkspaceTierEntitlements(auth.workspace.id);
      const isPublicTier = tierEntitlements.tier === 'PUBLIC_SAAS';

      const directWaUrl = isPublicTier
        ? null
        : `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMessage)}`;

      return NextResponse.json({
        success: true,
        reminder: {
          customerName,
          customerPhone: cleanPhone,
          reminderMessage,
          directWaUrl,
          channel: isPublicTier ? 'in_app' : 'whatsapp',
          status: isPublicTier ? 'delivered_in_app' : 'ready_to_send',
          sentBy: auth.user.fullName,
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Pengingat booking gagal dibuat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
