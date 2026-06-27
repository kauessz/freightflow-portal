"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import {
  Ship,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  Plus,
  X,
  Anchor,
  AlertTriangle,
  Filter,
} from "lucide-react";
import RequireAuth from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import api from "@/lib/api";
import {
  Shipment,
  OperationsDashboardStats,
  PageResponse,
  ApiError,
  CreateShipmentRequest,
  VoyageOption,
  PortOption,
  ContainerType,
  VoyageFleetMapReadiness,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import PortalHeader from "@/components/portal-header";
import MasterDataNav from "@/components/master-data-nav";
import DashboardKpiCards from "@/components/DashboardKpiCards";
import {
  statusColor,
  statusLabel,
  formatDateShort,
  timeAgo,
  isEtaOverdue,
} from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "BOOKED", label: "Booked" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "GATE_IN", label: "Gate In" },
  { value: "LOADED", label: "Loaded" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "GATE_OUT", label: "Gate Out" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const CARRIERS: { value: string; label: string }[] = [
  { value: "", label: "All carriers" },
  { value: "CMA CGM", label: "CMA CGM" },
  { value: "HMM", label: "HMM" },
  { value: "Log-In", label: "Log-In" },
  { value: "Maersk", label: "Maersk" },
  { value: "MSC", label: "MSC" },
  { value: "ONE", label: "ONE" },
];

const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
  { value: "TEU20", label: "20' Standard" },
  { value: "TEU40", label: "40' Standard" },
  { value: "TEU40HC", label: "40' High Cube" },
  { value: "REEFER20", label: "20' Reefer" },
  { value: "REEFER40", label: "40' Reefer" },
];

const PAGE_SIZE = 20;

type VoyageFormMode = "existing" | "new";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPortLabel(port: PortOption) {
  return `${port.name} — ${port.unlocode}`;
}

function formatVoyageLabel(voyage: VoyageOption) {
  const origin = voyage.originPortName || voyage.originPortUnlocode;
  const destination = voyage.destinationPortName || voyage.destinationPortUnlocode;
  return `${voyage.vesselName} • ${voyage.voyageNumber} (${origin} → ${destination})`;
}

function extractReadinessItems(
  payload: VoyageFleetMapReadiness[] | { data?: VoyageFleetMapReadiness[] } | null | undefined
) {
  if (Array.isArray(payload)) return payload;
  return payload?.data || [];
}

function formatReason(reason: string) {
  return reason
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function docStatusBadge(status: string | null) {
  switch (status) {
    case "COMPLETE":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          Complete
        </span>
      );
    case "PARTIALLY_RECEIVED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          Partial
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          Pending
        </span>
      );
  }
}

function customsBadge(status: string | null) {
  switch (status) {
    case "CLEARED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          Cleared
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          In Progress
        </span>
      );
    case "HOLD":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          Hold
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Not Started
        </span>
      );
  }
}

function riskBadge(level: string | null) {
  switch (level) {
    case "CRITICAL":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-200 text-red-800 font-semibold">
          CRITICAL
        </span>
      );
    case "HIGH":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
          HIGH
        </span>
      );
    case "MEDIUM":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          MEDIUM
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
          LOW
        </span>
      );
  }
}

// ─── Inner component — uses useSearchParams ───────────────────────────────────

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // ── Derive filters from URL ──
  const bookingParam = searchParams.get("booking") || "";
  const statusParam = searchParams.get("status") || "";
  const carrierParam = searchParams.get("carrier") || "";
  const originParam = searchParams.get("origin") || "";
  const vesselParam = searchParams.get("vessel") || "";
  const riskParam = searchParams.get("risk") || "";
  const pageParam = parseInt(searchParams.get("page") || "0", 10);

  // ── Local state ──
  // Search input (controlled, syncs with bookingParam)
  const [searchInput, setSearchInput] = useState(bookingParam);
  useEffect(() => {
    setSearchInput(bookingParam);
  }, [bookingParam]);

  // Shipments state
  const [shipments, setShipments] = useState<PageResponse<Shipment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics state
  const [statsData, setStatsData] = useState<OperationsDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // New Shipment modal
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [voyages, setVoyages] = useState<VoyageOption[]>([]);
  const [ports, setPorts] = useState<PortOption[]>([]);
  const [voyageMode, setVoyageMode] = useState<VoyageFormMode>("existing");
  const [form, setForm] = useState<CreateShipmentRequest>({
    booking: "",
    containerNumber: "",
    containerType: undefined,
    voyageId: "",
    originPortId: "",
    destPortId: "",
    consignee: "",
    shipper: "",
  });

  // ── Memos ──
  const selectedVoyage = useMemo(
    () => voyages.find((v) => v.id === form.voyageId) ?? null,
    [voyages, form.voyageId]
  );

  const portsByUnlocode = useMemo(
    () =>
      ports.reduce<Record<string, PortOption>>((acc, port) => {
        acc[port.unlocode] = port;
        return acc;
      }, {}),
    [ports]
  );

  const sortedPorts = useMemo(
    () => [...ports].sort((a, b) => a.name.localeCompare(b.name)),
    [ports]
  );

  // ── Data fetching ──
  const fetchAnalytics = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get<OperationsDashboardStats>(
        "/analytics/operations-dashboard"
      );
      setStatsData(res.data);
    } catch {
      // Analytics failure is non-critical; KPI section simply stays hidden
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: pageParam,
        size: PAGE_SIZE,
      };
      if (bookingParam.trim()) params.booking = bookingParam.trim();
      if (statusParam) params.status = statusParam;
      if (carrierParam) params.carrier = carrierParam;
      if (vesselParam) params.vesselName = vesselParam;
      if (originParam) params.originPortUnlocode = originParam;
      if (riskParam) params.riskLevel = riskParam;

      const res = await api.get<PageResponse<Shipment>>("/shipments", { params });
      setShipments(res.data);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      setError(
        axiosError.response?.data?.message || "Failed to load shipments."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingParam, statusParam, carrierParam, vesselParam, originParam, riskParam, pageParam]);

  // ── Effects ──
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // ── URL filter helpers ──
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page when any filter changes (except page itself)
    if (key !== "page") {
      params.delete("page");
    }
    router.replace(`/dashboard?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 0) {
      params.delete("page");
    } else {
      params.set("page", newPage.toString());
    }
    router.replace(`/dashboard?${params.toString()}`);
  }

  function clearFilters() {
    setSearchInput("");
    router.replace("/dashboard");
  }

  function handleKpiFilterClick(
    filterType: "delayed" | "at_risk" | "critical_alerts"
  ) {
    const params = new URLSearchParams();
    switch (filterType) {
      case "delayed":
        params.set("status", "IN_TRANSIT");
        params.set("risk", "delayed");
        break;
      case "at_risk":
        params.set("risk", "high_critical");
        break;
      case "critical_alerts":
        params.set("risk", "critical");
        break;
    }
    router.replace(`/dashboard?${params.toString()}`);
  }

  async function openModal() {
    setShowModal(true);
    setCreateError(null);
    setVoyageMode("existing");
    setForm({
      booking: "",
      containerNumber: "",
      containerType: undefined,
      voyageId: "",
      originPortId: "",
      destPortId: "",
      consignee: "",
      shipper: "",
    });

    try {
      const [voyagesRes, portsRes, readyResponse, notReadyResponse] =
        await Promise.all([
          api.get<PageResponse<VoyageOption>>("/voyages", {
            params: { size: 100 },
          }),
          api.get<PageResponse<PortOption>>("/ports", { params: { size: 100 } }),
          api.get<VoyageFleetMapReadiness[]>("/voyages/fleet-map-readiness", {
            params: { eligible: true },
          }),
          api.get<VoyageFleetMapReadiness[]>("/voyages/fleet-map-readiness", {
            params: { eligible: false },
          }),
        ]);

      const readinessByVoyageId = [
        ...extractReadinessItems(readyResponse.data),
        ...extractReadinessItems(notReadyResponse.data),
      ].reduce<Record<string, VoyageFleetMapReadiness>>((acc, item) => {
        acc[item.voyageId] = item;
        return acc;
      }, {});

      setVoyages(
        (voyagesRes.data?.data || []).map((voyage) => {
          const readiness = readinessByVoyageId[voyage.id];
          return {
            ...voyage,
            eligibleForFleetMap:
              readiness?.eligibleForFleetMap ?? voyage.eligibleForFleetMap,
            ineligibilityReasons:
              readiness?.ineligibilityReasons ??
              voyage.ineligibilityReasons ??
              [],
          };
        })
      );
      setPorts(portsRes.data?.data || []);
    } catch {
      setVoyages([]);
      setPorts([]);
    }
  }

  function syncVoyageSelection(voyageId: string) {
    const voyage = voyages.find((v) => v.id === voyageId) ?? null;
    // Prefer the port UUID returned directly by the API; fall back to unlocode lookup
    // in case an older API version doesn't include the IDs.
    const originPortId = voyage
      ? voyage.originPortId || portsByUnlocode[voyage.originPortUnlocode]?.id || ""
      : "";
    const destPortId = voyage
      ? voyage.destinationPortId || portsByUnlocode[voyage.destinationPortUnlocode]?.id || ""
      : "";
    setForm((prev) => ({ ...prev, voyageId, originPortId, destPortId }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (voyageMode === "new") {
      router.push("/dashboard/voyages");
      setShowModal(false);
      return;
    }
    setCreating(true);
    setCreateError(null);

    try {
      const body: Record<string, unknown> = {
        booking: form.booking,
        voyageId: form.voyageId,
        originPortId: form.originPortId,
        destinationPortId: form.destPortId, // backend espera "destinationPortId", não "destPortId"
      };
      if (form.containerNumber) body.containerNumber = form.containerNumber;
      if (form.containerType) body.containerType = form.containerType;
      if (form.consignee) body.consignee = form.consignee;
      if (form.shipper) body.shipper = form.shipper;

      await api.post("/shipments", body);
      setShowModal(false);
      // Reset to page 0 and refetch
      router.replace("/dashboard");
      fetchShipments();
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      setCreateError(
        axiosError.response?.data?.message || "Failed to create shipment."
      );
    } finally {
      setCreating(false);
    }
  }

  // Todos os filtros são server-side — a API retorna os dados já filtrados
  const data = shipments?.data || [];

  const meta = shipments?.meta;

  const vesselOptions = Array.from(
    new Set((shipments?.data || []).map((s) => s.vesselName))
  ).sort();

  // Active filter count (used for badge)
  const activeFilterCount = [
    bookingParam,
    statusParam,
    carrierParam,
    originParam,
    vesselParam,
    riskParam,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const selectedOriginPort = selectedVoyage
    ? portsByUnlocode[selectedVoyage.originPortUnlocode] ?? null
    : null;
  const selectedDestinationPort = selectedVoyage
    ? portsByUnlocode[selectedVoyage.destinationPortUnlocode] ?? null
    : null;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} activePath="/dashboard" />

      <main className="container mx-auto px-4 py-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Shipment Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage and monitor your maritime shipments.
            </p>
          </div>
          <Button onClick={openModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Shipment
          </Button>
        </div>

        {/* ── Master data nav + shortcut cards ── */}
        <div className="mb-8 space-y-4">
          <MasterDataNav activePath="/dashboard" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Ports
                </p>
                <p className="text-sm font-medium mt-1">
                  Register operational origins and destinations.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/dashboard/ports")}
                >
                  Open Ports
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Vessels
                </p>
                <p className="text-sm font-medium mt-1">
                  Keep IMO and carrier master data ready for the map.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/dashboard/vessels")}
                >
                  Open Vessels
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Voyages
                </p>
                <p className="text-sm font-medium mt-1">
                  Create voyages once, then link shipments with less manual work.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/dashboard/voyages")}
                >
                  Open Voyages
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Analytics KPI Cards ── */}
        {statsLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading analytics…
          </div>
        )}
        {statsData && !statsLoading && (
          <DashboardKpiCards
            stats={statsData}
            onFilterClick={handleKpiFilterClick}
          />
        )}

        {/* ── Active filters indicator ── */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between px-1 mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>
                <span className="font-semibold text-foreground">
                  {activeFilterCount}
                </span>{" "}
                filter{activeFilterCount !== 1 ? "s" : ""} active
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear all
            </Button>
          </div>
        )}

        {/* ── Filters ── */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Booking search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by booking number..."
                    value={searchInput}
                    onChange={(e) =>
                      setSearchInput(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateParam("booking", searchInput.trim().toUpperCase());
                      }
                    }}
                    className="pl-9"
                  />
                </div>

                {/* Status filter */}
                <Select
                  value={statusParam}
                  onChange={(e) => updateParam("status", e.target.value)}
                  className="sm:w-44"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    updateParam("booking", searchInput.trim().toUpperCase())
                  }
                >
                  <Search className="h-4 w-4 mr-2" />
                  Filter
                </Button>

                {hasActiveFilters && (
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Second row */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Carrier filter */}
                <Select
                  value={carrierParam}
                  onChange={(e) => updateParam("carrier", e.target.value)}
                  className="sm:w-44"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>

                {/* Origin filter */}
                <Select
                  value={originParam}
                  onChange={(e) => updateParam("origin", e.target.value)}
                  className="sm:w-52"
                >
                  <option value="">All origins</option>
                  {Array.from(
                    new Set(
                      (shipments?.data || []).map((s) => s.originPortUnlocode)
                    )
                  )
                    .sort()
                    .map((code) => {
                      const name =
                        (shipments?.data || []).find(
                          (s) => s.originPortUnlocode === code
                        )?.originPortName || code;
                      return (
                        <option key={code} value={code}>
                          {code} — {name}
                        </option>
                      );
                    })}
                </Select>

                {/* Vessel filter */}
                <Select
                  value={vesselParam}
                  onChange={(e) => updateParam("vessel", e.target.value)}
                  className="sm:w-56"
                >
                  <option value="">All vessels</option>
                  {vesselOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* ── Shipment Table ── */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium">Booking</th>
                      <th className="text-left p-4 font-medium hidden sm:table-cell">
                        Carrier
                      </th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">
                        Container
                      </th>
                      <th className="text-left p-4 font-medium">Route</th>
                      <th className="text-left p-4 font-medium hidden lg:table-cell">
                        Incoterm
                      </th>
                      <th className="text-left p-4 font-medium hidden lg:table-cell">
                        ETA
                      </th>
                      <th className="text-left p-4 font-medium hidden xl:table-cell">
                        Docs
                      </th>
                      <th className="text-left p-4 font-medium hidden xl:table-cell">
                        Customs
                      </th>
                      <th className="text-left p-4 font-medium hidden xl:table-cell">
                        Risk
                      </th>
                      <th className="text-left p-4 font-medium hidden xl:table-cell">
                        Last Update
                      </th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((s) => {
                      const overdue = isEtaOverdue(s.eta, s.status);
                      const lastUpdate = timeAgo(s.updatedAt);

                      return (
                        <tr
                          key={s.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          {/* Booking */}
                          <td className="p-4">
                            <div className="font-mono font-medium">
                              {s.booking}
                            </div>
                            {s.delayDays > 0 && (
                              <div className="text-xs text-red-500 mt-0.5">
                                +{s.delayDays}d delay
                              </div>
                            )}
                          </td>

                          {/* Carrier */}
                          <td className="p-4 hidden sm:table-cell">
                            <span className="text-sm font-medium">
                              {s.carrier}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <Badge className={statusColor(s.status)}>
                              {statusLabel(s.status)}
                            </Badge>
                          </td>

                          {/* Container */}
                          <td className="p-4 font-mono hidden md:table-cell">
                            <div>{s.containerNumber || "—"}</div>
                            {s.containerType && (
                              <div className="text-xs text-muted-foreground">
                                {[
                                  s.containerSizeFt != null ? `${s.containerSizeFt}ft` : null,
                                  s.containerType,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                          </td>

                          {/* Route */}
                          <td className="p-4">
                            <span className="font-medium">
                              {s.originPortUnlocode}
                            </span>
                            <span className="text-muted-foreground mx-1">
                              &rarr;
                            </span>
                            <span className="font-medium">
                              {s.destinationPortUnlocode}
                            </span>
                            {s.transshipmentPortUnlocode && (
                              <div className="text-xs text-muted-foreground">
                                via {s.transshipmentPortUnlocode}
                              </div>
                            )}
                          </td>

                          {/* Incoterm */}
                          <td className="p-4 hidden lg:table-cell">
                            {s.incoterm ? (
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                {s.incoterm}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* ETA */}
                          <td className="p-4 hidden lg:table-cell">
                            {s.eta ? (
                              <span
                                className={
                                  overdue
                                    ? "text-red-600 font-medium flex items-center gap-1"
                                    : ""
                                }
                              >
                                {overdue && (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                {formatDateShort(s.eta)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Docs */}
                          <td className="p-4 hidden xl:table-cell">
                            {docStatusBadge(s.documentStatus)}
                          </td>

                          {/* Customs */}
                          <td className="p-4 hidden xl:table-cell">
                            {customsBadge(s.customsStatus)}
                          </td>

                          {/* Risk */}
                          <td className="p-4 hidden xl:table-cell">
                            {riskBadge(s.riskLevel)}
                          </td>

                          {/* Last Update */}
                          <td className="p-4 hidden xl:table-cell">
                            <span
                              className={
                                lastUpdate.isStale && s.status === "IN_TRANSIT"
                                  ? "text-orange-500"
                                  : "text-muted-foreground"
                              }
                            >
                              {lastUpdate.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <a
                                href={`/dashboard/shipments/${s.id}`}
                                className="text-sm text-primary hover:underline font-medium"
                              >
                                Details
                              </a>
                              <a
                                href={`/track?booking=${s.booking}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Track shipment"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && data.length === 0 && !error && (
          <div className="text-center py-16">
            <Ship className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">No shipments found</p>
            <p className="text-sm text-muted-foreground mb-6">
              {hasActiveFilters
                ? "Try adjusting your filters."
                : "Create your first shipment to get started."}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear filters
              </Button>
            ) : (
              <Button onClick={openModal}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first shipment
              </Button>
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Page {meta.page + 1} of {meta.totalPages} &middot; {meta.total}{" "}
              shipments
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam === 0}
                onClick={() => handlePageChange(Math.max(0, pageParam - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {meta.page + 1} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam + 1 >= meta.totalPages}
                onClick={() => handlePageChange(pageParam + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* ── New Shipment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">New Shipment</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{createError}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Booking reference *
                </label>
                <Input
                  value={form.booking}
                  onChange={(e) =>
                    setForm({ ...form, booking: e.target.value.toUpperCase() })
                  }
                  placeholder="Example: P10482561"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use the booking or reference your operations team already
                  tracks.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-medium">
                    How do you want to link this shipment?
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Shipments should preferably attach to an existing voyage
                    master record.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVoyageMode("existing");
                      setCreateError(null);
                    }}
                    className={`rounded-md border px-3 py-3 text-left transition-colors ${
                      voyageMode === "existing"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-sm font-medium">Use existing voyage</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Best for normal shipment creation.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoyageMode("new");
                      setForm((prev) => ({
                        ...prev,
                        voyageId: "",
                        originPortId: "",
                        destPortId: "",
                      }));
                      setCreateError(null);
                    }}
                    className={`rounded-md border px-3 py-3 text-left transition-colors ${
                      voyageMode === "new"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-sm font-medium">Create new voyage</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Open the voyage master area to register it properly first.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Container Number
                  </label>
                  <Input
                    value={form.containerNumber || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        containerNumber: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. MSCU7234561"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional for early registration. Add it if you already have
                    it.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Container Type</label>
                  <Select
                    value={form.containerType || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        containerType: (e.target.value ||
                          undefined) as ContainerType | undefined,
                      })
                    }
                  >
                    <option value="">Select type</option>
                    {CONTAINER_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pick the container type only when it is already confirmed.
                  </p>
                </div>
              </div>

              {voyageMode === "existing" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Operational voyage *
                    </label>
                    <Select
                      value={form.voyageId}
                      onChange={(e) => syncVoyageSelection(e.target.value)}
                      required
                    >
                      <option value="">
                        Choose the voyage this shipment should follow
                      </option>
                      {voyages.map((voyage) => (
                        <option key={voyage.id} value={voyage.id}>
                          {formatVoyageLabel(voyage)}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Once you choose a voyage, vessel, carrier and ports are
                      filled from that master record.
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Anchor className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Voyage summary</p>
                    </div>
                    {selectedVoyage ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Vessel
                          </p>
                          <p className="font-medium">
                            {selectedVoyage.vesselName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Carrier
                          </p>
                          <p className="font-medium">
                            {selectedVoyage.carrier || "From voyage record"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Voyage number
                          </p>
                          <p className="font-medium font-mono">
                            {selectedVoyage.voyageNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Schedule
                          </p>
                          <p className="font-medium">
                            ETD {formatDateShort(selectedVoyage.etd)} · ETA{" "}
                            {formatDateShort(selectedVoyage.eta)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Choose a voyage to auto-fill the route and reduce manual
                        entry.
                      </p>
                    )}

                    {selectedVoyage && (
                      <div
                        className={`rounded-md border px-3 py-2 text-sm ${
                          selectedVoyage.eligibleForFleetMap
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                      >
                        <p className="font-medium">
                          {selectedVoyage.eligibleForFleetMap
                            ? "Ready for Fleet Map"
                            : "Not ready for Fleet Map yet"}
                        </p>
                        {selectedVoyage.eligibleForFleetMap ? (
                          <p className="text-xs mt-1 text-green-700">
                            This voyage is already eligible according to the
                            backend readiness rules.
                          </p>
                        ) : (
                          <div className="mt-1 text-xs space-y-1">
                            {(selectedVoyage.ineligibilityReasons || []).length >
                            0 ? (
                              (selectedVoyage.ineligibilityReasons || []).map(
                                (reason) => (
                                  <p key={reason}>
                                    • {formatReason(reason)}
                                  </p>
                                )
                              )
                            ) : (
                              <p>
                                • Readiness details were not returned by the API.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Origin port *
                      </label>
                      <Select
                        value={form.originPortId}
                        disabled
                        required
                      >
                        <option value="">
                          {selectedOriginPort
                            ? formatPortLabel(selectedOriginPort)
                            : "Will be filled from the selected voyage"}
                        </option>
                        {sortedPorts.map((port) => (
                          <option key={port.id} value={port.id}>
                            {formatPortLabel(port)}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Locked to the voyage so shipment and map stay aligned.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Destination port *
                      </label>
                      <Select
                        value={form.destPortId}
                        disabled
                        required
                      >
                        <option value="">
                          {selectedDestinationPort
                            ? formatPortLabel(selectedDestinationPort)
                            : "Will be filled from the selected voyage"}
                        </option>
                        {sortedPorts.map((port) => (
                          <option key={port.id} value={port.id}>
                            {formatPortLabel(port)}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Also inherited from the voyage master record.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Create new voyage</p>
                    <p className="text-xs text-muted-foreground">
                      Voyages now live in the master data area so this shipment
                      form stays simpler for beginners.
                    </p>
                  </div>
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 space-y-3">
                    <p className="text-sm text-foreground">
                      Register the voyage once in master data, then come back
                      here and link the shipment using the existing-voyage path.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowModal(false);
                        router.push("/dashboard/voyages");
                      }}
                    >
                      Open Voyage Master Data
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shipper</label>
                  <Input
                    value={form.shipper || ""}
                    onChange={(e) =>
                      setForm({ ...form, shipper: e.target.value })
                    }
                    placeholder="Exporter or supplier name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Consignee</label>
                  <Input
                    value={form.consignee || ""}
                    onChange={(e) =>
                      setForm({ ...form, consignee: e.target.value })
                    }
                    placeholder="Importer or receiving party"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    creating ||
                    (voyageMode === "existing" && !form.voyageId)
                  }
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : voyageMode === "new" ? (
                    "Go to voyage master data"
                  ) : (
                    "Create Shipment"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Default export — wraps DashboardContent in Suspense ─────────────────────
// Required because useSearchParams() needs a Suspense boundary in Next.js 16
// when the page could be statically rendered.

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RequireAuth>
        <DashboardContent />
      </RequireAuth>
    </Suspense>
  );
}
