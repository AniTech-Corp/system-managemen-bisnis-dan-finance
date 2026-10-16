import type { Metadata } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
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
    <html lang="id" class={`${inter.variable} ${outfit.variable} ${mono.variable}`}>
      <body class="bg-[#08090a] text-[#f7f8f8] antialiased selection:bg-[#5e6ad2] selection:text-white">
        {children}
      </body>
    </html>
  );
}
