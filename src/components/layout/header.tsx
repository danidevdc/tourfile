
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, LogIn, LogOut, FileSpreadsheet, UserCircle2, UserPlus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function Header() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout, currentUser } = useAuth();
  
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

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
  
  // Don't render the header on auth pages for a cleaner look
  if (isAuthPage) {
    return null;
  }

  const renderAuthSkeletons = () => (
    <>
      <Skeleton className="h-9 w-36 rounded-md" />
      <Skeleton className="h-9 w-9 rounded-md" />
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-9 w-20 rounded-md" />
    </>
  );

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b shadow-md sticky top-0 z-50">
      {/* Logo and Title */}
      <div className="flex items-center gap-2">
        <Link href="/" passHref>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-primary">
              TourFile
            </h1>
          </div>
        </Link>
      </div>

      {/* Actions: Theme Toggle and Auth Buttons */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {isLoading ? (
          <div className="flex items-center gap-2">
             <Skeleton className="h-9 w-24 rounded-md" />
             <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        ) : isAuthenticated ? (
          // Authenticated view
          <>
            {userDisplayName && (
              <div className="hidden sm:flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 shadow-sm">
                <UserCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate max-w-[150px] md:max-w-[200px] font-medium">{userDisplayName}</span>
              </div>
            )}
            <Button variant="ghost" className="text-destructive hover:bg-destructive/20 px-2 md:px-3" onClick={logout}>
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
              <span className="hidden md:inline">Salir</span>
            </Button>
          </>
        ) : (
          // Unauthenticated view (Header is not shown on login pages, but this is a fallback)
          <>
             <Link href="/login" passHref>
              <Button variant="default">
                <LogIn className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
                <span className="inline sm:hidden">Entrar</span>
              </Button>
            </Link>
            <Link href="/register" passHref>
              <Button variant="outline">
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="hidden sm:inline">Registrarse</span>
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
