
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
