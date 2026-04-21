"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [spinning, setSpinning] = React.useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <div className="w-14 h-7 rounded-full bg-muted/50 animate-pulse" />
  }

  const isDark = theme === "dark"

  const toggleTheme = () => {
    if (spinning) return
    setSpinning(true)

    const doSwitch = () => setTheme(isDark ? "light" : "dark")

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // @ts-ignore
      document.startViewTransition(doSwitch)
    } else {
      doSwitch()
    }

    // Reset spinning after the animation completes
    setTimeout(() => setSpinning(false), 1000)
  }

  return (
    <>
      <style>{`
        @keyframes theme-wheel-spin {
          0%   { transform: translateX(var(--knob-from)) rotate(0deg); }
          55%  { transform: translateX(var(--knob-to)) rotate(360deg); }
          75%  { transform: translateX(var(--knob-to)) rotate(345deg); }
          90%  { transform: translateX(var(--knob-to)) rotate(362deg); }
          100% { transform: translateX(var(--knob-to)) rotate(360deg); }
        }
        @keyframes theme-icon-in {
          0%   { opacity: 0; transform: rotate(-180deg) scale(0.3); }
          100% { opacity: 1; transform: rotate(0deg)    scale(1);   }
        }
      `}</style>

      <button
        onClick={toggleTheme}
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        className="relative w-14 h-7 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background group"
        style={{
          backgroundColor: isDark ? "hsl(204 50% 22%)" : "hsl(187 79% 85%)",
          border: isDark ? "1px solid hsl(204 50% 32%)" : "1px solid hsl(187 79% 73%)",
          boxShadow: isDark
            ? "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "0 2px 4px rgba(0,0,0,0.1)",
          transition: "background-color 500ms ease, border-color 500ms ease, box-shadow 500ms ease",
        }}
      >
        {/* Knob */}
        <div
          className="absolute inset-y-0 my-auto h-6 w-6 rounded-full shadow-md overflow-hidden"
          style={{
            backgroundColor: isDark ? "hsl(204 60% 80%)" : "#ffffff",
            // When spinning, use the wheel animation; otherwise just slide
            animation: spinning
              ? `theme-wheel-spin 1000ms cubic-bezier(0.45,0,0.25,1) forwards`
              : "none",
            // CSS vars for the animation keyframes
            ["--knob-from" as string]: isDark ? "2px" : "28px",
            ["--knob-to"   as string]: isDark ? "28px" : "2px",
            // Static position when not animating
            transform: spinning ? undefined : isDark ? "translateX(28px)" : "translateX(2px)",
            transition: spinning ? "none" : "transform 500ms cubic-bezier(0.65,0,0.35,1), background-color 500ms",
          }}
        >
          {/* Centered icon wrapper — absolute fill so icons are always centered */}
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Sun — visible in light mode */}
            <Sun
              className="absolute h-3.5 w-3.5"
              style={{
                color: "hsl(187, 79%, 42%)",
                opacity: isDark ? 0 : 1,
                transform: isDark ? "scale(0)" : "scale(1)",
                transition: spinning ? "none" : "opacity 300ms, transform 300ms",
                animation: !isDark && spinning ? "theme-icon-in 350ms 500ms ease both" : "none",
              }}
            />
            {/* Moon — visible in dark mode */}
            <Moon
              className="absolute h-3.5 w-3.5"
              style={{
                color: "hsl(210, 55%, 28%)",
                opacity: isDark ? 1 : 0,
                transform: isDark ? "scale(1)" : "scale(0)",
                filter: isDark ? "drop-shadow(0 0 5px rgba(120,227,240,0.55))" : "none",
                transition: spinning ? "none" : "opacity 300ms, transform 300ms, filter 300ms",
                animation: isDark && spinning ? "theme-icon-in 350ms 500ms ease both" : "none",
              }}
            />
          </span>
        </div>

        {/* Subtle glow on hover */}
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            boxShadow: isDark
              ? "inset 0 0 12px rgba(120,227,240,0.15)"
              : "inset 0 0 12px rgba(9,145,234,0.15)",
            transition: "opacity 300ms",
          }}
        />
      </button>
    </>
  )
}
