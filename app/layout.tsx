import type { Metadata } from 'next';
import { Outfit, Archivo_Black, Share_Tech_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Mela - TechnoMania 2.0',
  description: 'The Future is Fun. Play to Earn Stonks at the AI Mela.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${archivoBlack.variable} ${shareTechMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
