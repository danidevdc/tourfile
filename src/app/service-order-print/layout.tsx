
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Imprimir Orden de Servicio',
  description: 'Vista de impresión para la Orden de Servicio.',
};

// This is now a very simple layout that does not include <html> or <body> tags.
// It will be rendered inside the root layout, but without the main app's Header, etc.
export default function PrintLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main>
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          header, footer, aside, nav {
            display: none !important;
          }
        }
      `}</style>
      {children}
    </main>
  );
}
