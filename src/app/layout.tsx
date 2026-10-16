import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Outfit, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
    title: 'KLIR — The AI Operating System for Modern Businesses',
    description: 'Purpose-built for financial strategy, operational intelligence, and workflow automation. Designed for the AI era.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="id" suppressHydrationWarning className={`bg-[#06080C] ${sans.variable} ${outfit.variable} ${mono.variable}`} style={{ backgroundColor: '#06080C', colorScheme: 'dark' }}>
            <body className="bg-[#0A0E15] text-[#F5F7FA] antialiased selection:bg-[#0058BE] selection:text-white">
                <Script src="/av-visuals.js" strategy="afterInteractive" />
                {children}
            </body>
        </html>
    );
}
