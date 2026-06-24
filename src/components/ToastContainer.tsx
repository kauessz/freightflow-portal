"use client";

import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/useToast";

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm">
          <Toast toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
