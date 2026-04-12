"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  Ship,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  Package,
  Weight,
  AlertTriangle,
} from "lucide-react";
import api, { isAuthenticated } from "@/lib/api";
import { ApiError, TrackingEvent, Shipment } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShipmentTimeline from "@/components/ShipmentTimeline";
import { statusColor, statusLabel, formatDate, formatDateShort } from "@/lib/utils";

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
    COMPLETE:            { label: "Complete",   cls: "bg-green-100 text-green-700" },
    PARTIALLY_RECEIVED:  { label: "Partial",    cls: "bg-yellow-100 text-yellow-700" },
    PENDING:             { label: "Pending",    cls: "bg-red-100 text-red-700" },
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

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    async function fetchData() {
      setLoading(true);
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
    }

    fetchData();
  }, [id, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
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

  const isRisky = shipment.riskLevel === "HIGH" || shipment.riskLevel === "CRITICAL";

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
        <div className="flex items-center gap-3 mb-6">
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
            <Badge className={`${statusColor(shipment.status)} text-sm px-3 py-1`}>
              {statusLabel(shipment.status)}
            </Badge>
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
                      ? `${shipment.containerSizeFt}ft · ${shipment.containerType}${shipment.containerIsoCode ? ` (${shipment.containerIsoCode})` : ""}`
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
    </div>
  );
}
