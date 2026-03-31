"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import {
  Search,
  Ship,
  ArrowRight,
  Loader2,
  AlertCircle,
  PackageX,
  Calendar,
  MapPin,
} from "lucide-react";
import api from "@/lib/api";
import { TrackingResponse, ApiError } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShipmentTimeline from "@/components/ShipmentTimeline";
import { statusColor, statusLabel, formatDateShort, formatDateTime } from "@/lib/utils";

export default function TrackPage() {
  const searchParams = useSearchParams();
  const [booking, setBooking] = useState("");
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const bookingParam = searchParams.get("booking");
    if (bookingParam) {
      setBooking(bookingParam);
      searchByBooking(bookingParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function searchByBooking(bookingNumber: string) {
    const trimmed = bookingNumber.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTracking(null);
    setNotFound(false);

    try {
      const response = await api.get<TrackingResponse>(
        `/tracking/${encodeURIComponent(trimmed)}`
      );
      setTracking(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      if (axiosError.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(
          axiosError.response?.data?.message ||
            "An error occurred while searching. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    searchByBooking(booking);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Ship className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FreightFlow</span>
          </div>
          <a
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in for full dashboard
          </a>
        </div>
      </header>

      {/* Hero + Search */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Track Your Shipment
          </h1>
          <p className="text-muted-foreground">
            Enter your booking number to get real-time tracking updates for your
            maritime cargo.
          </p>
        </div>

        {/* Search Form */}
        <form
          onSubmit={handleSearch}
          className="max-w-xl mx-auto flex gap-2 mb-12"
        >
          <Input
            type="text"
            placeholder="e.g. P10482561, MEDU1234567, 570000000"
            value={booking}
            onChange={(e) => setBooking(e.target.value.toUpperCase())}
            className="h-12 text-base"
            disabled={loading}
          />
          <Button type="submit" size="lg" disabled={loading || !booking.trim()}>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </Button>
        </form>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        {/* Not Found */}
        {notFound && (
          <div className="max-w-md mx-auto text-center py-12">
            <PackageX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Shipment not found</p>
            <p className="text-sm text-muted-foreground">
              No shipment matches booking{" "}
              <span className="font-mono font-medium">{booking}</span>.
              Please check the number and try again.
            </p>
          </div>
        )}

        {/* Tracking Result */}
        {tracking && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ── Summary Card ── */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                      Booking Number
                    </p>
                    <h2 className="text-2xl font-bold font-mono tracking-tight">
                      {tracking.booking}
                    </h2>
                  </div>
                  <Badge className={`${statusColor(tracking.status)} text-sm px-3 py-1`}>
                    {statusLabel(tracking.status)}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-6">
                {/* Route */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Origin</p>
                    <p className="text-lg font-bold leading-tight">
                      {tracking.originPort}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {tracking.originPortUnlocode}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <div className="h-px w-6 bg-border" />
                      <Ship className="h-4 w-4" />
                      <ArrowRight className="h-3 w-3" />
                      <div className="h-px w-6 bg-border" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs text-muted-foreground mb-1">Destination</p>
                    <p className="text-lg font-bold leading-tight">
                      {tracking.destinationPort}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {tracking.destinationPortUnlocode}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Vessel</p>
                    <p className="font-medium">{tracking.vesselName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tracking.voyageNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ETD</p>
                    <p className="font-medium">{formatDateTime(tracking.etd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Expected Arrival
                    </p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateShort(tracking.eta)}
                    </p>
                  </div>
                  {tracking.containerNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Container</p>
                      <p className="font-medium font-mono">{tracking.containerNumber}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Timeline Card ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Shipment Timeline</CardTitle>
                  {tracking.events.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {tracking.events.length} event{tracking.events.length !== 1 ? "s" : ""} recorded
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ShipmentTimeline
                  events={tracking.events}
                  status={tracking.status}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto flex h-14 items-center justify-center px-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FreightFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
