
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/layout/header'; // Importar el Header

export const metadata: Metadata = {
  title: 'TourFile Generator',
  description: 'Process tourism program files and generate Excel reports.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Header />
        <main className="pt-20 md:pt-24"> {/* Ajustado para header fijo. pt-20 es aprox 5rem, puede necesitar ajuste fino */}
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
