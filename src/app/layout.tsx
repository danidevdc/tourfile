
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SonnerWrapper } from "@/components/sonner-wrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from '@/hooks/useAuth';

export const metadata: Metadata = {
  title: 'TourFile',
  description: 'Process tourism program files and generate Excel reports. Manage user accounts with Firebase.',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any' },
      { url: '/favicon.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
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
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <SonnerWrapper />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
