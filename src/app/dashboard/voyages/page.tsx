"use client";

import { useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { Anchor, Loader2, Pencil, Plus } from "lucide-react";
import api, { clearAuth, getStoredUser, isAuthenticated } from "@/lib/api";
import {
  ApiError,
  PageResponse,
  PortRecord,
  VesselRecord,
  VoyageFleetMapReadiness,
  VoyageRecord,
} from "@/types";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import PortalHeader from "@/components/portal-header";
import MasterDataNav from "@/components/master-data-nav";

function toInstant(dateString: string): string {
  if (!dateString) return "";
  return new Date(dateString + "T00:00:00.000Z").toISOString();
}

function toDateInput(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return isoString.slice(0, 10);
}

type ReadinessFilter = "all" | "ready" | "not_ready";

const VOYAGE_STATUSES: { value: string; label: string }[] = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "DEPARTED", label: "Departed" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

interface VoyageFormState {
  vesselId: string;
  carrier: string;
  voyageNumber: string;
  originPortId: string;
  destPortId: string;
  etd: string;
  eta: string;
  active: boolean;
  status: string;
}

const EMPTY_FORM: VoyageFormState = {
  vesselId: "",
  carrier: "",
  voyageNumber: "",
  originPortId: "",
  destPortId: "",
  etd: "",
  eta: "",
  active: true,
  status: "SCHEDULED",
};

function formatPortLabel(port: Pick<PortRecord, "name" | "unlocode">) {
  return `${port.name} — ${port.unlocode}`;
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
    .replace(/^\w/, (char) => char.toUpperCase());
}

export default function VoyagesPage() {
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [voyages, setVoyages] = useState<VoyageRecord[]>([]);
  const [ports, setPorts] = useState<PortRecord[]>([]);
  const [vessels, setVessels] = useState<VesselRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingVoyage, setEditingVoyage] = useState<VoyageRecord | null>(null);
  const [form, setForm] = useState<VoyageFormState>(EMPTY_FORM);
  const [user, setUser] = useState(getStoredUser());
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");

  const portsById = useMemo(
    () =>
      ports.reduce<Record<string, PortRecord>>((acc, port) => {
        acc[port.id] = port;
        return acc;
      }, {}),
    [ports]
  );

  const vesselsById = useMemo(
    () =>
      vessels.reduce<Record<string, VesselRecord>>((acc, vessel) => {
        acc[vessel.id] = vessel;
        return acc;
      }, {}),
    [vessels]
  );

  const sortedPorts = useMemo(
    () => [...ports].sort((a, b) => a.name.localeCompare(b.name)),
    [ports]
  );

  const filteredVoyages = useMemo(() => {
    const sorted = [...voyages].sort((a, b) => {
      const aReady = a.eligibleForFleetMap ? 1 : 0;
      const bReady = b.eligibleForFleetMap ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;
      return a.voyageNumber.localeCompare(b.voyageNumber);
    });

    if (readinessFilter === "ready") {
      return sorted.filter((voyage) => voyage.eligibleForFleetMap);
    }

    if (readinessFilter === "not_ready") {
      return sorted.filter((voyage) => !voyage.eligibleForFleetMap);
    }

    return sorted;
  }, [voyages, readinessFilter]);

  const selectedVessel = form.vesselId ? vesselsById[form.vesselId] ?? null : null;

  // portsById is referenced in openEditModal via closures — keep it in scope
  void portsById;

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      window.location.href = "/login";
      return;
    }

    const storedUser = getStoredUser();
    setUser(storedUser);
    if (storedUser?.role === "CLIENT") {
      window.location.href = "/dashboard";
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [voyagesResponse, portsResponse, vesselsResponse, readyResponse, notReadyResponse] =
        await Promise.all([
          api.get<PageResponse<VoyageRecord>>("/voyages", { params: { page: 0, size: 200 } }),
          api.get<PageResponse<PortRecord>>("/ports", { params: { page: 0, size: 200 } }),
          api.get<PageResponse<VesselRecord>>("/vessels", { params: { page: 0, size: 200 } }),
          api.get<VoyageFleetMapReadiness[]>("/voyages/fleet-map-readiness", {
            params: { eligible: true },
          }),
          api.get<VoyageFleetMapReadiness[]>("/voyages/fleet-map-readiness", {
            params: { eligible: false },
          }),
        ]);

      const readinessItems = [
        ...extractReadinessItems(readyResponse.data),
        ...extractReadinessItems(notReadyResponse.data),
      ];

      const readinessByVoyageId = readinessItems.reduce<
        Record<string, VoyageFleetMapReadiness>
      >((acc, item) => {
        acc[item.voyageId] = item;
        return acc;
      }, {});

      const mergedVoyages = (voyagesResponse.data?.data || []).map((voyage) => {
        const readiness = readinessByVoyageId[voyage.id];
        return {
          ...voyage,
          eligibleForFleetMap: readiness?.eligibleForFleetMap ?? voyage.eligibleForFleetMap ?? false,
          ineligibilityReasons: readiness?.ineligibilityReasons ?? voyage.ineligibilityReasons ?? [],
        };
      });

      setVoyages(mergedVoyages);
      setPorts(portsResponse.data?.data || []);
      setVessels(vesselsResponse.data?.data || []);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(axiosError.response?.data?.message || "Failed to load voyages.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingVoyage(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(voyage: VoyageRecord) {
    const fallbackVesselId =
      voyage.vesselId ||
      vessels.find((vessel) => vessel.name === voyage.vesselName)?.id ||
      "";
    const fallbackOriginPortId =
      voyage.originPortId ||
      ports.find((port) => port.unlocode === voyage.originPortUnlocode)?.id ||
      "";
    const fallbackDestinationPortId =
      voyage.destinationPortId ||
      ports.find((port) => port.unlocode === voyage.destinationPortUnlocode)?.id ||
      "";

    setEditingVoyage(voyage);
    setForm({
      vesselId: fallbackVesselId,
      carrier: voyage.carrier || "",
      voyageNumber: voyage.voyageNumber,
      originPortId: fallbackOriginPortId,
      destPortId: fallbackDestinationPortId,
      etd: toDateInput(voyage.etd),
      eta: toDateInput(voyage.eta),
      active: voyage.active ?? true,
      status: voyage.status || "SCHEDULED",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleVesselChange(vesselId: string) {
    const vessel = vesselsById[vesselId];
    setForm((prev) => ({
      ...prev,
      vesselId,
      carrier: vessel?.carrier || prev.carrier,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const baseFields = {
      vesselId: form.vesselId,
      carrier: form.carrier.trim() || null,
      voyageNumber: form.voyageNumber.trim().toUpperCase(),
      originPortId: form.originPortId,
      destinationPortId: form.destPortId, // backend espera "destinationPortId", não "destPortId"
      etd: toInstant(form.etd),
      eta: toInstant(form.eta),
      active: form.active,
    };
    // status está presente APENAS no PUT — criação sempre começa como SCHEDULED no backend
    const payload: Record<string, unknown> = editingVoyage
      ? { ...baseFields, status: form.status }
      : { ...baseFields };

    try {
      if (editingVoyage) {
        await api.put(`/voyages/${editingVoyage.id}`, payload);
        setShowModal(false);
        setEditingVoyage(null);
        setForm(EMPTY_FORM);
        toast.success("Voyage updated successfully.");
      } else {
        await api.post("/voyages", payload);
        setShowModal(false);
        setForm(EMPTY_FORM);
        toast.success("Voyage created successfully.");
      }
      await loadData();
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const message =
        axiosError.response?.data?.detail ||
        axiosError.response?.data?.message ||
        "Failed to save voyage.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearAuth();
    window.location.href = "/login";
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} onLogout={handleLogout} activePath="/dashboard/voyages" />

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <MasterDataNav activePath="/dashboard/voyages" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Anchor className="h-6 w-6 text-muted-foreground" />
                Voyages
              </h1>
              <p className="text-muted-foreground mt-1">
                Build the operational voyage master data and monitor Fleet Map readiness from the backend.
              </p>
            </div>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              New Voyage
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mb-6 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total voyages</p>
              <p className="text-2xl font-bold mt-1">{voyages.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ready for Fleet Map</p>
              <p className="text-2xl font-bold mt-1">
                {voyages.filter((voyage) => voyage.eligibleForFleetMap).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Not ready</p>
              <p className="text-2xl font-bold mt-1">
                {voyages.filter((voyage) => !voyage.eligibleForFleetMap).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Important note</p>
              <p className="text-sm font-medium mt-1">IMO is required for real map tracking</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the API readiness reasons as the source of truth for what is still missing.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: "all" as const, label: "All voyages" },
            { value: "ready" as const, label: "Ready for Fleet Map" },
            { value: "not_ready" as const, label: "Not ready" },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setReadinessFilter(filterOption.value)}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                readinessFilter === filterOption.value
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Voyage</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vessel / Carrier</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Route</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Schedule</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fleet Map</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoyages.map((voyage) => (
                    <tr key={voyage.id} className="border-b last:border-0 align-top hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium font-mono">{voyage.voyageNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {voyage.active === false ? "Inactive voyage" : "Active voyage"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{voyage.vesselName}</div>
                        <div className="text-xs text-muted-foreground">{voyage.carrier || "Carrier not informed"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {voyage.originPortName} — {voyage.originPortUnlocode}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {voyage.destinationPortName} — {voyage.destinationPortUnlocode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">ETD</div>
                        <div className="font-medium">{new Date(voyage.etd).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground mt-2">ETA</div>
                        <div className="font-medium">{new Date(voyage.eta).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {voyage.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {voyage.eligibleForFleetMap ? (
                          <div className="space-y-2">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                              Ready for Fleet Map
                            </span>
                            <p className="text-xs text-muted-foreground">
                              This voyage is eligible to appear on the map when operationally active.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                              Not ready
                            </span>
                            <ul className="space-y-1 text-xs text-muted-foreground">
                              {(voyage.ineligibilityReasons || []).length > 0 ? (
                                (voyage.ineligibilityReasons || []).map((reason) => (
                                  <li key={reason}>• {formatReason(reason)}</li>
                                ))
                              ) : (
                                <li>• Backend did not return readiness details.</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(voyage)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredVoyages.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No voyages found for this readiness filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingVoyage ? "Edit Voyage" : "Create Voyage"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Vessel *</label>
                  <Select
                    value={form.vesselId}
                    onChange={(event) => handleVesselChange(event.target.value)}
                    required
                  >
                    <option value="">Choose the vessel</option>
                    {vessels.map((vessel) => (
                      <option key={vessel.id} value={vessel.id}>
                        {vessel.name} {vessel.imo ? `— IMO ${vessel.imo}` : "— IMO missing"}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Carrier</label>
                  <Input
                    value={form.carrier}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, carrier: event.target.value }))
                    }
                    placeholder="Auto-filled from vessel when available"
                  />
                  {selectedVessel?.imo == null && (
                    <p className="text-xs text-amber-700 mt-1">
                      This vessel has no IMO yet, so the voyage will not be ready for Fleet Map.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Voyage number *</label>
                  <Input
                    value={form.voyageNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, voyageNumber: event.target.value.toUpperCase() }))
                    }
                    placeholder="123A"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Free format accepted: 126E, MSC-2026-001, 752E, PLATSL1MA
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Origin port *</label>
                  <Select
                    value={form.originPortId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, originPortId: event.target.value }))
                    }
                    required
                  >
                    <option value="">Choose the departure port</option>
                    {sortedPorts.map((port) => (
                      <option key={port.id} value={port.id}>
                        {formatPortLabel(port)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Destination port *</label>
                  <Select
                    value={form.destPortId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, destPortId: event.target.value }))
                    }
                    required
                  >
                    <option value="">Choose the arrival port</option>
                    {sortedPorts.map((port) => (
                      <option key={port.id} value={port.id}>
                        {formatPortLabel(port)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">ETD *</label>
                  <Input
                    type="date"
                    value={form.etd}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, etd: event.target.value }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">ETA *</label>
                  <Input
                    type="date"
                    value={form.eta}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, eta: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Status — only shown on edit; create always starts as SCHEDULED */}
              {editingVoyage && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Voyage Status</label>
                  <Select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                  >
                    {VOYAGE_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set to Departed or In Transit for the voyage to appear on the Fleet Map.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, active: event.target.checked }))
                  }
                />
                Keep this voyage active for shipment linking
              </label>

              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                Fleet Map readiness comes from the backend. After saving, the readiness badge and reasons will refresh from the API.
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVoyage ? "Save Changes" : "Create Voyage"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
