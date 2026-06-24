"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import api from "@/lib/api";
import {
  AisPosition,
  FleetMapRelatedShipment,
  FleetMapVoyage,
  PositionSource,
  PositionTrackPoint,
  RevisedEtaResponse,
  RiskLevel,
} from "@/types";

// Leaflet CSS is injected at runtime to avoid SSR issues.
function ensureLeafletCSS() {
  if (typeof document === "undefined") return;
  const id = "leaflet-css";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

if (typeof window !== "undefined") ensureLeafletCSS();

interface FleetMapProps {
  voyages: FleetMapVoyage[];
  activeVoyageCount: number;
  shipmentScope: "all" | "mine";
  onShipmentScopeChange: (scope: "all" | "mine") => void;
  /** Optional callback invoked by the auto-refresh timer every 60 s.
   *  Wire up in page.tsx: onRefresh={handleManualRefresh} */
  onRefresh?: () => void;
}

type PositionTone = "live" | "degraded" | "unavailable";

// ─── Carrier helpers ──────────────────────────────────────────────────────────

function getCarrier(voyage: FleetMapVoyage) {
  return voyage.carrier?.trim() || "Carrier unavailable";
}

function getVoyageShipments(voyage: Pick<FleetMapVoyage, "relatedShipments">) {
  if (voyage.relatedShipments) return voyage.relatedShipments;
  return [];
}

// ─── Status + position helpers ───────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case "IN_TRANSIT":
      return "#2563eb";
    case "DEPARTED":
      return "#7c3aed";
    case "ARRIVED":
      return "#10b981";
    default:
      return "#6b7280";
  }
}

function hasCoordinates(position: AisPosition | null | undefined) {
  return position?.latitude != null && position?.longitude != null;
}

function getLastUpdate(position: AisPosition | null | undefined) {
  return position?.lastUpdate ?? position?.timestamp ?? null;
}

function isPositionEstimated(position: AisPosition | null | undefined) {
  return position?.positionEstimated ?? position?.estimated ?? false;
}

function getPositionSource(position: AisPosition | null | undefined): PositionSource {
  if (!position) return "UNAVAILABLE";
  if (position.positionSource) return position.positionSource;
  if (isPositionEstimated(position)) return "ESTIMATED";
  if (getLastUpdate(position)) return "LIVE_AIS";
  return "UNAVAILABLE";
}

function formatPositionSource(source: PositionSource) {
  switch (String(source).toUpperCase()) {
    case "LIVE_AIS":
      return "Live AIS";
    case "CACHED_AIS":
      return "Cached AIS";
    case "ESTIMATED":
      return "Estimated";
    case "UNAVAILABLE":
      return "Unavailable";
    default:
      return String(source).replace(/_/g, " ");
  }
}

function getPositionMeta(position: AisPosition | null | undefined) {
  const hasPosition = hasCoordinates(position);
  const source = getPositionSource(position);
  const estimated = isPositionEstimated(position);
  const normalizedSource = String(source).toUpperCase();

  if (!position || !hasPosition || normalizedSource === "UNAVAILABLE") {
    return {
      tone: "unavailable" as PositionTone,
      label: "Position unavailable",
      helper: "The API did not return a usable latitude/longitude for this voyage.",
      badgeBackground: "#e2e8f0",
      badgeColor: "#334155",
      markerColor: "#94a3b8",
    };
  }

  if (estimated || normalizedSource === "ESTIMATED") {
    return {
      tone: "degraded" as PositionTone,
      label: "Estimated position",
      helper: "The backend marked this position as estimated.",
      badgeBackground: "#fef3c7",
      badgeColor: "#92400e",
      markerColor: "#f59e0b",
    };
  }

  if (normalizedSource === "CACHED_AIS") {
    return {
      tone: "degraded" as PositionTone,
      label: "Cached AIS",
      helper: "The latest known AIS position was served from cache.",
      badgeBackground: "#ffedd5",
      badgeColor: "#9a3412",
      markerColor: "#f97316",
    };
  }

  return {
    tone: "live" as PositionTone,
    label: "Live AIS",
    helper: "The vessel has a live position from the backend.",
    badgeBackground: "#dbeafe",
    badgeColor: "#1d4ed8",
    markerColor: statusColor("IN_TRANSIT"),
  };
}

// ─── Risk helpers ─────────────────────────────────────────────────────────────

function riskColor(level: RiskLevel | null) {
  switch (level) {
    case "CRITICAL":
      return "#dc2626";
    case "HIGH":
      return "#f97316";
    case "MEDIUM":
      return "#f59e0b";
    case "LOW":
      return "#94a3b8";
    default:
      return "#cbd5e1";
  }
}

function riskBadgeStyles(level: RiskLevel | null) {
  switch (level) {
    case "CRITICAL":
      return { background: "#fee2e2", color: "#991b1b" };
    case "HIGH":
      return { background: "#ffedd5", color: "#9a3412" };
    case "MEDIUM":
      return { background: "#fef3c7", color: "#92400e" };
    case "LOW":
      return { background: "#e2e8f0", color: "#334155" };
    default:
      return { background: "#f1f5f9", color: "#64748b" };
  }
}

function aggregateRiskLevel(shipments: FleetMapRelatedShipment[]): RiskLevel | null {
  const severityOrder: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return shipments.reduce<RiskLevel | null>((currentHighest, shipment) => {
    if (!shipment.riskLevel) return currentHighest;
    if (!currentHighest) return shipment.riskLevel;
    return severityOrder.indexOf(shipment.riskLevel) > severityOrder.indexOf(currentHighest)
      ? shipment.riskLevel
      : currentHighest;
  }, null);
}

// ─── Icon factories ───────────────────────────────────────────────────────────

function vesselIcon(
  status: string,
  position: AisPosition | null | undefined,
  aggregatedRisk: RiskLevel | null
) {
  const meta = getPositionMeta(position);
  const color = meta.tone === "live" ? statusColor(status) : meta.markerColor;
  const ringColor = riskColor(aggregatedRisk);
  const svg = `<div style="width:28px;height:28px;border-radius:9999px;border:2px solid ${ringColor};
    background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(15,23,42,.15)">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
      <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
      <path d="M12 1v4"/></svg></div>`;
  return L.divIcon({
    html: svg,
    className: "vessel-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function portIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="4" fill="#10b981" stroke="#fff" stroke-width="1.5"/></svg>`;
  return L.divIcon({
    html: svg,
    className: "port-marker",
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function clusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div style="background:#2563eb;color:#fff;border-radius:50%;width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
      border:2px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.4)">${count}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtSpeed(speed: number | null) {
  return speed == null ? "N/A" : `${speed.toFixed(1)} kn`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function posAgo(lastUpdate: string | null) {
  if (!lastUpdate) return { label: "Unavailable", isOld: false };

  try {
    const elapsedMs = Date.now() - new Date(lastUpdate).getTime();
    const minutes = Math.floor(elapsedMs / 60_000);
    const hours = Math.floor(elapsedMs / 3_600_000);
    const label =
      minutes < 1
        ? "just now"
        : minutes < 60
          ? `${minutes} min ago`
          : `${hours}h ${minutes % 60}min ago`;

    return { label, isOld: hours >= 2 };
  } catch {
    return { label: "Unavailable", isOld: false };
  }
}

// ─── Map event helper ─────────────────────────────────────────────────────────

function MapDismissSelection({ onDismiss }: { onDismiss: () => void }) {
  useMapEvents({
    click() {
      onDismiss();
    },
  });

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FleetMap({
  voyages,
  activeVoyageCount,
  shipmentScope,
  onShipmentScopeChange,
  onRefresh,
}: FleetMapProps) {
  const router = useRouter();

  // ── Existing filter state ──
  const [carrierFilter, setCarrierFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState<FleetMapVoyage | null>(null);

  // ── TAREFA 2 — Auto-refresh state ──
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);

  // ── TAREFA 3 — Track & ETA state ──
  const [trackPoints, setTrackPoints] = useState<PositionTrackPoint[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [revisedEta, setRevisedEta] = useState<RevisedEtaResponse | null>(null);

  // ── Memos ──
  const carriers = useMemo(
    () => ["All", ...Array.from(new Set(voyages.map((voyage) => getCarrier(voyage)))).sort()],
    [voyages]
  );
  const statuses = useMemo(
    () => ["All", ...Array.from(new Set(voyages.map((voyage) => voyage.status))).sort()],
    [voyages]
  );

  const filteredVoyages = useMemo(
    () =>
      voyages.filter((voyage) => {
        if (
          shipmentScope === "mine" &&
          getVoyageShipments(voyage).length === 0
        ) {
          return false;
        }
        if (carrierFilter !== "All" && getCarrier(voyage) !== carrierFilter) return false;
        if (statusFilter !== "All" && voyage.status !== statusFilter) return false;
        return true;
      }),
    [voyages, carrierFilter, statusFilter, shipmentScope]
  );

  // Keep selection valid when filters change
  useEffect(() => {
    if (!selected) return;
    const stillVisible = filteredVoyages.some((voyage) => voyage.voyageId === selected.voyageId);
    if (!stillVisible) setSelected(null);
  }, [filteredVoyages, selected]);

  // ── TAREFA 2a — Auto-refresh interval (60 s) ──
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      onRefresh?.();
      setLastRefresh(new Date());
      setSecondsSinceRefresh(0);
    }, 60_000);

    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // ── TAREFA 2b — Seconds counter (1 s) ──
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setSecondsSinceRefresh((prev) => prev + 1);
    }, 1_000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // ── TAREFA 3b — Fetch track points + revised ETA when vessel selected ──
  useEffect(() => {
    if (!selected) {
      setTrackPoints([]);
      setRevisedEta(null);
      return;
    }

    let cancelled = false;
    const imo = selected.vesselImo;
    const voyageId = selected.voyageId;

    setTrackLoading(true);
    setTrackPoints([]);
    setRevisedEta(null);

    const trackPromise = imo
      ? api.get<PositionTrackPoint[]>(`/vessels/${imo}/track`, { params: { limit: 50 } })
      : Promise.reject(new Error("No IMO available for this vessel"));

    const etaPromise = api.get<RevisedEtaResponse>(`/voyages/${voyageId}/eta`);

    Promise.allSettled([trackPromise, etaPromise]).then(([trackResult, etaResult]) => {
      if (cancelled) return;

      if (trackResult.status === "fulfilled") {
        const pts = Array.isArray(trackResult.value.data) ? trackResult.value.data : [];
        // Sort ascending by occurredAt for correct polyline direction
        const sorted = [...pts].sort(
          (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
        );
        setTrackPoints(sorted);
      } else {
        console.warn("[FleetMap] Track fetch failed:", trackResult.reason);
        setTrackPoints([]);
      }

      if (etaResult.status === "fulfilled") {
        setRevisedEta(etaResult.value.data);
      } else {
        console.warn("[FleetMap] ETA fetch failed:", etaResult.reason);
        setRevisedEta(null);
      }

      setTrackLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.voyageId]);

  // ── Derived values ──
  const voyagesWithMarkers = filteredVoyages.filter((voyage) =>
    hasCoordinates(voyage.vesselPosition)
  );
  const voyagesWithoutPosition = filteredVoyages.filter(
    (voyage) => !hasCoordinates(voyage.vesselPosition)
  );

  const portMarkerIcon = useMemo(() => portIcon(), []);
  const selectedPosition = selected?.vesselPosition ?? null;
  const selectedLastUpdate = getLastUpdate(selectedPosition);
  const selectedAge = posAgo(selectedLastUpdate);
  const selectedPositionMeta = getPositionMeta(selectedPosition);

  const showEmptyState = activeVoyageCount === 0;
  const showUnavailableState =
    !showEmptyState && filteredVoyages.length > 0 && voyagesWithMarkers.length === 0;
  const showMineEmptyState =
    !showEmptyState && shipmentScope === "mine" && filteredVoyages.length === 0;
  const hasDegradedState = voyagesWithoutPosition.length > 0;

  const selectedShipments = selected ? getVoyageShipments(selected) : [];
  const selectedAggregatedRisk = selected?.aggregatedRiskLevel ?? aggregateRiskLevel(selectedShipments);
  const visibleShipmentCount = filteredVoyages.reduce(
    (total, voyage) => total + getVoyageShipments(voyage).length,
    0
  );

  // Track points as Leaflet positions (sorted ASC already)
  const trackPolylinePositions: [number, number][] = trackPoints.map(
    (pt) => [pt.lat, pt.lon]
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <style>{`
        .vessel-marker, .port-marker { background: transparent !important; border: none !important; }
        .leaflet-container { width: 100%; height: 100%; }
        .leaflet-popup-content-wrapper { border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
        .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large { background: transparent !important; }
        .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div { background: transparent !important; }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
        .refresh-dot-active { animation: pulse-dot 1.6s ease-in-out infinite; }
      `}</style>

      {/* ── Filter controls (existing) ── */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "90vw",
        }}
      >
        {/* Scope toggle */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,.95)",
            borderRadius: 8,
            padding: "4px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          }}
        >
          {[
            { value: "all" as const, label: "All vessels" },
            { value: "mine" as const, label: "My shipments" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onShipmentScopeChange(option.value)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: shipmentScope === option.value ? 700 : 500,
                background: shipmentScope === option.value ? "#0f172a" : "transparent",
                color: shipmentScope === option.value ? "#fff" : "#374151",
                transition: "all .15s",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Carrier filter */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,.95)",
            borderRadius: 8,
            padding: "4px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          }}
        >
          {carriers.map((carrier) => (
            <button
              key={carrier}
              onClick={() => setCarrierFilter(carrier)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: carrierFilter === carrier ? 700 : 500,
                background: carrierFilter === carrier ? "#2563eb" : "transparent",
                color: carrierFilter === carrier ? "#fff" : "#374151",
                transition: "all .15s",
              }}
            >
              {carrier}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,.95)",
            borderRadius: 8,
            padding: "4px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          }}
        >
          {statuses.map((status) => {
            const label = status === "All" ? "All Status" : status.replace(/_/g, " ");
            const color = status === "All" ? "#374151" : statusColor(status);
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: statusFilter === status ? 700 : 500,
                  background: statusFilter === status ? color : "transparent",
                  color: statusFilter === status ? "#fff" : color,
                  transition: "all .15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAREFA 2d — Auto-refresh status bar ── */}
      <div
        style={{
          position: "absolute",
          top: 58,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(15,23,42,.78)",
          backdropFilter: "blur(6px)",
          borderRadius: 20,
          padding: "5px 12px 5px 10px",
          boxShadow: "0 2px 10px rgba(0,0,0,.25)",
          fontSize: 12,
          color: "#e2e8f0",
          whiteSpace: "nowrap",
        }}
      >
        {/* Pulsing indicator dot */}
        <div
          className={autoRefresh ? "refresh-dot-active" : ""}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: autoRefresh ? "#22c55e" : "#6b7280",
            flexShrink: 0,
          }}
        />
        <span style={{ color: "#cbd5e1" }}>
          Updated{" "}
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
            {secondsSinceRefresh}s
          </span>{" "}
          ago{" "}
          <span style={{ color: "#64748b" }}>
            (at {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })})
          </span>
        </span>
        <button
          onClick={() => {
            setAutoRefresh((prev) => {
              if (!prev) {
                // Resuming — reset counter
                setSecondsSinceRefresh(0);
                setLastRefresh(new Date());
              }
              return !prev;
            });
          }}
          style={{
            marginLeft: 4,
            background: "rgba(255,255,255,.12)",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 12,
            padding: "2px 9px",
            cursor: "pointer",
            color: "#e2e8f0",
            fontSize: 11,
            fontWeight: 600,
            transition: "background .15s",
          }}
          title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
        >
          {autoRefresh ? "⏸ Pause" : "▶ Resume"}
        </button>
      </div>

      {/* ── Degraded state panel (existing) ── */}
      {hasDegradedState && (
        <div
          style={{
            position: "absolute",
            top: 76,
            left: 12,
            zIndex: 1000,
            width: 320,
            maxWidth: "calc(100vw - 24px)",
            background: "rgba(255,248,235,.96)",
            border: "1px solid #fcd34d",
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow: "0 8px 24px rgba(15,23,42,.12)",
            color: "#78350f",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Degraded fleet coverage
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>
            {voyagesWithoutPosition.length > 0 && (
              <div>
                {voyagesWithoutPosition.length} voyage{voyagesWithoutPosition.length !== 1 ? "s" : ""} loaded without a usable position.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty / unavailable overlay (existing) ── */}
      {(showEmptyState || showUnavailableState || showMineEmptyState) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,.94)",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "24px 28px",
              boxShadow: "0 20px 45px rgba(15,23,42,.14)",
              maxWidth: 420,
              textAlign: "center",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              {showEmptyState
                ? "No active voyages right now"
                : showMineEmptyState
                  ? "No shipment-linked voyages in this view"
                  : "Positions are temporarily unavailable"}
            </div>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              {showEmptyState
                ? "The API returned no voyages in transit or departed, so there is nothing to plot on the map."
                : showMineEmptyState
                  ? "The shipment endpoint returned no active voyages that match the current user scope and filters."
                  : "Active voyages were loaded, but none came back with usable latitude/longitude yet. Try refreshing in a few minutes."}
            </div>
          </div>
        </div>
      )}

      {/* ── Map scope legend (existing) ── */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 1000,
          background: "rgba(255,255,255,.96)",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "10px 12px",
          fontFamily: "system-ui, sans-serif",
          boxShadow: "0 10px 30px rgba(15,23,42,.12)",
          minWidth: 220,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Map scope
        </div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
          Showing {filteredVoyages.length} voyage{filteredVoyages.length !== 1 ? "s" : ""} and{" "}
          {visibleShipmentCount} shipment{visibleShipmentCount !== 1 ? "s" : ""}.
        </div>
      </div>

      {/* ── Leaflet Map ── */}
      <MapContainer
        center={[-20, -30]}
        zoom={3}
        style={{ position: "absolute", inset: 0 }}
        zoomControl
      >
        <MapDismissSelection onDismiss={() => setSelected(null)} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />

        {/* Voyage route lines + port markers */}
        {filteredVoyages.map((voyage) => {
          const position = voyage.vesselPosition;
          const hasPosition = hasCoordinates(position);

          return (
            <Fragment key={voyage.voyageId}>
              {/* Full route (dotted) */}
              <Polyline
                positions={[
                  [voyage.originLat, voyage.originLon],
                  [voyage.destinationLat, voyage.destinationLon],
                ]}
                pathOptions={{
                  color: "#94a3b8",
                  weight: 1.5,
                  dashArray: "8,6",
                  opacity: 0.7,
                }}
              />

              {/* Leg completed (solid) */}
              {hasPosition && (
                <Polyline
                  positions={[
                    [voyage.originLat, voyage.originLon],
                    [position!.latitude!, position!.longitude!],
                  ]}
                  pathOptions={{
                    color: getPositionMeta(position).tone === "live"
                      ? statusColor(voyage.status)
                      : getPositionMeta(position).markerColor,
                    weight: 1.5,
                    opacity: 0.9,
                  }}
                />
              )}

              <Marker
                position={[voyage.originLat, voyage.originLon]}
                icon={portMarkerIcon}
                opacity={1}
              />
              <Marker
                position={[voyage.destinationLat, voyage.destinationLon]}
                icon={portMarkerIcon}
                opacity={1}
              />
            </Fragment>
          );
        })}

        {/* ── TAREFA 3c — Historical track polyline for selected vessel ── */}
        {selected && trackPolylinePositions.length > 1 && (
          <Polyline
            positions={trackPolylinePositions}
            pathOptions={{
              color: "#60a5fa",
              weight: 2,
              opacity: 0.7,
              dashArray: "4 4",
            }}
          />
        )}

        {/* Vessel markers with cluster */}
        <MarkerClusterGroup
          chunkedLoading
          zoomToBoundsOnClick
          showCoverageOnHover={false}
          maxClusterRadius={60}
          disableClusteringAtZoom={8}
          iconCreateFunction={clusterIcon}
        >
          {filteredVoyages.map((voyage) => {
            const position = voyage.vesselPosition;
            if (!hasCoordinates(position)) return null;

            const positionMeta = getPositionMeta(position);
            const voyageShipments = getVoyageShipments(voyage);
            const aggregatedRisk = voyage.aggregatedRiskLevel ?? aggregateRiskLevel(voyageShipments);
            const riskStyles = riskBadgeStyles(aggregatedRisk);
            const isSelectedVoyage = selected?.voyageId === voyage.voyageId;

            return (
              <Marker
                key={voyage.voyageId}
                position={[position!.latitude!, position!.longitude!]}
                icon={vesselIcon(voyage.status, position, aggregatedRisk)}
                opacity={1}
                eventHandlers={{ click: () => setSelected(voyage) }}
              >
                <Popup>
                  <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                      {voyage.vesselName}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                      IMO {voyage.vesselImo}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                      <span
                        style={{
                          background: statusColor(voyage.status),
                          color: "#fff",
                          borderRadius: 4,
                          padding: "1px 7px",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {voyage.status.replace(/_/g, " ")}
                      </span>
                      <span
                        style={{
                          background: positionMeta.badgeBackground,
                          color: positionMeta.badgeColor,
                          borderRadius: 4,
                          padding: "1px 7px",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {positionMeta.label}
                      </span>
                      {aggregatedRisk && (
                        <span
                          style={{
                            background: riskStyles.background,
                            color: riskStyles.color,
                            borderRadius: 4,
                            padding: "1px 7px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Risk {aggregatedRisk}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
                      Carrier <span style={{ fontWeight: 600 }}>{getCarrier(voyage)}</span>
                    </div>

                    <div style={{ fontSize: 12, margin: "6px 0" }}>
                      <span style={{ fontWeight: 600 }}>{voyage.originPortUnlocode}</span>
                      <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>
                      <span style={{ fontWeight: 600 }}>{voyage.destinationPortUnlocode}</span>
                    </div>

                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      ETA <span style={{ color: "#374151", fontWeight: 500 }}>{fmtDate(voyage.eta)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      Source <span style={{ color: "#374151", fontWeight: 500 }}>
                        {formatPositionSource(getPositionSource(position))}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      Shipments <span style={{ color: "#374151", fontWeight: 500 }}>
                        {voyageShipments.length}
                      </span>
                    </div>

                    {/* ── TAREFA 4 — Route track indicator (selected vessel only) ── */}
                    {isSelectedVoyage && trackPoints.length > 0 && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        Route{" "}
                        <span style={{ color: "#2563eb", fontWeight: 500 }}>
                          {trackPoints.length} points tracked
                        </span>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* ── Drawer ── */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 320,
            maxWidth: "100vw",
            background: "#fff",
            zIndex: 1001,
            boxShadow: "-4px 0 20px rgba(0,0,0,.15)",
            overflowY: "auto",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Drawer header */}
          <div style={{ background: "#1e40af", color: "#fff", padding: "16px 16px 12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                  {selected.vesselName}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>IMO {selected.vesselImo}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "rgba(255,255,255,.2)",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                x
              </button>
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  background: "rgba(255,255,255,.2)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {selected.status.replace(/_/g, " ")}
              </span>
              <span
                style={{
                  background: "rgba(255,255,255,.15)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                }}
              >
                {getCarrier(selected)}
              </span>
              {selectedAggregatedRisk && (
                <span
                  style={{
                    ...riskBadgeStyles(selectedAggregatedRisk),
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Risk {selectedAggregatedRisk}
                </span>
              )}
              <span
                style={{
                  background: "rgba(255,255,255,.15)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                }}
              >
                {formatPositionSource(getPositionSource(selectedPosition))}
              </span>
            </div>
          </div>

          {/* Current voyage section */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 8,
              }}
            >
              Current Voyage
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
              <span style={{ color: "#6b7280" }}>Voyage:</span>{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                {selected.voyageNumber}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>From</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.originPortName}</div>
                <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                  {selected.originPortUnlocode}
                </div>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 18 }}>→</div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>To</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.destinationPortName}</div>
                <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                  {selected.destinationPortUnlocode}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>ETA</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtDate(selected.eta)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Carrier</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{getCarrier(selected)}</div>
              </div>
            </div>
          </div>

          {/* Position section */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 8,
              }}
            >
              Position
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Latitude</div>
                <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                  {selectedPosition?.latitude != null ? selectedPosition.latitude.toFixed(3) : "N/A"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Longitude</div>
                <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                  {selectedPosition?.longitude != null ? selectedPosition.longitude.toFixed(3) : "N/A"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Speed</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {fmtSpeed(selectedPosition?.speed ?? null)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Course</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {selectedPosition?.course != null ? `${selectedPosition.course}°` : "N/A"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Last update</div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: selectedAge.isOld ? "#f97316" : "#374151",
                  }}
                >
                  {selectedLastUpdate
                    ? `${fmtDate(selectedLastUpdate)} (${selectedAge.label})`
                    : "Unavailable"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Position source</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  {formatPositionSource(getPositionSource(selectedPosition))}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                background: selectedPositionMeta.badgeBackground,
                border: `1px solid ${selectedPositionMeta.badgeColor}33`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 12,
                color: selectedPositionMeta.badgeColor,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{selectedPositionMeta.label}</div>
              <div>{selectedPositionMeta.helper}</div>
            </div>

            {selectedAge.isOld && selectedPositionMeta.tone !== "unavailable" && (
              <div
                style={{
                  marginTop: 8,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "#c2410c",
                }}
              >
                The last update is older than two hours, so the plotted position may be stale.
              </div>
            )}
          </div>

          {/* Related shipments */}
          {selectedShipments.length > 0 && (
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 8,
                }}
              >
                Related Shipments
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedShipments.map((shipment) => {
                  const badge = riskBadgeStyles(shipment.riskLevel);
                  return (
                    <button
                      key={shipment.id}
                      type="button"
                      onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}
                      style={{
                        width: "100%",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "10px 12px",
                        background: "#f8fafc",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                          {shipment.booking}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              background: badge.background,
                              color: badge.color,
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {shipment.riskLevel}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                            View
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        {shipment.originPortUnlocode} → {shipment.destinationPortUnlocode}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        Status {shipment.status.replace(/_/g, " ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAREFA 3d — ETA Analysis section ── */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 10,
              }}
            >
              ETA Analysis
            </div>

            {/* Loading skeleton */}
            {trackLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    height: 16,
                    background: "#f1f5f9",
                    borderRadius: 6,
                    animation: "pulse-dot 1.4s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    height: 14,
                    background: "#f1f5f9",
                    borderRadius: 6,
                    width: "68%",
                    animation: "pulse-dot 1.4s ease-in-out infinite",
                  }}
                />
              </div>
            )}

            {/* Revised ETA available */}
            {!trackLoading && revisedEta && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                      Revised ETA
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {fmtDate(revisedEta.revisedEta)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                      Distance remaining
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {revisedEta.distanceNm.toFixed(0)} NM
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                      Current speed
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {revisedEta.speedKnots.toFixed(1)} kn
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    {/* Delay badge */}
                    {revisedEta.delayDays > 0 ? (
                      <span
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        Delayed {revisedEta.delayDays}d
                      </span>
                    ) : revisedEta.delayHours < 0 ? (
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#15803d",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        On time
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#f1f5f9",
                          color: "#475569",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        On schedule
                      </span>
                    )}
                  </div>
                </div>

                {/* Track point count */}
                {trackPoints.length > 0 && (
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {trackPoints.length} position update
                    {trackPoints.length !== 1 ? "s" : ""} recorded
                  </div>
                )}
              </div>
            )}

            {/* AIS unavailable */}
            {!trackLoading && !revisedEta && (
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", lineHeight: 1.5 }}>
                  ETA analysis unavailable — no AIS position
                </div>
                {trackPoints.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                    {trackPoints.length} position update
                    {trackPoints.length !== 1 ? "s" : ""} recorded
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid #f1f5f9",
              fontSize: 11,
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            Click on the map to dismiss
          </div>
        </div>
      )}
    </div>
  );
}
