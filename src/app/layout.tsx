
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/layout/header';
import { ThemeProvider } from "@/components/theme-provider";
import ProtectedRoute from '@/components/layout/ProtectedRoute'; // Import ProtectedRoute

export const metadata: Metadata = {
  title: 'TourFile Generator',
  description: 'Process tourism program files and generate Excel reports. Manage user accounts with Firebase.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Use an inline SVG for the favicon to match the app's logo */}
        <link 
          rel="icon" 
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(9,145,234)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 12.5v4.75a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h4.75'/><path d='M14 2v4a2 2 0 0 0 2 2h4'/><path d='M9.5 14a1.5 1.5 0 0 1-3 0V10a1.5 1.5 0 0 1 3 0v4Z'/><path d='M15 10v4a1.5 1.5 0 0 0 3 0v-4a1.5 1.5 0 0 0-3 0Z'/></svg>"
          type="image/svg+xml"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <main className="pt-20 md:pt-24">
            <ProtectedRoute>{children}</ProtectedRoute> {/* Wrap children with ProtectedRoute */}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
