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
} from "lucide-react";
import api, { isAuthenticated } from "@/lib/api";
import { ApiError, TrackingEvent, ShipmentStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShipmentTimeline from "@/components/ShipmentTimeline";
import { statusColor, statusLabel, formatDate, formatDateShort } from "@/lib/utils";

// Full shipment detail from GET /api/v1/shipments/:id
interface ShipmentDetail {
  id: string;
  booking: string;
  containerNumber: string | null;
  containerType: string | null;
  status: ShipmentStatus;
  consignee: string | null;
  shipper: string | null;
  originPortName: string;
  originPortUnlocode: string;
  destinationPortName: string;
  destinationPortUnlocode: string;
  vesselName: string;
  voyageNumber: string;
  eta: string;
  createdAt: string;
  updatedAt: string;
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
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
          api.get<ShipmentDetail>(`/shipments/${id}`),
          api
            .get<{ data: TrackingEvent[] }>(`/shipments/${id}/events`)
            .catch(() => ({ data: { data: [] } })),
        ]);
        setShipment(shipmentRes.data);
        // Ordena eventos ASC para a timeline
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

        {/* Title */}
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
              {shipment.vesselName} &mdash; Voyage{" "}
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
          </div>
        </div>

        {/* Details Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shipment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Booking</p>
                <p className="font-medium font-mono">{shipment.booking}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Container</p>
                <p className="font-medium font-mono">{shipment.containerNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Container Type</p>
                <p className="font-medium">{shipment.containerType || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Origin</p>
                <p className="font-medium">
                  {shipment.originPortUnlocode} — {shipment.originPortName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Destination</p>
                <p className="font-medium">
                  {shipment.destinationPortUnlocode} — {shipment.destinationPortName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Vessel</p>
                <p className="font-medium">{shipment.vesselName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Voyage</p>
                <p className="font-medium font-mono">{shipment.voyageNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ETA</p>
                <p className="font-medium">{formatDateShort(shipment.eta)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Shipper</p>
                <p className="font-medium">{shipment.shipper || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Consignee</p>
                <p className="font-medium">{shipment.consignee || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created</p>
                <p className="font-medium">{formatDate(shipment.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last Updated</p>
                <p className="font-medium">{formatDate(shipment.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Card */}
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
