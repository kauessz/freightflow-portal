"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { AlertTriangle, Loader2, Pencil, Plus, Ship } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import RequireAuth from "@/components/require-auth";
import api from "@/lib/api";
import { ApiError, PageResponse, VesselRecord } from "@/types";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PortalHeader from "@/components/portal-header";
import MasterDataNav from "@/components/master-data-nav";

interface VesselFormState {
  name: string;
  imo: string;
  carrier: string;
  active: boolean;
  type: string;
  flag: string;
  capacityTeu: string;
}

const EMPTY_FORM: VesselFormState = {
  name: "",
  imo: "",
  carrier: "",
  active: true,
  type: "",
  flag: "",
  capacityTeu: "",
};

function VesselsPageContent() {
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const [vessels, setVessels] = useState<VesselRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingVessel, setEditingVessel] = useState<VesselRecord | null>(null);
  const [form, setForm] = useState<VesselFormState>(EMPTY_FORM);

  const sortedVessels = useMemo(
    () => [...vessels].sort((a, b) => a.name.localeCompare(b.name)),
    [vessels]
  );

  const loadVessels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<PageResponse<VesselRecord>>("/vessels", {
        params: { page: 0, size: 200 },
      });
      setVessels(response.data?.data || []);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(axiosError.response?.data?.message || "Failed to load vessels.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadVessels();
  }, [loadVessels]);

  function openCreateModal() {
    setEditingVessel(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(vessel: VesselRecord) {
    setEditingVessel(vessel);
    setForm({
      name: vessel.name,
      imo: vessel.imo ?? "",
      carrier: vessel.carrier ?? "",
      active: vessel.active,
      type: vessel.type ?? "",
      flag: vessel.flag ?? "",
      capacityTeu: vessel.capacityTeu?.toString() ?? "",
    });
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      imo: form.imo.trim() || null,
      carrier: form.carrier.trim() || null,
      active: form.active,
      type: form.type || null,
      flag: form.flag.trim() || null,
      capacityTeu: form.capacityTeu ? parseInt(form.capacityTeu) : null,
    };

    try {
      if (editingVessel) {
        const response = await api.put<VesselRecord>(`/vessels/${editingVessel.id}`, payload);
        setVessels((prev) =>
          prev.map((vessel) => (vessel.id === editingVessel.id ? response.data : vessel))
        );
        setShowModal(false);
        setEditingVessel(null);
        setForm(EMPTY_FORM);
        toast.success("Vessel updated successfully.");
      } else {
        const response = await api.post<VesselRecord>("/vessels", payload);
        setVessels((prev) => [response.data, ...prev]);
        setShowModal(false);
        setForm(EMPTY_FORM);
        toast.success("Vessel created successfully.");
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const message =
        axiosError.response?.data?.detail ||
        axiosError.response?.data?.message ||
        "Failed to save vessel.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} onLogout={handleLogout} activePath="/dashboard/vessels" />

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <MasterDataNav activePath="/dashboard/vessels" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Ship className="h-6 w-6 text-muted-foreground" />
                Vessels
              </h1>
              <p className="text-muted-foreground mt-1">
                Maintain the vessel master list used by voyages and Fleet Map readiness.
              </p>
            </div>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              New Vessel
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mb-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total vessels</p>
              <p className="text-2xl font-bold mt-1">{sortedVessels.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Missing IMO</p>
              <p className="text-2xl font-bold mt-1">
                {sortedVessels.filter((vessel) => !vessel.imo).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fleet Map note</p>
              <p className="text-sm font-medium mt-1">IMO is a critical tracking field</p>
              <p className="text-xs text-muted-foreground mt-1">
                Voyages without a vessel IMO will not become ready for real map tracking.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vessel</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Carrier</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">IMO</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVessels.map((vessel) => (
                    <tr key={vessel.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{vessel.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{vessel.carrier || "—"}</td>
                      <td className="px-4 py-3">
                        {vessel.imo ? (
                          <span className="font-mono text-xs">{vessel.imo}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            IMO missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            vessel.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {vessel.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(vessel)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sortedVessels.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        No vessels registered yet.
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
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingVessel ? "Edit Vessel" : "Create Vessel"}
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

              <div>
                <label className="text-sm font-medium mb-1.5 block">Vessel name *</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="MSC VALENCIA"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Carrier</label>
                <Input
                  value={form.carrier}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, carrier: event.target.value }))
                  }
                  placeholder="MSC"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">IMO</label>
                <Input
                  value={form.imo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, imo: event.target.value }))
                  }
                  placeholder="9876543"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  IMO is the critical identifier for Fleet Map readiness and real vessel tracking.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Vessel Type</label>
                <select
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select type</option>
                  <option value="CONTAINER">CONTAINER</option>
                  <option value="BULK">BULK</option>
                  <option value="TANKER">TANKER</option>
                  <option value="RORO">RORO</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Flag (ISO code)</label>
                <Input
                  value={form.flag}
                  onChange={(event) => setForm((prev) => ({ ...prev, flag: event.target.value }))}
                  placeholder="BR, PA, MH, LR..."
                  maxLength={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  2-letter ISO country code of vessel registration.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Capacity (TEU)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.capacityTeu}
                  onChange={(event) => setForm((prev) => ({ ...prev, capacityTeu: event.target.value }))}
                  placeholder="14000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total TEU capacity of the vessel.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, active: event.target.checked }))
                  }
                />
                Keep this vessel active for new voyages
              </label>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVessel ? "Save Changes" : "Create Vessel"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VesselsPage() {
  return (
    <RequireAuth allowedRoles={["ADMIN", "OPERATOR", "VIEWER"]}>
      <VesselsPageContent />
    </RequireAuth>
  );
}
