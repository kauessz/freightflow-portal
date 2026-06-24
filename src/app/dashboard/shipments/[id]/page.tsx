"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  Ship,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  AlertTriangle,
  Pencil,
  X,
  Upload,
  Download,
  Trash2,
  Plus,
} from "lucide-react";
import api, { isAuthenticated, getStoredUser } from "@/lib/api";
import {
  ApiError,
  TrackingEvent,
  Shipment,
  ShipmentStatus,
  ContainerType,
  CustomsStatus,
  DocumentStatus,
  DocumentRecord,
} from "@/types";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import ShipmentTimeline from "@/components/ShipmentTimeline";
import Breadcrumb from "@/components/Breadcrumb";
import { statusColor, statusLabel, formatDate, formatDateShort } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ShipmentStatus; label: string }[] = [
  { value: "BOOKED",     label: "Booked" },
  { value: "CONFIRMED",  label: "Confirmed" },
  { value: "GATE_IN",    label: "Gate In" },
  { value: "LOADED",     label: "Loaded" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "ARRIVED",    label: "Arrived" },
  { value: "GATE_OUT",   label: "Gate Out" },
  { value: "DELIVERED",  label: "Delivered" },
  { value: "CANCELLED",  label: "Cancelled" },
];

const CONTAINER_TYPE_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: "TEU20",    label: "20' Standard" },
  { value: "TEU40",    label: "40' Standard" },
  { value: "TEU40HC",  label: "40' High Cube" },
  { value: "REEFER20", label: "20' Reefer" },
  { value: "REEFER40", label: "40' Reefer" },
];

const CUSTOMS_STATUS_OPTIONS: { value: CustomsStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CLEARED",     label: "Cleared" },
  { value: "HOLD",        label: "Hold" },
];

const DOCUMENT_STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: "PENDING",             label: "Pending" },
  { value: "PARTIALLY_RECEIVED",  label: "Partially Received" },
  { value: "COMPLETE",            label: "Complete" },
];

const DOC_TYPE_OPTIONS: { value: DocumentRecord["type"]; label: string }[] = [
  { value: "CTE",   label: "CT-e" },
  { value: "BL",    label: "Bill of Lading" },
  { value: "NF",    label: "Nota Fiscal" },
  { value: "OTHER", label: "Other" },
];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── Edit form state ──────────────────────────────────────────────────────────

interface EditFormState {
  status: string;
  containerNumber: string;
  containerType: string;
  consignee: string;
  shipper: string;
  incoterm: string;
  customsStatus: string;
  documentStatus: string;
}

const EMPTY_EDIT_FORM: EditFormState = {
  status: "",
  containerNumber: "",
  containerType: "",
  consignee: "",
  shipper: "",
  incoterm: "",
  customsStatus: "",
  documentStatus: "",
};

// ─── Upload form state ────────────────────────────────────────────────────────

interface UploadFormState {
  type: DocumentRecord["type"];
  description: string;
  file: File | null;
}

const EMPTY_UPLOAD_FORM: UploadFormState = {
  type: "OTHER",
  description: "",
  file: null,
};

// ─── Helper components ────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-medium text-sm ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  );
}

function DocBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    COMPLETE:           { label: "Complete", cls: "bg-green-100 text-green-700" },
    PARTIALLY_RECEIVED: { label: "Partial",  cls: "bg-yellow-100 text-yellow-700" },
    PENDING:            { label: "Pending",  cls: "bg-red-100 text-red-700" },
  };
  const s = map[status ?? "PENDING"] ?? map["PENDING"];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function CustomsBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    CLEARED:     { label: "Cleared",     cls: "bg-green-100 text-green-700" },
    IN_PROGRESS: { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
    HOLD:        { label: "Hold",        cls: "bg-red-100 text-red-700" },
    NOT_STARTED: { label: "Not Started", cls: "bg-gray-100 text-gray-600" },
  };
  const s = map[status ?? "NOT_STARTED"] ?? map["NOT_STARTED"];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function RiskBadge({ level }: { level: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    CRITICAL: { label: "CRITICAL", cls: "bg-red-200 text-red-800 font-semibold" },
    HIGH:     { label: "HIGH",     cls: "bg-orange-100 text-orange-700" },
    MEDIUM:   { label: "MEDIUM",   cls: "bg-yellow-100 text-yellow-700" },
    LOW:      { label: "LOW",      cls: "bg-gray-100 text-gray-500" },
  };
  const s = map[level ?? "LOW"] ?? map["LOW"];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function DocTypeBadge({ type }: { type: DocumentRecord["type"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    CTE:   { label: "CT-e",  cls: "bg-blue-100 text-blue-700" },
    BL:    { label: "BL",    cls: "bg-green-100 text-green-700" },
    NF:    { label: "NF",    cls: "bg-purple-100 text-purple-700" },
    OTHER: { label: "Other", cls: "bg-gray-100 text-gray-600" },
  };
  const s = map[type] ?? map["OTHER"];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast } = useToast();
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [user] = useState(getStoredUser());
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);

  // Documents
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(EMPTY_UPLOAD_FORM);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const canEdit = user?.role === "ADMIN" || user?.role === "OPERATOR";

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await api.get<DocumentRecord[]>(`/shipments/${id}/documents`);
      setDocuments(res.data || []);
    } catch {
      // Documents fetch failure is non-critical
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shipmentRes, eventsRes] = await Promise.all([
        api.get<Shipment>(`/shipments/${id}`),
        api
          .get<{ data: TrackingEvent[] }>(`/shipments/${id}/events`)
          .catch(() => ({ data: { data: [] } })),
      ]);
      setShipment(shipmentRes.data);
      const rawEvents: TrackingEvent[] = eventsRes.data?.data || [];
      setEvents(
        [...rawEvents].sort(
          (a, b) =>
            new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
        )
      );
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      setError(
        axiosError.response?.data?.message || "Failed to load shipment details."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchData();
    fetchDocuments();
  }, [fetchData, fetchDocuments, router]);

  // ── Edit modal ─────────────────────────────────────────────────────────────

  function openEditModal() {
    if (!shipment) return;
    setEditForm({
      status: shipment.status,
      containerNumber: shipment.containerNumber || "",
      containerType: shipment.containerType || "",
      consignee: shipment.consignee || "",
      shipper: shipment.shipper || "",
      incoterm: shipment.incoterm || "",
      customsStatus: shipment.customsStatus || "NOT_STARTED",
      documentStatus: shipment.documentStatus || "PENDING",
    });
    setShowEditModal(true);
  }

  async function handleEditSave(event: React.FormEvent) {
    event.preventDefault();
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: editForm.status,
        containerNumber: editForm.containerNumber.trim() || null,
        containerType: editForm.containerType || null,
        consignee: editForm.consignee.trim() || null,
        shipper: editForm.shipper.trim() || null,
        incoterm: editForm.incoterm.trim() || null,
        customsStatus: editForm.customsStatus || null,
        documentStatus: editForm.documentStatus || null,
      };
      await api.put(`/shipments/${id}`, payload);
      setShowEditModal(false);
      toast.success("Shipment updated successfully.");
      await fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(
        axiosError.response?.data?.message || "Failed to update shipment."
      );
    } finally {
      setEditSaving(false);
    }
  }

  // ── Document actions ───────────────────────────────────────────────────────

  function openUploadModal() {
    setUploadForm(EMPTY_UPLOAD_FORM);
    setUploadModalOpen(true);
  }

  async function handleUpload() {
    if (!uploadForm.file) {
      toast.error("Please select a file.");
      return;
    }
    if (uploadForm.file.size > MAX_UPLOAD_BYTES) {
      toast.error("File exceeds the 20 MB limit.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("type", uploadForm.type);
      formData.append("file", uploadForm.file);
      if (uploadForm.description.trim()) {
        formData.append("description", uploadForm.description.trim());
      }

      await api.post(`/shipments/${id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadModalOpen(false);
      setUploadForm(EMPTY_UPLOAD_FORM);
      toast.success("Document uploaded successfully.");
      await fetchDocuments();
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(
        axiosError.response?.data?.message || "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(docId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This action cannot be undone.`)) return;
    setDeletingDocId(docId);
    try {
      await api.delete(`/documents/${docId}`);
      toast.success("Document deleted.");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      toast.error(
        axiosError.response?.data?.message || "Failed to delete document."
      );
    } finally {
      setDeletingDocId(null);
    }
  }

  // ── Render guards ──────────────────────────────────────────────────────────

  // Only show full-page spinner on the very first load (no data yet)
  if (!mounted || (loading && !shipment)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !shipment) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!shipment) return null;

  const isCabotagem = shipment.operationMode === "CABOTAGEM";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center px-4 gap-4">
          <Ship className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">FreightFlow</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Nav */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <a
            href={`/track?booking=${shipment.booking}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Public tracking
          </a>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Shipments", href: "/dashboard" },
            { label: shipment.booking },
          ]}
        />

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              {shipment.booking}
            </h1>
            <p className="text-muted-foreground mt-0.5">
              {shipment.originPortName} ({shipment.originPortUnlocode}) &rarr;{" "}
              {shipment.destinationPortName} ({shipment.destinationPortUnlocode})
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {shipment.vesselName} &middot; {shipment.carrier} &mdash; Voyage{" "}
              <span className="font-mono">{shipment.voyageNumber}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge className={`${statusColor(shipment.status)} text-sm px-3 py-1`}>
                {statusLabel(shipment.status)}
              </Badge>
              {isCabotagem && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Cabotagem
                </span>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openEditModal}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Shipment
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              ETA:{" "}
              <span className="font-medium text-foreground">
                {formatDateShort(shipment.eta)}
              </span>
            </p>
            {shipment.delayDays > 0 && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                +{shipment.delayDays} day{shipment.delayDays !== 1 ? "s" : ""} delay
              </span>
            )}
          </div>
        </div>

        {/* ── Shipment Details ── */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Shipment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Documents */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Documents</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                <Field label="House BL" value={shipment.houseBl} mono />
                <Field label="Master BL" value={shipment.masterBl} mono />
                <Field label="Customer Reference" value={shipment.customerReference} mono />
              </div>
            </div>

            <hr className="border-border" />

            {/* Parties */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parties</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                <Field label="Shipper" value={shipment.shipper} />
                <Field label="Consignee" value={shipment.consignee} />
                <Field label="Notify Party" value={shipment.notifyParty} />
                <Field label="Operator" value={shipment.operatorName} />
              </div>
            </div>

            <hr className="border-border" />

            {/* Commercial */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commercial</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                <Field label="Incoterm" value={shipment.incoterm} />
                <Field label="Freight Term" value={shipment.freightTerm} />
                <Field label="Service Lane" value={shipment.serviceLane} />
                <div className="col-span-2 md:col-span-3">
                  <Field label="Cargo Description" value={shipment.cargoDescription} />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Container */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Container
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                <Field label="Number" value={shipment.containerNumber} mono />
                <Field
                  label="Type / Size"
                  value={
                    shipment.containerType
                      ? [
                          shipment.containerSizeFt != null ? `${shipment.containerSizeFt}ft` : null,
                          shipment.containerType,
                          shipment.containerIsoCode ? `(${shipment.containerIsoCode})` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : null
                  }
                />
                <Field label="ISO Code" value={shipment.containerIsoCode} />
                <Field
                  label="Gross Weight"
                  value={shipment.grossWeightKg != null ? `${Number(shipment.grossWeightKg).toLocaleString()} kg` : null}
                />
                <Field
                  label="Net Weight"
                  value={shipment.netWeightKg != null ? `${Number(shipment.netWeightKg).toLocaleString()} kg` : null}
                />
                <Field
                  label="Volume"
                  value={shipment.volumeCbm != null ? `${Number(shipment.volumeCbm).toFixed(2)} m³` : null}
                />
                <Field
                  label="Packages"
                  value={
                    shipment.packages != null
                      ? `${shipment.packages.toLocaleString()}${shipment.packageType ? ` ${shipment.packageType}` : ""}`
                      : null
                  }
                />
              </div>
            </div>

            <hr className="border-border" />

            {/* Route */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Route</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                <Field label="Origin" value={`${shipment.originPortUnlocode} — ${shipment.originPortName}`} />
                <Field label="Destination" value={`${shipment.destinationPortUnlocode} — ${shipment.destinationPortName}`} />
                {shipment.transshipmentPortUnlocode && (
                  <Field label="Transshipment" value={`${shipment.transshipmentPortUnlocode} — ${shipment.transshipmentPortName}`} />
                )}
                <Field label="Vessel" value={shipment.vesselName} />
                <Field label="Voyage" value={shipment.voyageNumber} mono />
                <Field label="ETA" value={formatDateShort(shipment.eta)} />
              </div>
            </div>

            {/* ── Cabotagem section (conditional) ── */}
            {isCabotagem && (
              <>
                <hr className="border-border" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Cabotagem
                  </p>

                  {/* Delay reason banner */}
                  {shipment.delayReason && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        <span className="font-medium">Delay reason:</span> {shipment.delayReason}
                      </p>
                    </div>
                  )}

                  {/* Carrier client code + city */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 mb-4">
                    <Field label="Carrier Client Code" value={shipment.carrierClientCode} mono />
                    <Field label="City of Operation" value={shipment.cityOfOperation} />
                  </div>

                  {/* Coleta / Entrega grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coluna 1 — Coleta */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Coleta</p>
                      <div className="space-y-3">
                        <Field label="Programado" value={shipment.scheduledPickupAt ? formatDateShort(shipment.scheduledPickupAt) : null} />
                        <Field label="Realizado" value={shipment.actualPickupAt ? formatDateShort(shipment.actualPickupAt) : null} />
                        <Field label="Local" value={shipment.pickupLocation} />
                        <Field label="Veículo" value={shipment.vehiclePlate} mono />
                        <Field label="Carreta" value={shipment.trailerPlate} mono />
                        <Field label="Motorista" value={shipment.driverName} />
                        <Field label="Lacre" value={shipment.sealNumber} mono />
                        <Field label="Lacre 2" value={shipment.sealNumber2} mono />
                      </div>
                    </div>

                    {/* Coluna 2 — Entrega */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Entrega</p>
                      <div className="space-y-3">
                        <Field label="Programado" value={shipment.scheduledDeliveryAt ? formatDateShort(shipment.scheduledDeliveryAt) : null} />
                        <Field label="Realizado" value={shipment.actualDeliveryAt ? formatDateShort(shipment.actualDeliveryAt) : null} />
                        <Field label="Local" value={shipment.deliveryLocation} />
                        <Field label="CT-e" value={shipment.cteNumber} mono />
                        <Field
                          label="NF"
                          value={
                            shipment.nfNumber
                              ? [
                                  shipment.nfNumber,
                                  shipment.nfValueCents != null
                                    ? `R$ ${(shipment.nfValueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" — ")
                              : null
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <hr className="border-border" />

            {/* Operational Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operational Status</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Documents</p>
                  <DocBadge status={shipment.documentStatus} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Customs</p>
                  <CustomsBadge status={shipment.customsStatus} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Risk Level</p>
                  <RiskBadge level={shipment.riskLevel} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Delay</p>
                  {shipment.delayDays > 0 ? (
                    <span className="text-sm font-medium text-red-600">
                      +{shipment.delayDays} day{shipment.delayDays !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-green-600">On time</span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {shipment.notes && (
              <>
                <hr className="border-border" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm text-muted-foreground">{shipment.notes}</p>
                </div>
              </>
            )}

            {/* VesselFinder link */}
            {shipment.vesselSourceUrl && (
              <>
                <hr className="border-border" />
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={shipment.vesselSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Track vessel on VesselFinder
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            )}

            {/* Timestamps */}
            <hr className="border-border" />
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <Field label="Created" value={formatDate(shipment.createdAt)} />
              <Field label="Last Updated" value={formatDate(shipment.updatedAt)} />
            </div>
          </CardContent>
        </Card>

        {/* ── Documents ── */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Documents
              </CardTitle>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={openUploadModal}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Upload Document
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                {canEdit && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={openUploadModal}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload first document
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">File Name</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Size</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Uploaded At</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5">
                          <DocTypeBadge type={doc.type} />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium truncate max-w-[180px]">{doc.fileName}</p>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {formatBytes(doc.sizeBytes)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                          {formatDateShort(doc.uploadedAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => window.open(doc.presignedUrl, "_blank")}
                              className="text-primary hover:underline flex items-center gap-1 text-xs font-medium"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                                disabled={deletingDocId === doc.id}
                                className="text-destructive hover:text-destructive/80 flex items-center gap-1 text-xs font-medium disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingDocId === doc.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Shipment Timeline</CardTitle>
              {events.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {events.length} event{events.length !== 1 ? "s" : ""} recorded
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ShipmentTimeline events={events} status={shipment.status} />
          </CardContent>
        </Card>
      </main>

      {/* ── Edit Shipment Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Edit Shipment</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status *</label>
                <Select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  required
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Container */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Container Number</label>
                  <Input
                    value={editForm.containerNumber}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, containerNumber: e.target.value.toUpperCase() }))
                    }
                    placeholder="e.g. MSCU7234561"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Container Type</label>
                  <Select
                    value={editForm.containerType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, containerType: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {CONTAINER_TYPE_OPTIONS.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Shipper</label>
                  <Input
                    value={editForm.shipper}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, shipper: e.target.value }))}
                    placeholder="Exporter / supplier"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Consignee</label>
                  <Input
                    value={editForm.consignee}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, consignee: e.target.value }))}
                    placeholder="Importer / receiver"
                  />
                </div>
              </div>

              {/* Commercial */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Incoterm</label>
                <Input
                  value={editForm.incoterm}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, incoterm: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. FOB, CIF, EXW"
                />
              </div>

              {/* Operational */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Document Status</label>
                  <Select
                    value={editForm.documentStatus}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, documentStatus: e.target.value }))}
                  >
                    {DOCUMENT_STATUS_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Customs Status</label>
                  <Select
                    value={editForm.customsStatus}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, customsStatus: e.target.value }))}
                  >
                    {CUSTOMS_STATUS_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={editSaving}>
                  {editSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Upload Document Modal ── */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Upload Document</h2>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Document Type *</label>
                <Select
                  value={uploadForm.type}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      type: e.target.value as DocumentRecord["type"],
                    }))
                  }
                >
                  {DOC_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
                <Input
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="e.g. Original BL — set 1/3"
                />
              </div>

              {/* File */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">File *</label>
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.csv,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadForm((prev) => ({ ...prev, file: f }));
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                {uploadForm.file ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{uploadForm.file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(uploadForm.file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadForm((prev) => ({ ...prev, file: null }))}
                      className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => uploadFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose file
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Accepted: PDF, XLSX, CSV, JPG, PNG — max 20 MB
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setUploadModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={uploading || !uploadForm.file}
                  onClick={handleUpload}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
