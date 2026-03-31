"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { VoyageTracking } from "@/types";

interface FleetMapProps {
  voyages: VoyageTracking[];
}

// Inject Leaflet CSS via <link> tag (more reliable than import in dynamic components)
function ensureLeafletCSS() {
  if (typeof document === "undefined") return;
  const id = "leaflet-css";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

function createVesselIcon(estimated: boolean) {
  const color = estimated ? "#f59e0b" : "#2563eb";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
      <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
      <path d="M12 1v4"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "vessel-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createPortIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="5" fill="#10b981" stroke="#fff" stroke-width="2"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "port-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

function formatSpeed(speed: number | null): string {
  if (speed === null || speed === undefined) return "N/A";
  return `${speed.toFixed(1)} kn`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function addMarkersToMap(map: L.Map, voyages: VoyageTracking[]) {
  // Clear existing markers and lines
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });

  if (voyages.length === 0) return;

  const bounds: L.LatLngExpression[] = [];
  const portIcon = createPortIcon();

  voyages.forEach((v) => {
    const pos = v.vesselPosition;
    if (!pos || pos.latitude === null || pos.longitude === null) return;

    const vesselLatLng: L.LatLngExpression = [pos.latitude, pos.longitude];
    const originLatLng: L.LatLngExpression = [v.originLat, v.originLon];
    const destLatLng: L.LatLngExpression = [v.destinationLat, v.destinationLon];

    bounds.push(vesselLatLng, originLatLng, destLatLng);

    // Vessel marker
    const vesselIcon = createVesselIcon(pos.estimated);
    const estimatedBadge = pos.estimated
      ? `<div style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-top:6px;display:inline-block;">⚠ Position estimated</div>`
      : "";

    const popupContent = `
      <div style="min-width:220px;font-family:system-ui,sans-serif;">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${v.vesselName}</div>
        <div style="color:#6b7280;font-size:12px;margin-bottom:8px;">IMO ${v.vesselImo} · ${v.voyageNumber}</div>
        <div style="border-top:1px solid #e5e7eb;padding-top:8px;font-size:13px;">
          <div style="margin-bottom:4px;">
            <span style="color:#6b7280;">Route:</span>
            <strong>${v.originPortName}</strong> → <strong>${v.destinationPortName}</strong>
          </div>
          <div style="margin-bottom:4px;">
            <span style="color:#6b7280;">Speed:</span> ${formatSpeed(pos.speed)}
          </div>
          <div style="margin-bottom:4px;">
            <span style="color:#6b7280;">Course:</span> ${pos.course !== null ? pos.course + "°" : "N/A"}
          </div>
          <div style="margin-bottom:4px;">
            <span style="color:#6b7280;">ETA:</span> ${formatDate(v.eta)}
          </div>
          <div style="margin-bottom:2px;">
            <span style="color:#6b7280;">Status:</span> ${v.status.replace(/_/g, " ")}
          </div>
          ${estimatedBadge}
        </div>
      </div>
    `;

    L.marker(vesselLatLng, { icon: vesselIcon })
      .addTo(map)
      .bindPopup(popupContent);

    // Origin port marker
    L.marker(originLatLng, { icon: portIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:system-ui,sans-serif;">
          <strong>${v.originPortName}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${v.originPortUnlocode} · Origin</span>
        </div>`
      );

    // Destination port marker
    L.marker(destLatLng, { icon: portIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:system-ui,sans-serif;">
          <strong>${v.destinationPortName}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${v.destinationPortUnlocode} · Destination</span>
        </div>`
      );

    // Dashed route line (origin → destination)
    L.polyline([originLatLng, destLatLng], {
      color: "#94a3b8",
      weight: 2,
      dashArray: "8, 6",
      opacity: 0.7,
    }).addTo(map);

    // Solid line from origin to vessel position (traveled portion)
    L.polyline([originLatLng, vesselLatLng], {
      color: "#2563eb",
      weight: 2.5,
      opacity: 0.8,
    }).addTo(map);
  });

  // Fit map to show all markers
  if (bounds.length > 0) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
  }
}

export default function FleetMap({ voyages }: FleetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once
  useEffect(() => {
    ensureLeafletCSS();

    if (!mapRef.current || mapInstanceRef.current) return;

    // Small delay to ensure CSS is loaded and container has dimensions
    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: [-25, -40],
        zoom: 4,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Force Leaflet to recalculate container size
      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 200);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Add markers when BOTH map is ready AND voyages are loaded
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    console.log("[FleetMap] Adding markers for", voyages.length, "voyages");
    addMarkersToMap(mapInstanceRef.current, voyages);
  }, [mapReady, voyages]);

  return (
    <>
      <style>{`
        .vessel-marker {
          background: transparent !important;
          border: none !important;
        }
        .port-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
      `}</style>
      <div ref={mapRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
    </>
  );
}
