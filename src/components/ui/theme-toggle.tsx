"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  // "sliding" tracks whether the knob is mid-animation, and to where
  const [sliding, setSliding] = React.useState<"to-right" | "to-left" | null>(null)

  React.useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <div className="w-14 h-7 rounded-full bg-muted/50 animate-pulse" />
  }

  const isDark = theme === "dark"

  const toggleTheme = () => {
    if (sliding) return

    // Capture the direction BEFORE changing the theme
    const goingDark = !isDark
    setSliding(goingDark ? "to-right" : "to-left")

    const doSwitch = () => setTheme(goingDark ? "dark" : "light")

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // @ts-ignore
      document.startViewTransition(doSwitch)
    } else {
      doSwitch()
    }

    // Clear after animation completes — knob settles at its CSS-driven position
    setTimeout(() => setSliding(null), 380)
  }

  // Knob resting position is purely from theme state (no animation needed when settled)
  const knobResting = isDark ? "translateX(28px)" : "translateX(2px)"

  // While sliding, animate from where it was to where it's going
  const knobAnimation = sliding === "to-right"
    ? "sf-knob-right 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards"
    : sliding === "to-left"
    ? "sf-knob-left 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards"
    : "none"

  return (
    <>
      <style>{`
        @keyframes sf-knob-right {
          from { transform: translateX(2px);  }
          to   { transform: translateX(28px); }
        }
        @keyframes sf-knob-left {
          from { transform: translateX(28px); }
          to   { transform: translateX(2px);  }
        }
        @keyframes sf-icon-in {
          0%   { opacity: 0; transform: scale(0.3); }
          70%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
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
          transition: "background-color 350ms ease, border-color 350ms ease, box-shadow 350ms ease",
        }}
      >
        {/* Knob */}
        <div
          className="absolute inset-y-0 my-auto h-6 w-6 rounded-full shadow-md overflow-hidden"
          style={{
            backgroundColor: isDark ? "hsl(204 60% 80%)" : "#ffffff",
            // While sliding: run the keyframe animation (ignores transform below)
            // When settled: jump to resting position instantly (no transition needed,
            //   the animation already ended at the correct spot via "forwards")
            transform: sliding ? undefined : knobResting,
            animation: knobAnimation,
            transition: "background-color 350ms ease",
          }}
        >
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sun
              className="absolute h-3.5 w-3.5"
              style={{
                color: "hsl(187, 79%, 42%)",
                opacity: isDark ? 0 : 1,
                transform: isDark ? "scale(0)" : "scale(1)",
                // Animate in only when this icon is becoming visible
                animation: !isDark && sliding ? "sf-icon-in 280ms 200ms ease both" : "none",
                transition: sliding ? "none" : "opacity 250ms ease, transform 250ms ease",
              }}
            />
            <Moon
              className="absolute h-3.5 w-3.5"
              style={{
                color: "hsl(210, 55%, 28%)",
                opacity: isDark ? 1 : 0,
                transform: isDark ? "scale(1)" : "scale(0)",
                filter: isDark ? "drop-shadow(0 0 4px rgba(120,227,240,0.5))" : "none",
                animation: isDark && sliding ? "sf-icon-in 280ms 200ms ease both" : "none",
                transition: sliding ? "none" : "opacity 250ms ease, transform 250ms ease, filter 250ms ease",
              }}
            />
          </span>
        </div>

        {/* Hover glow */}
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow: isDark
              ? "inset 0 0 12px rgba(120,227,240,0.12)"
              : "inset 0 0 12px rgba(9,145,234,0.12)",
          }}
        />
      </button>
    </>
  )
}
