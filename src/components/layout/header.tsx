
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  // No mostrar el header en la página de inicio si se prefiere un diseño más limpio para el landing
  // if (pathname === '/') {
  //   return null;
  // }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b shadow-md">
      <Link href="/" passHref>
        <h1 className="text-lg sm:text-xl font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity">
          TourFile Generator
        </h1>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/" passHref>
          <Button variant="ghost" className="hover:bg-muted hover:text-primary">
            <Home className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Inicio
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="hover:bg-muted hover:text-primary"
          onClick={() => alert('Log Out functionality is not yet implemented.')}
        >
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Salir
        </Button>
      </div>
    </header>
  );
}

