
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, LogOut, FileSpreadsheet, UserCircle2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';

export default function Header() {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout, currentUser } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isOnAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

  let userDisplayName = "";
  if (currentUser) {
    if (currentUser.profile && currentUser.profile.firstName) {
      userDisplayName = currentUser.profile.firstName;
      if (currentUser.profile.lastName) {
        userDisplayName += ` ${currentUser.profile.lastName}`;
      }
    } else if (currentUser.email) {
      userDisplayName = currentUser.email;
    }
  }
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b shadow-md">
      {/* Logo and Title */}
      <div className="flex items-center gap-2">
        <Link href="/" passHref>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-primary">
              TourFile Generator
            </h1>
          </div>
        </Link>
      </div>

      {/* Actions: Theme Toggle and Auth Buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        {isMounted ? ( // Only render the dynamic content on the client after mount
            <>
            {isLoading ? (
                // While loading, show a skeleton that matches the likely final state to reduce layout shift
                 !isOnAuthPage && (
                    <>
                        <Skeleton className="h-9 w-36 rounded-md" />
                        <Skeleton className="h-9 w-9 rounded-md" />
                        <Skeleton className="h-9 w-20 rounded-md" />
                        <Skeleton className="h-9 w-20 rounded-md" />
                    </>
                )
            ) : isAuthenticated ? (
              // Authenticated view
              <>
                {userDisplayName && (
                  <div className="flex items-center gap-1.5 bg-background text-primary rounded-md px-3 py-1.5 border border-primary/50 shadow-sm">
                    <UserCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate max-w-[150px] md:max-w-[200px] font-medium">{userDisplayName}</span>
                  </div>
                )}
                <ThemeToggle />
                <Link href="/" passHref>
                  <Button variant="ghost" className="text-primary hover:bg-muted dark:hover:bg-primary/20 px-2 md:px-3">
                    <Home className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
                    <span className="hidden md:inline">Inicio</span>
                  </Button>
                </Link>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/20 px-2 md:px-3" onClick={logout}>
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
                  <span className="hidden md:inline">Salir</span>
                </Button>
              </>
            ) : (
              // Unauthenticated view
              !isOnAuthPage && (
                <>
                  <ThemeToggle />
                  <Link href="/" passHref>
                    <Button variant="ghost" className="text-primary hover:bg-muted dark:hover:bg-primary/20 px-2 md:px-3">
                      <Home className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
                      <span className="hidden md:inline">Inicio</span>
                    </Button>
                  </Link>
                </>
              )
            )}
          </>
        ) : (
            // This is what renders on the server and the first client render.
            // It MUST be consistent and not depend on auth state.
            // We render the skeleton for the unauthenticated view.
            !isOnAuthPage && (
                <>
                    <Skeleton className="h-9 w-9 rounded-md" /> {/* Placeholder for Theme Toggle */}
                    <Skeleton className="h-9 w-20 rounded-md" /> {/* Placeholder for Home Button */}
                </>
            )
        )}
      </div>
    </header>
  );
}
