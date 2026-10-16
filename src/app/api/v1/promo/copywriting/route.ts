import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { executeAIRequest } from '@/lib/ai-gateway';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { productName, productDesc, targetAudience, promoTone = 'SKENA_JAKSEL', promoAngle = 'DISKON_GAJIAN' } = await req.json();

      if (!productName || !productName.trim()) {
        return NextResponse.json({ message: 'Nama produk / layanan promosi wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // Map deskripsi gaya bahasa lokal
      let toneDescription = 'Gaya kasual anak muda metropolitan kekinian (Skena Jaksel, catchy, relatable)';
      if (promoTone === 'RAMAH_SELLER') {
        toneDescription = 'Gaya ramah seller marketplace e-commerce (Halo Kakak Sayang, ready stock bestie, gercep, emotikon ceria)';
      } else if (promoTone === 'FORMAL_KORPORAT') {
        toneDescription = 'Gaya profesional korporat B2B (Elegance, data-driven, fokus efisiensi bisnis, terpercaya)';
      } else if (promoTone === 'STORYTELLING') {
        toneDescription = 'Gaya narasi storytelling emosional yang menyentuh masalah nyata sebelum memberikan solusi produk';
      }

      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'promo.copywriting',
          userId: auth.user.id,
          customCost: 20,
          metadata: { productName, promoTone, promoAngle },
        },
        async () => {
          const prompt = `Buatkan materi promosi multi-platform lengkap untuk produk: "${productName}".
Deskripsi Produk: ${productDesc || 'Produk unggulan berkualitas tinggi'}.
Target Audiens: ${targetAudience || 'Masyarakat umum & profesional di Indonesia'}.
Gaya Bahasa: ${toneDescription}.
Angle Promosi: ${promoAngle}.

Format output WAJIB JSON persis:
{
  "productName": "${productName}",
  "toneUsed": "${promoTone}",
  "instagram": {
    "headline": "...",
    "caption": "...",
    "callToAction": "...",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "tiktok": {
    "hook3Detik": "...",
    "scriptVideo": "...",
    "callToAction": "..."
  },
  "whatsappBroadcast": {
    "salamPembuka": "...",
    "isiPesan": "...",
    "linkPemesanan": "https://wa.me/6281234567890?text=Halo+saya+mau+order+${encodeURIComponent(productName)}"
  },
  "metaAds": {
    "adHeadline": "...",
    "primaryText": "...",
    "ctaButton": "Pesan Sekarang / Beli Sekarang"
  }
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            jsonMode: true,
            temperature: 0.7,
          });

          // FIX (audit workflow, sesi ini): fallback ini dulu tidak berpenanda, dan
          // response tetap membawa provider ASLI (groq/openrouter) walau isinya template
          // statis -- user/frontend tidak bisa membedakan dari hasil AI genuine.
          const isFallback = !aiRes.json;
          const copywritingData = aiRes.json || {
            productName,
            toneUsed: promoTone,
            instagram: {
              headline: `🔥 Jangan Sampai Ketinggalan: ${productName}!`,
              caption: `Siapa bilang cari yang berkualitas itu susah? Kenalin ${productName}, solusi terbaik buat kamu yang ga mau ribet. Kualitas terjamin, harga bersahabat, dan pastinya bikin harimu makin produktif!`,
              callToAction: '👉 Klik link di bio buat amankan promo spesial hari ini sebelum kehabisan slot!',
              hashtags: ['#BisnisLokal', '#UMKMIndonesia', '#PromoSpesial', '#RekomendasiProduk', '#ViralIndonesia'],
            },
            tiktok: {
              hook3Detik: 'POV: Kamu nemu produk yang bikin hidup 10x lebih gampang tapi belum banyak yang tahu!',
              scriptVideo: `Buka video dengan tunjukin masalah sehari-hari. Lalu reveal ${productName}. Tunjukin cara pakainya yang simpel dalam 5 detik. Kasih info diskon khusus followers!`,
              callToAction: 'Klik keranjang kuning sekarang sebelum promo berakhir ya guys!',
            },
            whatsappBroadcast: {
              salamPembuka: 'Halo Sahabat Terbaik! 👋',
              isiPesan: `Kabar gembira! Khusus pelanggan setia kami, produk ${productName} lagi ada promo potongan harga istimewa. Stok terbatas hanya untuk 50 pemesan pertama hari ini.`,
              linkPemesanan: `https://wa.me/6281234567890?text=Halo+saya+mau+order+${encodeURIComponent(productName)}`,
            },
            metaAds: {
              adHeadline: `${productName} — Solusi Cerdas Bisnis Modern`,
              primaryText: `Tingkatkan efisiensi dan kualitas hari Anda bersama ${productName}. Garansi kepuasan & pengiriman cepat ke seluruh Indonesia.`,
              ctaButton: 'Pesan Sekarang',
            },
          };

          return {
            copywriting: copywritingData,
            generatedBy: auth.user.fullName,
            provider: aiRes.provider,
            isSampleData: isFallback,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Copywriting gagal diproses.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
