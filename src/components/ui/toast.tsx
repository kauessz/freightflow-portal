"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export interface ToastItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const TYPE_STYLES = {
  success: {
    container: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: CheckCircle2,
    iconColor: "text-green-500",
  },
  error: {
    container: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: XCircle,
    iconColor: "text-red-500",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  info: {
    container: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    icon: Info,
    iconColor: "text-blue-500",
  },
} as const;

export function Toast({ toast, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger slide-in after mounting
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const duration = toast.duration ?? 4000;
    timerRef.current = setTimeout(() => handleDismiss(), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  function handleDismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }

  const styles = TYPE_STYLES[toast.type];
  const Icon = styles.icon;

  const translateClass =
    visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg w-full max-w-sm",
        "transition-all duration-300 ease-in-out",
        styles.container,
        translateClass,
      ].join(" ")}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${styles.iconColor}`} />
      <p className={`text-sm font-medium flex-1 leading-snug ${styles.text}`}>{toast.message}</p>
      <button
        type="button"
        onClick={handleDismiss}
        className={`shrink-0 ${styles.iconColor} hover:opacity-70 transition-opacity focus:outline-none`}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
