import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==================== Date Formatting ====================

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ETA curto: "08 Apr 2026" */
export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Formato pt-BR para timeline: "28 mar. 2026, 14:30" */
export function formatDateTimePtBR(dateString: string): string {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ==================== Relative Time ====================

export function timeAgo(dateString: string): { label: string; isStale: boolean } {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let label: string;
  if (diffMins < 1) label = "just now";
  else if (diffMins < 60) label = `${diffMins} min ago`;
  else if (diffHours < 24) label = `${diffHours}h ago`;
  else label = `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return { label, isStale: diffDays >= 5 };
}

/** Retorna true se a ETA já passou e o embarque ainda não chegou */
export function isEtaOverdue(eta: string, status: string): boolean {
  const finishedStatuses = ["ARRIVED", "DELIVERED", "GATE_OUT", "CANCELLED"];
  if (finishedStatuses.includes(status)) return false;
  return new Date(eta) < new Date();
}

// ==================== Status ====================

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    BOOKED: "bg-gray-100 text-gray-700 border-gray-300",
    CONFIRMED: "bg-sky-100 text-sky-700 border-sky-300",
    GATE_IN: "bg-amber-100 text-amber-700 border-amber-300",
    LOADED: "bg-orange-100 text-orange-700 border-orange-300",
    IN_TRANSIT: "bg-blue-100 text-blue-700 border-blue-300",
    ARRIVED: "bg-green-100 text-green-700 border-green-300",
    GATE_OUT: "bg-lime-100 text-lime-700 border-lime-300",
    DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-400",
    CANCELLED: "bg-red-100 text-red-700 border-red-300",
  };
  return colors[status] || "bg-gray-100 text-gray-700 border-gray-300";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    BOOKED: "Booked",
    CONFIRMED: "Confirmed",
    GATE_IN: "Gate In",
    LOADED: "Loaded",
    IN_TRANSIT: "In Transit",
    ARRIVED: "Arrived",
    GATE_OUT: "Gate Out",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status;
}

export function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    GATE_IN: "Gate In",
    LOADED: "Loaded on Vessel",
    DEPARTED: "Departed",
    TRANSSHIPMENT: "Transshipment",
    ARRIVED: "Arrived at Destination",
    GATE_OUT: "Gate Out",
    CUSTOMS_HOLD: "Customs Hold",
    CUSTOMS_RELEASE: "Customs Released",
  };
  return labels[type] || type.replace(/_/g, " ");
}
