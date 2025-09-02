
import type { Metadata } from 'next';
import '../globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";


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
      {/* Apply a simple body without the main layout's complexities */}
      <body className="font-body antialiased bg-white">
         <ThemeProvider
          attribute="class"
          defaultTheme="light" 
          forcedTheme="light" // Force light theme for printing
          enableSystem={false}
          disableTransitionOnChange
        >
            {children}
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
