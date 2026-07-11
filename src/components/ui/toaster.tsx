"use client";

import * as React from "react";
import { create } from "zustand";
import { CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }));
    setTimeout(() => {
      useToastStore.getState().dismiss(id);
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative toast API usable from anywhere (client side). */
export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "default" }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "error" }),
};

const ICONS: Record<ToastVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle2,
  error: OctagonAlert,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-lg animate-slide-up",
              t.variant === "success" && "border-success/40",
              t.variant === "error" && "border-destructive/40",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                t.variant === "default" && "text-primary",
                t.variant === "success" && "text-success",
                t.variant === "error" && "text-destructive",
              )}
            />
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
