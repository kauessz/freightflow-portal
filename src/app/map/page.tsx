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
import api, { isAuthenticated } from "@/lib/api";
import {
  ActiveVesselWithShipmentsResponse,
  FleetMapVoyage,
  VoyageTracking,
  PageResponse,
  AisPosition,
  Shipment,
  RiskLevel,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Leaflet must be dynamically imported (needs window/document)
const FleetMap = dynamic(() => import("./fleet-map"), { ssr: false });

// Voyage list item from /api/v1/voyages
interface VoyageListItem {
  id: string;
  voyageNumber: string;
  status: string;
  vesselName: string;
  vesselImo: string;
  carrier?: string | null;
}

interface TrackingLoadIssue {
  voyageId: string;
  voyageNumber: string;
  vesselName: string;
  message: string;
}

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

function isShipmentLike(value: unknown): value is Shipment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.booking === "string" &&
    typeof value.vesselName === "string" &&
    typeof value.voyageNumber === "string"
  );
}

function readShipments(value: unknown): Shipment[] {
  return Array.isArray(value) ? value.filter(isShipmentLike) : [];
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

function normalizeTracking(
  tracking: VoyageTracking,
  voyage: VoyageListItem
): VoyageTracking {
  return {
    ...tracking,
    carrier: tracking.carrier ?? voyage.carrier ?? null,
    vesselPosition: normalizePosition(tracking.vesselPosition),
  };
}

function normalizeActiveFleetVoyage(item: ActiveVesselWithShipmentsResponse): FleetMapVoyage | null {
  const trackingSource = isRecord(item.tracking)
    ? item.tracking
    : isRecord(item.voyage)
      ? item.voyage
      : item;

  const voyageId = readString(item.voyageId) ?? readString(trackingSource.voyageId);
  const voyageNumber = readString(item.voyageNumber) ?? readString(trackingSource.voyageNumber);
  const status = readString(item.status) ?? readString(trackingSource.status);
  const vesselName = readString(item.vesselName) ?? readString(trackingSource.vesselName);
  const vesselImo = readString(item.vesselImo) ?? readString(trackingSource.vesselImo);
  const originPortName =
    readString(item.originPortName) ?? readString(trackingSource.originPortName);
  const originPortUnlocode =
    readString(item.originPortUnlocode) ?? readString(trackingSource.originPortUnlocode);
  const destinationPortName =
    readString(item.destinationPortName) ?? readString(trackingSource.destinationPortName);
  const destinationPortUnlocode =
    readString(item.destinationPortUnlocode) ??
    readString(trackingSource.destinationPortUnlocode);
  const etd = readString(item.etd) ?? readString(trackingSource.etd);
  const eta = readString(item.eta) ?? readString(trackingSource.eta);

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

  const positionCandidate =
    item.vesselPosition ??
    (isRecord(trackingSource.vesselPosition) ? (trackingSource.vesselPosition as AisPosition) : null);

  return {
    voyageId,
    voyageNumber,
    status,
    vesselName,
    vesselImo,
    carrier: readString(item.carrier) ?? readString(trackingSource.carrier),
    originPortName,
    originPortUnlocode,
    originLat: readNumber(item.originLat) ?? readNumber(trackingSource.originLat) ?? 0,
    originLon: readNumber(item.originLon) ?? readNumber(trackingSource.originLon) ?? 0,
    destinationPortName,
    destinationPortUnlocode,
    destinationLat: readNumber(item.destinationLat) ?? readNumber(trackingSource.destinationLat) ?? 0,
    destinationLon: readNumber(item.destinationLon) ?? readNumber(trackingSource.destinationLon) ?? 0,
    etd,
    eta,
    vesselPosition: normalizePosition(positionCandidate),
    aggregatedRiskLevel: readRiskLevel(item.aggregatedRiskLevel),
    relatedShipments: readShipments(item.relatedShipments ?? item.shipments),
  };
}

function hasCoordinates(position: AisPosition | null | undefined) {
  return position?.latitude != null && position?.longitude != null;
}

function getVoyageShipmentKey(voyage: Pick<VoyageTracking, "voyageNumber" | "vesselName">) {
  return `${voyage.voyageNumber}::${voyage.vesselName}`.toUpperCase();
}

function groupShipmentsByVoyage(shipments: Shipment[]) {
  return shipments.reduce<Record<string, Shipment[]>>((acc, shipment) => {
    const key = getVoyageShipmentKey(shipment);
    if (!acc[key]) acc[key] = [];
    acc[key].push(shipment);
    return acc;
  }, {});
}

async function fetchAllShipments() {
  const size = 100;
  let page = 0;
  let totalPages = 1;
  const shipments: Shipment[] = [];

  while (page < totalPages) {
    const response = await api.get<PageResponse<Shipment>>("/shipments", {
      params: { page, size },
    });
    shipments.push(...(response.data?.data || []));
    totalPages = response.data?.meta?.totalPages || 1;
    page += 1;
  }

  return shipments;
}

function groupRelatedShipmentsByVoyage(voyages: FleetMapVoyage[]) {
  return voyages.reduce<Record<string, Shipment[]>>((acc, voyage) => {
    const key = getVoyageShipmentKey(voyage);
    acc[key] = voyage.relatedShipments ?? [];
    return acc;
  }, {});
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

export default function MapPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [activeVoyageCount, setActiveVoyageCount] = useState(0);
  const [trackingData, setTrackingData] = useState<FleetMapVoyage[]>([]);
  const [trackingIssues, setTrackingIssues] = useState<TrackingLoadIssue[]>([]);
  const [shipmentsByVoyage, setShipmentsByVoyage] = useState<Record<string, Shipment[]>>({});
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);
  const [shipmentScope, setShipmentScope] = useState<ShipmentScope>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // FIX 2: replaced countdown + auto-refresh with a simple "last updated" timestamp
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchLegacyFleetPositions = useCallback(async () => {
    // 1. Get all voyages
    const voyagesRes = await api.get<PageResponse<VoyageListItem>>("/voyages", {
      params: { size: 100 },
    });

    const voyages = voyagesRes.data?.data || [];

    // 2. Filter to IN_TRANSIT and DEPARTED voyages
    const activeVoyages = voyages.filter(
      (v) => v.status === "IN_TRANSIT" || v.status === "DEPARTED"
    );
    setActiveVoyageCount(activeVoyages.length);

    if (activeVoyages.length === 0) {
      setTrackingData([]);
      setTrackingIssues([]);
      setShipmentsByVoyage({});
      setShipmentsError(null);
      setLastUpdatedAt(new Date());
      return;
    }

    const shipmentsPromise = fetchAllShipments();

    // 3. Fetch tracking data for each active voyage (in parallel)
    const trackingPromises = activeVoyages.map(async (voyage) => {
      try {
        const res = await api.get<VoyageTracking>(`/voyages/${voyage.id}/tracking`);
        return {
          tracking: normalizeTracking(res.data, voyage) as FleetMapVoyage,
          issue: null,
        };
      } catch {
        return {
          tracking: null,
          issue: {
            voyageId: voyage.id,
            voyageNumber: voyage.voyageNumber,
            vesselName: voyage.vesselName,
            message: "Tracking is temporarily unavailable for this voyage.",
          } satisfies TrackingLoadIssue,
        };
      }
    });

    const [results, shipmentsResult] = await Promise.all([
      Promise.all(trackingPromises),
      shipmentsPromise
        .then((shipments) => ({ shipments, error: null }))
        .catch(() => ({
          shipments: [] as Shipment[],
          error: "Shipment overlays could not be loaded for this map refresh.",
        })),
    ]);
    const validResults = results
      .map((result) => result.tracking)
      .filter((tracking): tracking is FleetMapVoyage => tracking !== null);
    const loadIssues = results
      .map((result) => result.issue)
      .filter((issue): issue is TrackingLoadIssue => issue !== null);

    const uniqueResults = dedupeVoyagesByImo(validResults);

    setTrackingData(uniqueResults);
    setTrackingIssues(loadIssues);
    setShipmentsByVoyage(groupShipmentsByVoyage(shipmentsResult.shipments));
    setShipmentsError(shipmentsResult.error);
    setLastUpdatedAt(new Date());
  }, []);

  const fetchFleetPositions = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setShipmentsLoading(true);
    setError(null);
    setShipmentsError(null);

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
        setTrackingIssues([]);
        setShipmentsByVoyage(groupRelatedShipmentsByVoyage(dedupedVoyages));
        setShipmentsError(null);
        setLastUpdatedAt(new Date());
        return;
      }

      await fetchLegacyFleetPositions();
    } catch {
      try {
        await fetchLegacyFleetPositions();
      } catch {
        setError("Failed to load fleet positions. Please try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setShipmentsLoading(false);
    }
  }, [fetchLegacyFleetPositions]);

  // Initial load — no auto-refresh interval (removed to avoid unnecessary Railway quota usage)
  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchFleetPositions(true);
  }, [router, fetchFleetPositions]);

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
  const degradedCount = unavailablePositions + trackingIssues.length + (shipmentsError ? 1 : 0);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                {trackingIssues.length > 0 &&
                  `${trackingIssues.length} voyage${trackingIssues.length !== 1 ? "s" : ""} could not load tracking.`}{" "}
                {unavailablePositions > 0 &&
                  `${unavailablePositions} vessel${unavailablePositions !== 1 ? "s" : ""} loaded without a usable position.`}
                {shipmentsError && ` Shipment overlays are unavailable for this refresh.`}
              </p>
              {trackingIssues.length > 0 && (
                <p className="text-xs text-amber-800">
                  Affected voyages:{" "}
                  {trackingIssues
                    .slice(0, 3)
                    .map((issue) => issue.voyageNumber)
                    .join(", ")}
                  {trackingIssues.length > 3 ? "..." : ""}
                </p>
              )}
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
            loadIssues={trackingIssues}
            activeVoyageCount={activeVoyageCount}
            shipmentsByVoyage={shipmentsByVoyage}
            shipmentsLoading={shipmentsLoading}
            shipmentsError={shipmentsError}
            shipmentScope={shipmentScope}
            onShipmentScopeChange={setShipmentScope}
          />
        </div>
      )}
    </div>
  );
}
