"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortSuggestion, searchPorts } from "@/lib/ports-data";
import { AxiosError } from "axios";
import { Loader2, MapPinned, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import RequireAuth from "@/components/require-auth";
import api from "@/lib/api";
import { ApiError, PageResponse, PortRecord } from "@/types";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PortalHeader from "@/components/portal-header";
import MasterDataNav from "@/components/master-data-nav";

interface PortFormState {
  name: string;
  unlocode: string;
  country: string;
  active: boolean;
  timezone: string;
  lat: string;
  lon: string;
}

const EMPTY_FORM: PortFormState = {
  name: "",
  unlocode: "",
  country: "",
  active: true,
  timezone: "UTC",
  lat: "",
  lon: "",
};

function PortsPageContent() {
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const [ports, setPorts] = useState<PortRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPort, setEditingPort] = useState<PortRecord | null>(null);
  const [form, setForm] = useState<PortFormState>(EMPTY_FORM);
  const [portSuggestions, setPortSuggestions] = useState<PortSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sortedPorts = useMemo(
    () => [...ports].sort((a, b) => a.name.localeCompare(b.name)),
    [ports]
  );

  const loadPorts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<PageResponse<PortRecord>>("/ports", {
        params: { page: 0, size: 200 },
      });
      setPorts(response.data?.data || []);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(axiosError.response?.data?.message || "Failed to load ports.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPorts();
  }, [loadPorts]);

  function openCreateModal() {
    setEditingPort(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(port: PortRecord) {
    setEditingPort(port);
    setForm({
      name: port.name,
      unlocode: port.unlocode,
      country: port.country,
      active: port.active,
      timezone: port.timezone ?? "UTC",
      lat: port.lat?.toString() ?? "",
      lon: port.lon?.toString() ?? "",
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
      unlocode: form.unlocode.trim().toUpperCase(),
      country: form.country.trim().toUpperCase().slice(0, 2),
      active: form.active,
      timezone: form.timezone.trim() || "UTC",
      latitude: form.lat ? parseFloat(form.lat) : null,
      longitude: form.lon ? parseFloat(form.lon) : null,
    };

    try {
      if (editingPort) {
        const response = await api.put<PortRecord>(`/ports/${editingPort.id}`, payload);
        setPorts((prev) =>
          prev.map((port) => (port.id === editingPort.id ? response.data : port))
        );
        setShowModal(false);
        setEditingPort(null);
        setForm(EMPTY_FORM);
        toast.success("Port updated successfully.");
      } else {
        const response = await api.post<PortRecord>("/ports", payload);
        setPorts((prev) => [response.data, ...prev]);
        setShowModal(false);
        setForm(EMPTY_FORM);
        toast.success("Port created successfully.");
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const message =
        axiosError.response?.data?.detail ||
        axiosError.response?.data?.message ||
        "Failed to save port.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
  }

  function handlePortNameChange(value: string) {
    setForm((prev) => ({ ...prev, name: value }));
    const suggestions = searchPorts(value);
    setPortSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
  }

  function selectPortSuggestion(port: PortSuggestion) {
    setForm((prev) => ({
      ...prev,
      name: port.name,
      unlocode: port.unlocode,
      country: port.country,
      timezone: port.timezone,
      lat: port.lat.toString(),
      lon: port.lon.toString(),
    }));
    setShowSuggestions(false);
    setPortSuggestions([]);
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
      <PortalHeader user={user} onLogout={handleLogout} activePath="/dashboard/ports" />

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <MasterDataNav activePath="/dashboard/ports" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapPinned className="h-6 w-6 text-muted-foreground" />
                Ports
              </h1>
              <p className="text-muted-foreground mt-1">
                Register and maintain the port master data used by voyages and shipments.
              </p>
            </div>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              New Port
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mb-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total ports</p>
              <p className="text-2xl font-bold mt-1">{sortedPorts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
              <p className="text-2xl font-bold mt-1">
                {sortedPorts.filter((port) => port.active).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">How ports appear</p>
              <p className="text-sm font-medium mt-1">Name first, code second</p>
              <p className="text-xs text-muted-foreground mt-1">Example: Santos — BRSSZ</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Port</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Country</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPorts.map((port) => (
                    <tr key={port.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{port.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{port.unlocode}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{port.country}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            port.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {port.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(port)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sortedPorts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        No ports registered yet.
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
                {editingPort ? "Edit Port" : "Create Port"}
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

              <div className="relative">
                <label className="text-sm font-medium mb-1.5 block">Port name *</label>
                <Input
                  value={form.name}
                  onChange={(event) => handlePortNameChange(event.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Santos"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Type to search and auto-fill from known ports database.
                </p>
                {showSuggestions && portSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {portSuggestions.map((port) => (
                      <button
                        key={port.unlocode}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between"
                        onClick={() => selectPortSuggestion(port)}
                      >
                        <span className="font-medium">{port.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{port.unlocode} · {port.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">UN/LOCODE *</label>
                <Input
                  value={form.unlocode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, unlocode: event.target.value.toUpperCase() }))
                  }
                  placeholder="BRSSZ"
                  required
                  maxLength={10}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Country *</label>
                <Input
                  value={form.country}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, country: event.target.value.toUpperCase().slice(0, 2) }))
                  }
                  placeholder="BR"
                  required
                  maxLength={2}
                />
                <p className="text-xs text-muted-foreground mt-1">2-letter ISO country code (BR, NL, AR, DE...)</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Timezone</label>
                <Input
                  value={form.timezone}
                  onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                  placeholder="America/Sao_Paulo"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  IANA timezone — preenchido automaticamente ao selecionar porto.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Latitude</label>
                  <Input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(event) => setForm((prev) => ({ ...prev, lat: event.target.value }))}
                    placeholder="-23.9"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Longitude</label>
                  <Input
                    type="number"
                    step="any"
                    value={form.lon}
                    onChange={(event) => setForm((prev) => ({ ...prev, lon: event.target.value }))}
                    placeholder="-46.3"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Optional. Used for Fleet Map port markers.
              </p>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, active: event.target.checked }))
                  }
                />
                Keep this port active for operations
              </label>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPort ? "Save Changes" : "Create Port"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortsPage() {
  return (
    <RequireAuth allowedRoles={["ADMIN", "OPERATOR", "VIEWER"]}>
      <PortsPageContent />
    </RequireAuth>
  );
}
