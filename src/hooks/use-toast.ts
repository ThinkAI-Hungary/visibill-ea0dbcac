/**
 * use-toast.ts — BRIDGE to Sonner
 *
 * This module provides the same `useToast()` / `toast()` API that the shadcn/ui
 * <Toaster> used, but delegates everything to Sonner behind the scenes.
 * The shadcn <Toaster> component has been removed from App.tsx (P0-4).
 *
 * Callers can continue to use:
 *   const { toast } = useToast();
 *   toast({ title: "Hello", description: "World" });
 *
 * …or the standalone function:
 *   import { toast } from "@/hooks/use-toast";
 *   toast({ title: "Error", variant: "destructive", description: msg });
 */

import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
  [key: string]: unknown;
}

function toast(opts: ToastOptions) {
  const { title, description, variant, duration } = opts;

  let toastId: string | number;

  // Map shadcn's "destructive" variant to Sonner's error style
  if (variant === "destructive") {
    toastId = sonnerToast.error(title ?? "Hiba", {
      description: typeof description === 'string' ? description : undefined,
      duration,
    });
  } else {
    toastId = sonnerToast(title ?? "", {
      description: typeof description === 'string' ? description : undefined,
      duration,
    });
  }

  return {
    dismiss: () => sonnerToast.dismiss(toastId),
  };
}

/**
 * Drop-in replacement for `const { toast } = useToast()`.
 * No state is needed — Sonner manages its own queue.
 */
function useToast() {
  return { toast, toasts: [], dismiss: () => {} };
}

export { useToast, toast };
