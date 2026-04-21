
"use client"

// useToast re-routed to Sonner so all toasts share one consistent style.
// The external API (title, description, variant) is preserved — no call sites change.
import * as React from "react"
import { toast as sonnerToast } from "sonner"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type Toast = Omit<ToasterToast, "id">

// Map shadcn variant → Sonner method
function toast({ title, description, variant, duration }: Toast) {
  const msg = title as string | undefined
  const opts = {
    description: description as string | undefined,
    duration: duration ?? 4000,
  }

  if (variant === "destructive") {
    sonnerToast.error(msg, opts)
  } else if ((variant as string) === "success") {
    sonnerToast.success(msg, opts)
  } else {
    sonnerToast(msg, opts)
  }

  // Return a no-op shim so callers that use .dismiss() don't break
  return { id: "", dismiss: () => {}, update: () => {} }
}

function useToast() {
  return {
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (_toastId?: string) => {},
  }
}

export { useToast, toast }
