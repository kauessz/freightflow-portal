"use client";

import { useCallback, useRef, useState } from "react";
import { AxiosError } from "axios";
import {
  AlertCircle,
  CheckCircle2,
  Container,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import RequireAuth from "@/components/require-auth";
import api from "@/lib/api";
import { ApiError, CabotagemImportResult } from "@/types";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import PortalHeader from "@/components/portal-header";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARRIERS: { value: string; label: string }[] = [
  { value: "MERCOSUL", label: "Mercosul Line" },
  { value: "ALIANCA",  label: "Aliança" },
  { value: "LOGIN",    label: "Log-In" },
  { value: "NORCOAST", label: "Norcoast" },
];

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

function CabotagemImportPageContent() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [carrier, setCarrier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CabotagemImportResult | null>(null);

  function handleLogout() {
    logout();
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const validateAndSetFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error("Only .xlsx and .csv files are accepted.");
      return;
    }
    setFile(f);
    setResult(null);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }, [validateAndSetFile]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!carrier) {
      toast.error("Please select a carrier before importing.");
      return;
    }
    if (!file) {
      toast.error("Please select a file before importing.");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("carrier", carrier);
      formData.append("file", file);

      const res = await api.post<CabotagemImportResult>(
        "/cabotagem/import",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setResult(res.data);

      if (res.data.errors === 0) {
        toast.success(
          `Import complete — ${res.data.success} shipment${res.data.success !== 1 ? "s" : ""} imported successfully.`
        );
        setFile(null);
      } else {
        toast.error(
          `Import finished with ${res.data.errors} error${res.data.errors !== 1 ? "s" : ""}. Check the details below.`
        );
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(
        axiosError.response?.data?.message || "Import failed. Please try again."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} onLogout={handleLogout} activePath="/dashboard/cabotagem/import" />

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Container className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Import Carrier Sheet</h1>
          </div>
          <p className="text-muted-foreground">
            Upload an .xlsx or .csv file exported from your carrier system to
            bulk-import cabotagem shipments.
          </p>
        </div>

        {/* Import form */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Import settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Carrier */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Carrier *</label>
              <Select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="max-w-xs"
              >
                <option value="">Select a carrier</option>
                {CARRIERS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Drop zone */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">File *</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : file
                    ? "border-green-400 bg-green-50"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
                {file ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <div className="text-center">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setResult(null);
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium text-sm">
                        Drop your file here or{" "}
                        <span className="text-primary">click to browse</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Accepts .xlsx and .csv
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || !carrier || !file}
              className="w-full sm:w-auto"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                    Total rows
                  </p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{result.success}</p>
                  <p className="text-xs text-green-600 mt-0.5 uppercase tracking-wide">
                    Imported
                  </p>
                </CardContent>
              </Card>
              {result.errors > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4 text-center">
                    <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                    <p className="text-xs text-red-600 mt-0.5 uppercase tracking-wide">
                      Errors
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Error details */}
            {result.errorDetails.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    Row errors ({result.errorDetails.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-red-50/60">
                          <th className="text-left px-4 py-2.5 font-medium text-red-700 w-20">Row</th>
                          <th className="text-left px-4 py-2.5 font-medium text-red-700">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errorDetails.map((detail, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-4 py-2.5 font-mono text-red-600 font-medium">
                              #{detail.row}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {detail.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function CabotagemImportPage() {
  return (
    <RequireAuth allowedRoles={["ADMIN", "OPERATOR"]}>
      <CabotagemImportPageContent />
    </RequireAuth>
  );
}
