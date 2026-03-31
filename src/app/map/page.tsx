"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Ship, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import api, { isAuthenticated } from "@/lib/api";
import { VoyageTracking, PageResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

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

export default function MapPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [trackingData, setTrackingData] = useState<VoyageTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchFleetPositions();
  }, [router]);

  async function fetchFleetPositions() {
    setLoading(true);
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
        setLoading(false);
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
      console.log("[MapPage] Tracking data loaded:", validResults.length, "voyages", validResults);

      setTrackingData(validResults);
    } catch (err) {
      setError("Failed to load fleet positions. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Ship className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">FreightFlow</span>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:inline">Fleet Map</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-700 border-blue-300">
              {trackingData.length} active vessel{trackingData.length !== 1 ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading fleet positions...</p>
          </div>
        </div>
      )}

      {/* Map */}
      {!loading && (
        <div className="flex-1 relative" style={{ minHeight: "calc(100vh - 64px)" }}>
          <FleetMap voyages={trackingData} />
        </div>
      )}
    </div>
  );
}
