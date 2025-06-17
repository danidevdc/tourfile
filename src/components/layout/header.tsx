
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, LogOut, FileSpreadsheet, LogIn, UserPlus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function Header() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout, currentUser } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b shadow-md">
      <div className="flex items-center gap-2">
        <Link href="/" passHref>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-primary dark:text-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-primary dark:text-primary">
              TourFile Generator
            </h1>
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Link href="/" passHref>
          <Button variant="ghost" className="text-primary dark:text-primary-foreground hover:bg-muted dark:hover:bg-muted/50">
            <Home className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
            <span className="hidden md:inline">Inicio</span>
          </Button>
        </Link>
        {isLoading ? (
           <Skeleton className="h-9 w-20 md:w-24" />
        ) : isAuthenticated ? (
          <>
            {/* Optional: Display user name or avatar here */}
            {/* {currentUser && <span className="text-sm text-muted-foreground hidden sm:inline mr-2">Hola, {currentUser.firstName}</span>} */}
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
              <span className="hidden md:inline">Salir</span>
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" passHref>
              <Button variant="ghost" className="text-primary dark:text-primary-foreground hover:bg-muted dark:hover:bg-muted/50">
                <LogIn className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2" />
                <span className="hidden md:inline">Ingresar</span>
              </Button>
            </Link>
            <Link href="/register" passHref>
              <Button variant="default" size="sm" className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90">
                <UserPlus className="h-4 w-4 mr-2" />
                Registrarse
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
