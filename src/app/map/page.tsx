"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Ship,
  Loader2,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import api, { isAuthenticated } from "@/lib/api";
import { VoyageTracking, PageResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Leaflet must be dynamically imported (needs window/document)
const FleetMap = dynamic(() => import("./fleet-map"), { ssr: false });

// Voyage list item from /api/v1/voyages
interface VoyageListItem {
  id: string;
  voyageNumber: string;
  status: string;
  vesselName: string;
  vesselImo: string;
}

const REFRESH_INTERVAL = 60; // seconds

export default function MapPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [trackingData, setTrackingData] = useState<VoyageTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh state
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [justUpdated, setJustUpdated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Keep stable ref to avoid stale closure in interval
  const fetchRef = useRef<((showSpinner: boolean) => Promise<void>) | null>(null);

  const fetchFleetPositions = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // 1. Get all voyages
      const voyagesRes = await api.get<PageResponse<VoyageListItem>>("/voyages", {
        params: { size: 100 },
      });

      const voyages = voyagesRes.data?.data || [];

      // 2. Filter to IN_TRANSIT and DEPARTED voyages
      const activeVoyages = voyages.filter(
        (v) => v.status === "IN_TRANSIT" || v.status === "DEPARTED"
      );

      if (activeVoyages.length === 0) {
        setTrackingData([]);
        return;
      }

      // 3. Fetch tracking data for each active voyage (in parallel)
      const trackingPromises = activeVoyages.map((v) =>
        api
          .get<VoyageTracking>(`/voyages/${v.id}/tracking`)
          .then((res) => res.data)
          .catch(() => null)
      );

      const results = await Promise.all(trackingPromises);
      const validResults = results.filter((r): r is VoyageTracking => r !== null);

      setTrackingData(validResults);

      // Flash "Updated just now" for 3 seconds
      if (!showSpinner) {
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 3000);
      }
    } catch {
      setError("Failed to load fleet positions. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Keep ref in sync so the interval always calls the latest version
  useEffect(() => {
    fetchRef.current = fetchFleetPositions;
  }, [fetchFleetPositions]);

  // Initial load
  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchFleetPositions(true);
  }, [router, fetchFleetPositions]);

  // Countdown + auto-refresh ticker (only runs after initial load)
  useEffect(() => {
    if (!mounted || loading) return;

    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger background refresh
          fetchRef.current?.(false);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [mounted, loading]);

  function handleManualRefresh() {
    setCountdown(REFRESH_INTERVAL);
    fetchFleetPositions(false);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Progress bar width: from 100% (60s) down to 0% (0s)
  const progressPct = (countdown / REFRESH_INTERVAL) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Left: logo + title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Ship className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">FreightFlow</span>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Fleet Map
            </span>
          </div>

          {/* Right: vessel count + refresh controls + back */}
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-700 border-blue-300">
              {trackingData.length} active vessel
              {trackingData.length !== 1 ? "s" : ""}
            </Badge>

            {/* Refresh status / countdown */}
            {!loading && (
              <div className="hidden sm:flex items-center gap-2">
                {justUpdated ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Updated just now
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Updating in {countdown}s
                  </span>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className="h-7 text-xs px-2"
                >
                  {refreshing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Refresh now"
                  )}
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* ── Progress bar (depletes over 60s) ── */}
        {!loading && (
          <div className="relative h-0.5 w-full bg-border overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-primary"
              style={{
                width: `${progressPct}%`,
                transition: "width 1s linear",
              }}
            />
          </div>
        )}
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => fetchFleetPositions(true)}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── Loading (initial only) ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Loading fleet positions...
            </p>
          </div>
        </div>
      )}

      {/* ── Map ── */}
      {!loading && (
        <div
          className="flex-1 relative"
          style={{ minHeight: "calc(100vh - 68px)" }}
        >
          <FleetMap voyages={trackingData} />
        </div>
      )}
    </div>
  );
}
