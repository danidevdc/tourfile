"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, LogIn, LogOut, FileSpreadsheet, UserCircle2, UserPlus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


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
  
  if (isAuthPage) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={150}>
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b shadow-md sticky top-0 z-50">
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

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/" passHref>
              <Button variant="ghost" size="icon" className="text-primary dark:text-primary-foreground hover:bg-muted">
                <Home className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Ir a Inicio</span>
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ir a Inicio</p>
          </TooltipContent>
        </Tooltip>

        <ThemeToggle />

        {isLoading ? (
          <div className="flex items-center gap-2">
             <Skeleton className="h-9 w-24 rounded-md" />
             <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        ) : isAuthenticated ? (
          <>
            {userDisplayName && (
              <div className="hidden sm:flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 shadow-sm">
                <UserCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate max-w-[150px] md:max-w-[200px] font-medium">{userDisplayName}</span>
              </div>
            )}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/20" size="icon" onClick={logout}>
                        <LogOut className="h-5 w-5" />
                        <span className="sr-only">Salir</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Cerrar Sesión</p>
                </TooltipContent>
            </Tooltip>
          </>
        ) : (
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
    </TooltipProvider>
  );
}