
"use client";

import Header from '@/components/layout/header';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PlaneSpinner } from '@/components/ui/plane-spinner';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

// Define public paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export default function MainAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // If auth is not loading, we have a definitive answer about authentication
    if (!isLoading) {
      const isPublicPath = PUBLIC_PATHS.includes(pathname);
      
      // If the user is NOT authenticated and the path is NOT public
      if (!isAuthenticated && !isPublicPath) {
        logger.debug(`Redirecting to /login from protected route: ${pathname}`);
        router.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // While loading authentication state, show a spinner.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PlaneSpinner className="h-12 w-12" />
      </div>
    );
  }
  
  // If the user is not authenticated and trying to access a protected route,
  // we show a spinner while the redirection happens.
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <PlaneSpinner className="h-12 w-12" />
        </div>
      );
  }

  // Render the full layout for authenticated users
  return (
    <>
      <Header />
      <main className="relative">
        {children}
      </main>
    </>
  );
}
