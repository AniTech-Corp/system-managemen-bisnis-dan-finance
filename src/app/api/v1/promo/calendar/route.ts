import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { executeAIRequest } from '@/lib/ai-gateway';

// GET: Ambil daftar kalender konten tersimpan
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const calendars = await prisma.contentCalendar.findMany({
        where: { workspaceId: auth.workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return NextResponse.json({ calendars });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat kalender konten.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Susun Kalender Konten 7 Hari AI
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { title, industry = 'F&B & Retail', mainCampaign = 'Brand Awareness & Promo Mingguan' } = await req.json();

      if (!title || !title.trim()) {
        return NextResponse.json({ message: 'Judul kampanye konten wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'promo.calendar',
          userId: auth.user.id,
          customCost: 30,
          metadata: { title, industry },
        },
        async () => {
          const prompt = `Susun Rencana Kalender Konten Pemasaran 7 Hari untuk bisnis "${title}" (Industri: ${industry}).
Tema Utama: ${mainCampaign}.

Format output WAJIB JSON persis:
{
  "calendarTitle": "Kalender Konten 7 Hari: ${title}",
  "campaignTheme": "${mainCampaign}",
  "days": [
    {
      "day": 1,
      "dayName": "Senin",
      "pillar": "Edukasi & Masalah Pasar",
      "contentType": "Carousel Instagram / Infografis",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "12:30 WIB"
    },
    {
      "day": 2,
      "dayName": "Selasa",
      "pillar": "Behind The Scene & Standar Higienis",
      "contentType": "Reels / TikTok Video Pendek",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "19:00 WIB"
    },
    {
      "day": 3,
      "dayName": "Rabu",
      "pillar": "Testimoni & Bukti Sosial Pelanggan",
      "contentType": "Story + Feed Repost",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "17:30 WIB"
    },
    {
      "day": 4,
      "dayName": "Kamis",
      "pillar": "Penawaran Khusus & Promo Terbatas",
      "contentType": "Banner Promo / Single Image",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "11:45 WIB"
    },
    {
      "day": 5,
      "dayName": "Jumat",
      "pillar": "Interaksi, Kuis, & Polling Audiens",
      "contentType": "Interactive Story Polling",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "13:30 WIB"
    },
    {
      "day": 6,
      "dayName": "Sabtu",
      "pillar": "Tips Praktis & Hiburan Ringan",
      "contentType": "Video Tutorial / POV",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "16:00 WIB"
    },
    {
      "day": 7,
      "dayName": "Minggu",
      "pillar": "Rangkuman Mingguan & Countdown Promo",
      "contentType": "Weekly Highlights Video",
      "headlineIdea": "...",
      "visualConcept": "...",
      "bestPostingTime": "20:00 WIB"
    }
  ]
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            jsonMode: true,
            temperature: 0.6,
          });

          const calendarData = (aiRes.json && Array.isArray(aiRes.json.days) && aiRes.json.days.length > 0)
            ? aiRes.json
            : {
                calendarTitle: `Kalender Konten 7 Hari: ${title}`,
                campaignTheme: mainCampaign,
                days: [
                  { day: 1, dayName: 'Senin', pillar: 'Edukasi Pasar', contentType: 'Carousel Instagram', headlineIdea: `3 Alasan Kenapa Kamu Butuh ${title} Hari Ini`, visualConcept: 'Slide grafis minimalis kontras tinggi', bestPostingTime: '12:30 WIB' },
                  { day: 2, dayName: 'Selasa', pillar: 'Behind The Scene', contentType: 'Reels / TikTok', headlineIdea: 'Melihat Lebih Dekat Proses Pembuatan & Standar Kualitas', visualConcept: 'Video estetik proses produksi dengan audio viral', bestPostingTime: '19:00 WIB' },
                  { day: 3, dayName: 'Rabu', pillar: 'Social Proof', contentType: 'Testimoni Feed', headlineIdea: 'Apa Kata Mereka yang Sudah Mencoba Duluan?', visualConcept: 'Screenshot chat kepuasan pelanggan berlatar produk', bestPostingTime: '17:30 WIB' },
                  { day: 4, dayName: 'Kamis', pillar: 'Hard Sell Promo', contentType: 'Banner Iklan', headlineIdea: 'Flash Sale Eksklusif 24 Jam: Hemat Hingga 30%', visualConcept: 'Banner promo beraksen countdown merah/emas', bestPostingTime: '11:45 WIB' },
                  { day: 5, dayName: 'Jumat', pillar: 'Polling Interaktif', contentType: 'Story Quiz', headlineIdea: 'Tim Mana Kamu? Varian A vs Varian B!', visualConcept: 'Stiker polling IG Story dengan foto produk komparasi', bestPostingTime: '13:30 WIB' },
                  { day: 6, dayName: 'Sabtu', pillar: 'Tips & Tricks', contentType: 'Video Tips', headlineIdea: 'Cara Terbaik Memaksimalkan Pengalaman Bersama Kami', visualConcept: 'Panduan step-by-step singkat 30 detik', bestPostingTime: '16:00 WIB' },
                  { day: 7, dayName: 'Minggu', pillar: 'Weekly Recap', contentType: 'Highlights Carousel', headlineIdea: 'Momen Terbaik Minggu Ini & Persiapan Pekan Depan', visualConcept: 'Kompilasi foto pelanggan dan reminder jam buka', bestPostingTime: '20:00 WIB' },
                ],
              };

          // Simpan ke database
          const calendarTitle = calendarData.calendarTitle || title || 'Kalender Konten 7 Hari';
          const savedCalendar = await prisma.contentCalendar.create({
            data: {
              workspaceId,
              title: calendarTitle,
              planData: calendarData,
            },
          });

          return {
            calendar: calendarData,
            calendarId: savedCalendar.id,
            provider: aiRes.provider,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Kalender konten gagal disimpan.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
