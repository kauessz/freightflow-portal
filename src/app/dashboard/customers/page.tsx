"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { ArrowLeft, Loader2, AlertCircle, Plus, Ship, Building2 } from "lucide-react";
import api, { isAuthenticated, getStoredUser } from "@/lib/api";
import { ApiError } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CustomerItem {
  id: string;
  name: string;
  taxId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  active: boolean;
  createdAt: string;
}

interface PageMeta {
  total: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);

  // Add customer modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", taxId: "", contactName: "", contactEmail: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.replace("/login"); return; }
    const stored = getStoredUser();
    const role = (stored as any)?.role;
    if (role !== "ADMIN" && role !== "OPERATOR") { router.replace("/dashboard"); return; }
    setCanEdit(role === "ADMIN" || role === "OPERATOR");
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/customers", { params: { page: 0, size: 100 } });
      setCustomers(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err) {
      const axErr = err as AxiosError<ApiError>;
      setError(axErr.response?.data?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(c: CustomerItem) {
    try {
      await api.put(`/customers/${c.id}`, { active: !c.active });
      setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !c.active } : x));
    } catch {
      alert("Failed to update customer.");
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.post("/customers", form);
      setCustomers((prev) => [res.data, ...prev]);
      setShowModal(false);
      setForm({ name: "", taxId: "", contactName: "", contactEmail: "" });
    } catch (err) {
      const axErr = err as AxiosError<ApiError>;
      setFormError(axErr.response?.data?.detail || axErr.response?.data?.message || "Failed to create customer.");
    } finally {
      setSaving(false);
    }
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
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center px-4 gap-4">
          <Ship className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">FreightFlow</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          {canEdit && (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          )}
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            Customers
          </h1>
          <p className="text-muted-foreground mt-1">
            {meta?.total ?? customers.length} customer{(meta?.total ?? customers.length) !== 1 ? "s" : ""}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tax ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    {canEdit && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.taxId ?? "—"}</td>
                      <td className="px-4 py-3">
                        {c.contactName && <div className="font-medium">{c.contactName}</div>}
                        {c.contactEmail && <div className="text-xs text-muted-foreground">{c.contactEmail}</div>}
                        {!c.contactName && !c.contactEmail && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleToggleActive(c)}
                          >
                            {c.active ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                        No customers yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Add New Customer</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {formError}
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Company Name <span className="text-destructive">*</span></label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Atlas Cargo Ltda"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tax ID (CNPJ)</label>
                <Input
                  value={form.taxId}
                  onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                  placeholder="12.345.678/0001-90"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contact Name</label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  placeholder="João Pereira"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contact Email</label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="joao@atlascargo.com.br"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
