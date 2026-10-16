import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'KLIR — The AI operating system for teams and agents',
  description: 'Purpose-built for financial strategy, operational intelligence, and workflow automation. Designed for the AI era.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" class={`${sans.variable} ${outfit.variable} ${mono.variable}`}>
      <body class="bg-[#08090a] text-[#f7f8f8] antialiased selection:bg-[#0058be] selection:text-white">
        {children}
      </body>
    </html>
  );
}
