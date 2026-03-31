"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  Ship,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  X,
  Anchor,
  Map,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import api, { getStoredUser, clearAuth, isAuthenticated } from "@/lib/api";
import {
  Shipment,
  ShipmentStats,
  PageResponse,
  ApiError,
  CreateShipmentRequest,
  VoyageOption,
  PortOption,
  ContainerType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  statusColor,
  statusLabel,
  formatDateShort,
  timeAgo,
  isEtaOverdue,
} from "@/lib/utils";

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

const ORIGINS: { value: string; label: string }[] = [
  { value: "", label: "All origins" },
  { value: "BRSSZ", label: "BRSSZ — Santos" },
  { value: "ARBUE", label: "ARBUE — Buenos Aires" },
  { value: "NLRTM", label: "NLRTM — Rotterdam" },
  { value: "SGSIN", label: "SGSIN — Singapore" },
];

const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
  { value: "TEU20", label: "20' Standard" },
  { value: "TEU40", label: "40' Standard" },
  { value: "TEU40HC", label: "40' High Cube" },
  { value: "REEFER20", label: "20' Reefer" },
  { value: "REEFER40", label: "40' Reefer" },
];

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);

  const [shipments, setShipments] = useState<PageResponse<Shipment> | null>(null);
  const [stats, setStats] = useState<ShipmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [vesselFilter, setVesselFilter] = useState("");
  const [page, setPage] = useState(0);

  // New Shipment modal
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [voyages, setVoyages] = useState<VoyageOption[]>([]);
  const [ports, setPorts] = useState<PortOption[]>([]);
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

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {
        page,
        size: PAGE_SIZE,
      };
      if (search.trim()) params.booking = search.trim();
      if (statusFilter) params.status = statusFilter;

      const [shipmentsRes, statsRes] = await Promise.all([
        api.get<PageResponse<Shipment>>("/shipments", { params }),
        api.get<ShipmentStats>("/shipments/stats").catch(() => ({ data: null })),
      ]);
      setShipments(shipmentsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      setError(axiosError.response?.data?.message || "Failed to load shipments.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    setMounted(true);
    setUser(getStoredUser());
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchShipments();
  }, [fetchShipments, router]);

  useEffect(() => {
    if (mounted && isAuthenticated()) {
      fetchShipments();
    }
  }, [mounted, fetchShipments]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function handleLogout() {
    clearAuth();
    router.replace("/login");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    fetchShipments();
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setOriginFilter("");
    setVesselFilter("");
    setPage(0);
  }

  const hasActiveFilters = !!(search || statusFilter || originFilter || vesselFilter);

  async function openModal() {
    setShowModal(true);
    setCreateError(null);
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
      const [voyagesRes, portsRes] = await Promise.all([
        api.get<{ data: VoyageOption[] }>("/voyages", { params: { size: 100 } }),
        api.get<{ data: PortOption[] }>("/ports", { params: { size: 100 } }),
      ]);
      setVoyages(voyagesRes.data?.data || []);
      setPorts(portsRes.data?.data || []);
    } catch {
      setVoyages([]);
      setPorts([]);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const body: Record<string, unknown> = {
        booking: form.booking,
        voyageId: form.voyageId,
        originPortId: form.originPortId,
        destPortId: form.destPortId,
      };
      if (form.containerNumber) body.containerNumber = form.containerNumber;
      if (form.containerType) body.containerType = form.containerType;
      if (form.consignee) body.consignee = form.consignee;
      if (form.shipper) body.shipper = form.shipper;

      await api.post("/shipments", body);
      setShowModal(false);
      setPage(0);
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

  // Client-side filters (origin and vessel)
  let data = shipments?.data || [];
  if (originFilter) {
    data = data.filter((s) => s.originPortUnlocode === originFilter);
  }
  if (vesselFilter) {
    data = data.filter((s) =>
      s.vesselName.toLowerCase().includes(vesselFilter.toLowerCase())
    );
  }

  const meta = shipments?.meta;

  // Unique vessel names for filter dropdown
  const vesselOptions = Array.from(
    new Set((shipments?.data || []).map((s) => s.vesselName))
  ).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Ship className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FreightFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/map"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-1"
            >
              <Map className="h-4 w-4" />
              Fleet Map
            </a>
            <a
              href="/track"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Track a Shipment
            </a>
            {user && (
              <span className="text-sm text-muted-foreground hidden md:inline">
                {user.name} &middot; {user.tenantName}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shipment Dashboard</h1>
            <p className="text-muted-foreground">
              Manage and monitor your maritime shipments.
            </p>
          </div>
          <Button onClick={openModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Shipment
          </Button>
        </div>

        {/* ── KPI Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {/* Total */}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                </div>
              </CardContent>
            </Card>

            {/* In Transit */}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Ship className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.inTransit}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">In Transit</p>
                </div>
              </CardContent>
            </Card>

            {/* Arrived */}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.arrived}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Arrived</p>
                </div>
              </CardContent>
            </Card>

            {/* Delayed — clicável */}
            <Card
              className={`cursor-pointer transition-colors hover:bg-red-50 ${
                statusFilter === "IN_TRANSIT" && search === "__delayed__"
                  ? "ring-2 ring-red-400"
                  : ""
              }`}
              onClick={() => {
                setStatusFilter("IN_TRANSIT");
                setOriginFilter("");
                setVesselFilter("");
                setPage(0);
              }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-red-600">
                    {stats.delayed}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Delayed</p>
                </div>
              </CardContent>
            </Card>

            {/* At Risk — clicável */}
            <Card
              className="cursor-pointer transition-colors hover:bg-orange-50"
              onClick={() => {
                setStatusFilter("IN_TRANSIT");
                setOriginFilter("");
                setVesselFilter("");
                setPage(0);
              }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-orange-500">
                    {stats.atRisk}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">At Risk</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Filters ── */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Booking search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by booking number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value.toUpperCase())}
                    className="pl-9"
                  />
                </div>

                {/* Status filter */}
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                  className="sm:w-44"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>

                <Button type="submit" variant="secondary">
                  <Search className="h-4 w-4 mr-2" />
                  Filter
                </Button>

                {hasActiveFilters && (
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>

              {/* Second row: origin + vessel */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Origin filter */}
                <Select
                  value={originFilter}
                  onChange={(e) => {
                    setOriginFilter(e.target.value);
                    setPage(0);
                  }}
                  className="sm:w-52"
                >
                  {ORIGINS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                {/* Vessel filter */}
                <Select
                  value={vesselFilter}
                  onChange={(e) => {
                    setVesselFilter(e.target.value);
                    setPage(0);
                  }}
                  className="sm:w-52"
                >
                  <option value="">All vessels</option>
                  {vesselOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
            </form>
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
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">
                        Container
                      </th>
                      <th className="text-left p-4 font-medium">Route</th>
                      <th className="text-left p-4 font-medium hidden lg:table-cell">
                        Vessel
                      </th>
                      <th className="text-left p-4 font-medium hidden lg:table-cell">
                        ETA
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
                          <td className="p-4 font-mono font-medium">{s.booking}</td>

                          {/* Status */}
                          <td className="p-4">
                            <Badge className={statusColor(s.status)}>
                              {statusLabel(s.status)}
                            </Badge>
                          </td>

                          {/* Container */}
                          <td className="p-4 font-mono hidden md:table-cell">
                            {s.containerNumber || "—"}
                          </td>

                          {/* Route */}
                          <td className="p-4">
                            <span className="font-medium">{s.originPortUnlocode}</span>
                            <span className="text-muted-foreground mx-1">&rarr;</span>
                            <span className="font-medium">
                              {s.destinationPortUnlocode}
                            </span>
                          </td>

                          {/* Vessel */}
                          <td className="p-4 hidden lg:table-cell">
                            <div>{s.vesselName}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {s.voyageNumber}
                            </div>
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
                disabled={meta.page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {meta.page + 1} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page + 1 >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
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
                <label className="text-sm font-medium">Booking Number *</label>
                <Input
                  value={form.booking}
                  onChange={(e) =>
                    setForm({ ...form, booking: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. P10482561"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Container Number</label>
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
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Voyage *</label>
                <Select
                  value={form.voyageId}
                  onChange={(e) => setForm({ ...form, voyageId: e.target.value })}
                  required
                >
                  <option value="">Select voyage</option>
                  {voyages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voyageNumber} — {v.vesselName} ({v.originPortUnlocode} →{" "}
                      {v.destinationPortUnlocode})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Origin Port *</label>
                  <Select
                    value={form.originPortId}
                    onChange={(e) =>
                      setForm({ ...form, originPortId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select port</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.unlocode} — {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Destination Port *</label>
                  <Select
                    value={form.destPortId}
                    onChange={(e) =>
                      setForm({ ...form, destPortId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select port</option>
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.unlocode} — {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shipper</label>
                  <Input
                    value={form.shipper || ""}
                    onChange={(e) =>
                      setForm({ ...form, shipper: e.target.value })
                    }
                    placeholder="Exporter name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Consignee</label>
                  <Input
                    value={form.consignee || ""}
                    onChange={(e) =>
                      setForm({ ...form, consignee: e.target.value })
                    }
                    placeholder="Importer name"
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
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
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
