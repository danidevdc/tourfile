
"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Sun className="h-[1.5rem] w-[1.5rem] scale-100 transition-all dark:scale-0 [.light_&]:scale-100 [.dark_&]:scale-0 [.system_&]:scale-0" />
          <Moon className="absolute h-[1.5rem] w-[1.5rem] scale-0 transition-all dark:scale-100 [.light_&]:scale-0 [.dark_&]:scale-100 [.system_&]:scale-0" />
          <Monitor className="absolute h-[1.5rem] w-[1.5rem] scale-0 transition-all [.system_&]:scale-100" />
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
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
