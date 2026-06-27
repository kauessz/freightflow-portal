"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Ship,
  Loader2,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import RequireAuth from "@/components/require-auth";
import api from "@/lib/api";
import {
  ActiveVesselWithShipmentsResponse,
  FleetMapVoyage,
  AisPosition,
  FleetMapRelatedShipment,
  RiskLevel,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Leaflet must be dynamically imported (needs window/document)
const FleetMap = dynamic(() => import("./fleet-map"), { ssr: false });

type ShipmentScope = "all" | "mine";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRiskLevel(value: unknown): RiskLevel | null {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL") {
    return value;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isFleetMapRelatedShipment(value: unknown): value is FleetMapRelatedShipment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.booking === "string" &&
    typeof value.status === "string" &&
    typeof value.vesselName === "string" &&
    typeof value.voyageNumber === "string" &&
    typeof value.originPortName === "string" &&
    typeof value.originPortUnlocode === "string" &&
    typeof value.destinationPortName === "string" &&
    typeof value.destinationPortUnlocode === "string" &&
    typeof value.eta === "string"
  );
}

function readRelatedShipments(value: unknown): FleetMapRelatedShipment[] {
  return Array.isArray(value) ? value.filter(isFleetMapRelatedShipment) : [];
}

function normalizePosition(position: AisPosition | null | undefined): AisPosition | null {
  if (!position) return null;

  const lastUpdate = position.lastUpdate ?? position.timestamp ?? null;
  const positionEstimated = position.positionEstimated ?? position.estimated ?? false;
  const positionSource =
    position.positionSource ??
    (positionEstimated ? "ESTIMATED" : lastUpdate ? "LIVE_AIS" : "UNAVAILABLE");

  return {
    ...position,
    latitude: position.latitude ?? null,
    longitude: position.longitude ?? null,
    status: position.status ?? null,
    lastUpdate,
    positionSource,
    positionEstimated,
  };
}

function normalizeActiveFleetVoyage(item: ActiveVesselWithShipmentsResponse): FleetMapVoyage | null {
  const voyageId = readString(item.voyageId);
  const voyageNumber = readString(item.voyageNumber);
  const status = readString(item.status);
  const vesselName = readString(item.vesselName) ?? readString(item.name);
  const vesselImo = readString(item.vesselImo) ?? readString(item.imo);
  const originPortName = readString(item.originPortName);
  const originPortUnlocode = readString(item.originPortUnlocode);
  const destinationPortName = readString(item.destinationPortName) ?? readString(item.destPortName);
  const destinationPortUnlocode =
    readString(item.destinationPortUnlocode) ?? readString(item.destPortUnlocode);
  const etd = readString(item.etd);
  const eta = readString(item.eta);

  if (
    !voyageId ||
    !voyageNumber ||
    !status ||
    !vesselName ||
    !vesselImo ||
    !originPortName ||
    !originPortUnlocode ||
    !destinationPortName ||
    !destinationPortUnlocode ||
    !etd ||
    !eta
  ) {
    return null;
  }

  const flattenedPosition =
    readNumber(item.latitude) != null || readNumber(item.longitude) != null || item.lastUpdate
      ? {
          imo: vesselImo,
          latitude: readNumber(item.latitude),
          longitude: readNumber(item.longitude),
          speed: null,
          course: null,
          status: null,
          lastUpdate: readString(item.lastUpdate),
          positionSource: item.positionSource ?? null,
          positionEstimated: readBoolean(item.positionEstimated),
        }
      : null;

  return {
    vesselId: readString(item.vesselId),
    voyageId,
    voyageNumber,
    status,
    vesselName,
    vesselImo,
    carrier: readString(item.carrier),
    originPortName,
    originPortUnlocode,
    originLat: readNumber(item.originLat) ?? 0,
    originLon: readNumber(item.originLon) ?? 0,
    destinationPortName,
    destinationPortUnlocode,
    destinationLat: readNumber(item.destinationLat) ?? 0,
    destinationLon: readNumber(item.destinationLon) ?? 0,
    etd,
    eta,
    vesselPosition: normalizePosition(item.vesselPosition ?? flattenedPosition),
    aggregatedRiskLevel: readRiskLevel(item.aggregatedRiskLevel),
    shipmentCount: readNumber(item.shipmentCount),
    relatedShipments: readRelatedShipments(item.relatedShipments),
  };
}

function hasCoordinates(position: AisPosition | null | undefined) {
  return position?.latitude != null && position?.longitude != null;
}

function dedupeVoyagesByImo(voyages: FleetMapVoyage[]) {
  const uniqueByImo = new Map<string, FleetMapVoyage>();

  voyages.forEach((voyage) => {
    const current = uniqueByImo.get(voyage.vesselImo);
    if (!current) {
      uniqueByImo.set(voyage.vesselImo, voyage);
      return;
    }

    const currentHasCoordinates = hasCoordinates(current.vesselPosition);
    const nextHasCoordinates = hasCoordinates(voyage.vesselPosition);
    if (!currentHasCoordinates && nextHasCoordinates) {
      uniqueByImo.set(voyage.vesselImo, voyage);
    }
  });

  return Array.from(uniqueByImo.values());
}

function MapPageContent() {
  const router = useRouter();

  const [activeVoyageCount, setActiveVoyageCount] = useState(0);
  const [trackingData, setTrackingData] = useState<FleetMapVoyage[]>([]);
  const [shipmentScope, setShipmentScope] = useState<ShipmentScope>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // FIX 2: replaced countdown + auto-refresh with a simple "last updated" timestamp
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchFleetPositions = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const activeVesselsRes = await api.get<
        ActiveVesselWithShipmentsResponse[] | { data?: ActiveVesselWithShipmentsResponse[] }
      >("/vessels/active-with-shipments");
      const activeVesselsPayload = Array.isArray(activeVesselsRes.data)
        ? activeVesselsRes.data
        : activeVesselsRes.data?.data || [];
      const normalizedActiveVessels = activeVesselsPayload
        .map(normalizeActiveFleetVoyage)
        .filter((voyage): voyage is FleetMapVoyage => voyage !== null);

      if (
        activeVesselsPayload.length === 0 ||
        normalizedActiveVessels.length > 0
      ) {
        const dedupedVoyages = dedupeVoyagesByImo(normalizedActiveVessels);

        setActiveVoyageCount(normalizedActiveVessels.length);
        setTrackingData(dedupedVoyages);
        setLastUpdatedAt(new Date());
        return;
      }

      setError("Fleet Map data is unavailable because the API response is incomplete.");
      setTrackingData([]);
      setActiveVoyageCount(0);
      setLastUpdatedAt(new Date());
    } catch {
      setError("Failed to load fleet positions. Please try again.");
      setTrackingData([]);
      setActiveVoyageCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load — no auto-refresh interval (removed to avoid unnecessary Railway quota usage)
  useEffect(() => {
    fetchFleetPositions(true);
  }, [fetchFleetPositions]);

  function handleManualRefresh() {
    fetchFleetPositions(false);
  }

  function fmtTime(date: Date) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  const positionedVoyages = trackingData.filter((voyage) =>
    hasCoordinates(voyage.vesselPosition)
  ).length;
  const unavailablePositions = trackingData.length - positionedVoyages;
  const degradedCount = unavailablePositions;

  return (
    <div className="min-h-screen bg-background flex flex-col">
        {/* ── Header ── */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            {/* Left: logo + title */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Ship className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">FreightFlow</span>
              </div>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Fleet Map
              </span>
            </div>

            {/* Right: vessel count + refresh controls + back */}
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                {positionedVoyages} tracked vessel
                {positionedVoyages !== 1 ? "s" : ""}
              </Badge>

              {!loading && activeVoyageCount > 0 && (
                <Badge className="bg-slate-100 text-slate-700 border-slate-300">
                  {activeVoyageCount} active voyage
                  {activeVoyageCount !== 1 ? "s" : ""}
                </Badge>
              )}

              {!loading && degradedCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                  {degradedCount} degraded
                </Badge>
              )}

              {/* FIX 2: static "Last updated" instead of countdown */}
              {!loading && (
                <div className="hidden sm:flex items-center gap-2">
                  {lastUpdatedAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                      />
                      Last updated: {fmtTime(lastUpdatedAt)}
                    </span>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="h-7 text-xs px-2"
                  >
                    {refreshing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Refresh now"
                    )}
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        </header>

        {/* ── Error ── */}
        {error && (
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => fetchFleetPositions(true)}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {!loading && degradedCount > 0 && (
          <div className="container mx-auto px-4 pt-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Fleet data loaded with degraded coverage.
                </p>
                <p className="text-sm">
                  {unavailablePositions > 0 &&
                    `${unavailablePositions} vessel${unavailablePositions !== 1 ? "s" : ""} loaded without a usable position.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading (initial only) ── */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading fleet positions...
              </p>
            </div>
          </div>
        )}

        {/* ── Map ── */}
        {!loading && (
          <div
            className="flex-1 relative"
            style={{ minHeight: "calc(100vh - 68px)" }}
          >
            <FleetMap
              voyages={trackingData}
              activeVoyageCount={activeVoyageCount}
              shipmentScope={shipmentScope}
              onShipmentScopeChange={setShipmentScope}
              onRefresh={handleManualRefresh}
            />
          </div>
        )}
    </div>
  );
}

export default function MapPage() {
  return (
    <RequireAuth>
      <MapPageContent />
    </RequireAuth>
  );
}
