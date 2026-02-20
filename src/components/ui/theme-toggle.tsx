
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Evitar hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-14 h-7 rounded-full bg-muted/50 animate-pulse" />
    )
  }

  const isDark = theme === "dark"

  const toggleTheme = () => {
    // Use View Transitions API for smooth theme change
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      // @ts-ignore - startViewTransition is experimental
      document.startViewTransition(() => {
        setTheme(isDark ? "light" : "dark")
      })
    } else {
      // Fallback for browsers without View Transitions
      setTheme(isDark ? "light" : "dark")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background group"
      style={{
        backgroundColor: isDark ? 'hsl(204 50% 25%)' : 'hsl(187 79% 85%)',
        border: isDark ? '1px solid hsl(204 50% 35%)' : '1px solid hsl(187 79% 75%)',
        boxShadow: isDark 
          ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
          : '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {/* Knob (círculo que se desliza) */}
      <div
        className="absolute inset-y-0 my-auto h-6 w-6 rounded-full shadow-md transition-all duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] flex items-center justify-center"
        style={{
          backgroundColor: isDark ? 'hsl(204 50% 85%)' : '#FFFFFF',
          transform: isDark ? 'translateX(28px)' : 'translateX(2px)',
        }}
      >
        {/* Sol - visible en modo claro (celeste) */}
        <Sun
          className="absolute h-4 w-4 transition-all duration-300"
          style={{
            color: 'hsl(187, 79%, 50%)', // Celeste turquesa
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)',
          }}
        />

        {/* Luna - visible en modo oscuro (azul oscuro con glow) */}
        <Moon
          className="absolute h-4 w-4 transition-all duration-400"
          style={{
            color: 'hsl(210, 50%, 35%)', // Azul oscuro
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
            filter: isDark ? 'drop-shadow(0 0 8px rgba(120, 227, 240, 0.6))' : 'none',
            transitionDelay: isDark ? '200ms' : '0ms',
          }}
        />
      </div>

      {/* Hover effect - sutil resplandor */}
      <div
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: isDark
            ? '0 0 12px rgba(254, 252, 215, 0.3) inset'
            : '0 0 12px rgba(9, 145, 234, 0.2) inset',
        }}
      />
    </button>
  )
}
