"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function SonnerWrapper() {
  const { theme } = useTheme();
  
  return (
    <Toaster 
      position="top-right" 
      richColors 
      closeButton 
      theme={theme as "light" | "dark" | "system"}
      toastOptions={{
        style: {
          fontSize: '14px',
        },
        className: 'sonner-toast',
      }}
    />
  );
}
