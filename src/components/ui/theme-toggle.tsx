"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // To prevent hydration mismatch, we render a disabled placeholder on the server.
  // The button will appear correctly on the client after mounting.
  if (!mounted) {
    return (
        <div className="fixed bottom-5 right-5 z-50">
            <Button variant="default" size="icon" className="h-14 w-14 rounded-full shadow-lg" disabled>
                 <span className="sr-only">Toggle theme</span>
            </Button>
        </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="icon" className="h-14 w-14 rounded-full shadow-lg">
           {theme === 'light' ? 
                <Sun className="h-[1.5rem] w-[1.5rem] transition-all" /> : 
                <Moon className="h-[1.5rem] w-[1.5rem] transition-all" />
           }
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Oscuro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
