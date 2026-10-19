import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Outfit, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
    title: 'Anitech — Sistem Finance & Monitoring Usaha',
    description: 'Sistem mandiri manajemen keuangan dan monitoring analitik performa usaha Anitech.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="id" suppressHydrationWarning className={`bg-slate-50 ${sans.variable} ${outfit.variable} ${mono.variable}`} style={{ backgroundColor: '#F8FAFC', colorScheme: 'light' }}>
            <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
                <Script src="/av-visuals.js" strategy="afterInteractive" />
                {children}
            </body>
        </html>
    );
}
