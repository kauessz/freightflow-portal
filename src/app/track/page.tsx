import { Suspense } from "react";
import TrackPageClient from "./track-page-client";

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading tracking page...</div>}>
      <TrackPageClient />
    </Suspense>
  );
}