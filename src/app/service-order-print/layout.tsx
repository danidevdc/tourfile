
import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Imprimir Orden de Servicio',
  description: 'Vista de impresión para la Orden de Servicio.',
};

export default function PrintLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
       <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      {/* 
        This is a simplified layout specifically for printing.
        It does not include ThemeProvider or any other complex client components
        to avoid hydration errors. The background is forced to white.
      */}
      <body className="font-body antialiased bg-white">
        {children}
      </body>
    </html>
  );
}
