"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  ArrowLeft, Loader2, AlertCircle, Plus, Ship,
  UserCheck, UserX, Users,
} from "lucide-react";
import api, { isAuthenticated, getStoredUser } from "@/lib/api";
import { ApiError } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  customerId: string | null;
  customerName: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface CustomerItem {
  id: string;
  name: string;
}

interface PageMeta {
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

function roleBadge(role: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ADMIN:    { label: "Admin",    cls: "bg-red-100 text-red-700" },
    OPERATOR: { label: "Operator", cls: "bg-blue-100 text-blue-700" },
    VIEWER:   { label: "Viewer",   cls: "bg-gray-100 text-gray-600" },
    CLIENT:   { label: "Client",   cls: "bg-purple-100 text-purple-700" },
  };
  const s = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function UsersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);

  // Add user modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER", customerId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.replace("/login"); return; }
    const user = getStoredUser();
    if (user?.role !== "ADMIN") { router.replace("/dashboard"); return; }
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, custRes] = await Promise.all([
        api.get("/users", { params: { page: 0, size: 50 } }),
        api.get("/customers", { params: { page: 0, size: 100 } }),
      ]);
      setUsers(usersRes.data.data || []);
      setMeta(usersRes.data.meta || null);
      setCustomers(custRes.data.data || []);
    } catch (err) {
      const axErr = err as AxiosError<ApiError>;
      setError(axErr.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: false } : u));
    } catch {
      alert("Failed to deactivate user.");
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.role === "CLIENT" && form.customerId) {
        payload.customerId = form.customerId;
      }
      const res = await api.post("/users", payload);
      setUsers((prev) => [res.data, ...prev]);
      setShowModal(false);
      setForm({ name: "", email: "", password: "", role: "VIEWER", customerId: "" });
    } catch (err) {
      const axErr = err as AxiosError<ApiError>;
      setFormError(axErr.response?.data?.detail || axErr.response?.data?.message || "Failed to create user.");
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
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-muted-foreground" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            {meta?.total ?? users.length} user{(meta?.total ?? users.length) !== 1 ? "s" : ""} in this tenant
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">{roleBadge(u.role)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.customerName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <UserCheck className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <UserX className="h-3.5 w-3.5" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7 text-xs"
                            onClick={() => handleDeactivate(u.id)}
                          >
                            Deactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Add New User</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {formError}
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Full Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Maria Silva"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="maria@company.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, customerId: "" }))}
                  className="w-full border rounded-md h-10 px-3 text-sm bg-background"
                >
                  <option value="ADMIN">Admin — full access</option>
                  <option value="OPERATOR">Operator — create/edit shipments</option>
                  <option value="VIEWER">Viewer — read only</option>
                  <option value="CLIENT">Client — own shipments only</option>
                </select>
              </div>
              {form.role === "CLIENT" && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Customer (required for Client)</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                    className="w-full border rounded-md h-10 px-3 text-sm bg-background"
                    required
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
