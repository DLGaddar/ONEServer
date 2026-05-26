import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ONEServer — Sunucularını Tek Elden Yönet',
  description:
    'SSH bağlantıları, Docker konteynerleri ve sunucu metriklerini masaüstü ve mobil uygulamayla yönetin. Windows ve Android için ücretsiz.',
  keywords: ['server manager', 'SSH', 'Docker', 'ONEServer', 'sunucu yönetimi'],
  openGraph: {
    title: 'ONEServer — Sunucularını Tek Elden Yönet',
    description: 'SSH, Docker ve sunucu metriklerini tek platformda yönetin.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
