"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastMessage {
  id: number;
  title: string;
  tone: "neutral" | "success" | "danger";
}

const ToastContext = React.createContext<((title: string, tone?: ToastMessage["tone"]) => void) | null>(
  null
);

/** `const notify = useToast(); notify("Saved", "success")`. */
export function useToast(): (title: string, tone?: ToastMessage["tone"]) => void {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);
  const nextId = React.useRef(0);

  const notify = React.useCallback((title: string, tone: ToastMessage["tone"] = "neutral") => {
    setMessages((prev) => [...prev, { id: nextId.current++, title, tone }]);
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {messages.map((m) => (
          <ToastPrimitive.Root
            key={m.id}
            onOpenChange={(open) => {
              if (!open) dismiss(m.id);
            }}
            className="flex animate-slide-up items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-e3"
          >
            {m.tone === "success" ? <Check className="size-4 shrink-0 text-success" /> : null}
            <ToastPrimitive.Title
              className={cn(
                "text-base",
                m.tone === "danger" ? "text-danger" : "text-fg"
              )}
            >
              {m.title}
            </ToastPrimitive.Title>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="ml-auto cursor-pointer text-fg-faint transition-colors hover:text-fg"
            >
              <X className="size-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-50 flex w-96 max-w-full flex-col gap-2 p-6 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
