
"use client";

import Header from '@/components/layout/header';
import { usePathname } from 'next/navigation';
import { useAuth, type AppModule } from '@/hooks/useAuth';
import { PlaneSpinner } from '@/components/ui/plane-spinner';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

// Define public paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];
const MODULE_PROTECTED_PATHS: { prefix: string; module: AppModule }[] = [
  { prefix: "/guide-liquidation", module: "liquidacion" },
];

export default function MainAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated, isLoading, isCurrentUserAdmin, currentUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const requiredModule = MODULE_PROTECTED_PATHS.find(({ prefix }) => pathname.startsWith(prefix))?.module;
  const hasRequiredModule = !requiredModule ||
    isCurrentUserAdmin ||
    (currentUser?.profile?.modules || []).includes(requiredModule);

  useEffect(() => {
    // If auth is not loading, we have a definitive answer about authentication
    if (!isLoading) {
      const isPublicPath = PUBLIC_PATHS.includes(pathname);
      
      // If the user is NOT authenticated and the path is NOT public
      if (!isAuthenticated && !isPublicPath) {
        logger.debug(`Redirecting to /login from protected route: ${pathname}`);
        router.replace("/login");
        return;
      }

      if (isAuthenticated && !isPublicPath && !hasRequiredModule) {
        logger.debug(`Redirecting to / from module-protected route: ${pathname}`);
        router.replace("/");
      }
    }
  }, [hasRequiredModule, isLoading, isAuthenticated, pathname, router]);

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

  if (isAuthenticated && !PUBLIC_PATHS.includes(pathname) && !hasRequiredModule) {
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
