
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Home, LogOut, UserCircle2, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '../ui/theme-toggle';
import { useState } from 'react';


export default function Header() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout, currentUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <header className="flex items-center justify-between mobile-padding bg-card border-b shadow-md sticky top-0 z-50">
      {/* Logo - Always visible */}
      <div className="flex items-center gap-2">
        <Link href="/" passHref>
          <div className="flex items-center gap-0 cursor-pointer hover:opacity-90 transition-all duration-200 touch-target group">
            <Image
              src="/logo.png"
              alt="TourFile Logo"
              width={40}
              height={40}
              className="h-8 w-8 sm:h-10 sm:w-10 object-contain dark:brightness-110 dark:contrast-110 transition-transform duration-200 group-hover:scale-105"
              priority
            />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight transition-all duration-200 group-hover:tracking-normal translate-y-0.5 -ml-1" style={{ color: '#42a5fe' }}>
              TourFile
            </h1>
          </div>
        </Link>
      </div>

      {/* Desktop Navigation - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/" passHref>
              <Button variant="ghost" size="icon" className="text-primary hover:bg-muted touch-target">
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
              <div className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 shadow-sm transition-all duration-200 ease-in-out hover:bg-primary/90 hover:shadow-md">
                <UserCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate max-w-[150px] lg:max-w-[200px] font-medium">{userDisplayName}</span>
              </div>
            )}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={logout}
                      className="touch-target py-2 text-destructive hover:bg-destructive/20 px-3"
                    >
                        <LogOut className="h-5 w-5 mr-2" />
                        <span>Salir</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Cerrar Sesión</p>
                </TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>

      {/* Mobile Navigation - Hamburger menu */}
      <div className="flex md:hidden items-center gap-2">
        <ThemeToggle />

        {isLoading ? (
          <Skeleton className="h-10 w-10 rounded-md" />
        ) : isAuthenticated ? (
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-target text-primary">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
              <SheetHeader>
                <SheetTitle className="text-left flex items-center gap-0">
                  <Image 
                    src="/logo.png" 
                    alt="TourFile Logo" 
                    width={28} 
                    height={28} 
                    className="h-7 w-7 object-contain dark:brightness-110 dark:contrast-110"
                  />
                  <span className="text-xl font-bold translate-y-0.5 -ml-1" style={{ color: '#42a5fe' }}>TourFile</span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-4 mt-6">
                {/* User info */}
                {userDisplayName && (
                  <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-3 shadow-sm">
                    <UserCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{userDisplayName}</span>
                  </div>
                )}

                {/* Navigation buttons */}
                <Link href="/" passHref onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full justify-start touch-target text-base">
                    <Home className="h-5 w-5 mr-3" />
                    Ir a Inicio
                  </Button>
                </Link>

                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  className="w-full justify-start touch-target text-base"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Cerrar Sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </header>
    </TooltipProvider>
  );
}
