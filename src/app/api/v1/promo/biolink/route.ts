import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { businessName, tagline, whatsappPhone = '6281234567890', locationAddress, socialLinks = {} } = await req.json();

      const name = businessName || auth.workspace.name;
      const cleanPhone = whatsappPhone.replace(/[^0-9]/g, '');

      const defaultWaOrderUrl = `https://wa.me/${cleanPhone}?text=Halo+${encodeURIComponent(name)},+saya+ingin+tanya+info+katalog+dan+promo+terbaru.`;

      const bioProfile = {
        businessName: name,
        tagline: tagline || 'Layanan Berkualitas & Produk Unggulan Terpercaya',
        whatsappPhone: cleanPhone,
        whatsappDirectUrl: defaultWaOrderUrl,
        locationAddress: locationAddress || 'Jakarta, Indonesia',
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (locationAddress || 'Jakarta'))}`,
        socialLinks: {
          instagram: socialLinks.instagram || `@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          tiktok: socialLinks.tiktok || `@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.official`,
          website: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.klir.site`,
        },
        actionButtons: [
          { label: '📲 Chat & Order via WhatsApp', url: defaultWaOrderUrl, isPrimary: true },
          { label: '📍 Petunjuk Arah Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`, isPrimary: false },
          { label: '📸 Lihat Portofolio Instagram', url: `https://instagram.com/${socialLinks.instagram || ''}`, isPrimary: false },
        ],
      };

      return NextResponse.json({
        success: true,
        bioProfile,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Biolink gagal dibuat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
