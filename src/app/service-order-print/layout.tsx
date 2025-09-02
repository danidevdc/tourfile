
import type { Metadata } from 'next';

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
        <style>{`
          body {
            font-family: 'Roboto', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background-color: white;
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
