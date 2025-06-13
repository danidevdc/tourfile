
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, LogOut, FileSpreadsheet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b shadow-md">
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
      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Link href="/" passHref>
          <Button variant="ghost" className="text-primary hover:bg-muted">
            <Home className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Inicio
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="text-primary hover:bg-muted"
          onClick={() => alert('Log Out functionality is not yet implemented.')}
        >
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Salir
        </Button>
      </div>
    </header>
  );
}
