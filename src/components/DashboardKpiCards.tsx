"use client";

import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  FileText,
  Package,
  Ship,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OperationsDashboardStats } from "@/types";

interface DashboardKpiCardsProps {
  stats: OperationsDashboardStats;
  onFilterClick: (filterType: "delayed" | "at_risk" | "critical_alerts") => void;
}

export default function DashboardKpiCards({
  stats,
  onFilterClick,
}: DashboardKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Total Shipments */}
      <Card>
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Package className="h-4 w-4 text-gray-600" />
          </div>
          <p className="text-2xl font-bold leading-none">{stats.totalShipments}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Total shipments</p>
        </CardContent>
      </Card>

      {/* 2. In Transit */}
      <Card>
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <Ship className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold leading-none text-blue-600">
            {stats.inTransit}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">In transit</p>
        </CardContent>
      </Card>

      {/* 3. Delayed — clickable */}
      <Card
        className="cursor-pointer hover:bg-amber-50 transition-colors"
        onClick={() => onFilterClick("delayed")}
        title="Click to filter delayed shipments"
      >
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold leading-none text-amber-600">
            {stats.delayed}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">Delayed</p>
        </CardContent>
      </Card>

      {/* 4. At Risk — clickable */}
      <Card
        className="cursor-pointer hover:bg-orange-50 transition-colors"
        onClick={() => onFilterClick("at_risk")}
        title="Click to filter high & critical risk shipments"
      >
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold leading-none text-orange-500">
            {stats.atRisk}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">At risk</p>
        </CardContent>
      </Card>

      {/* 5. Awaiting Docs */}
      <Card>
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center mb-3">
            <FileText className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold leading-none text-purple-600">
            {stats.awaitingDocs}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">Awaiting docs</p>
        </CardContent>
      </Card>

      {/* 6. Critical Alerts — clickable */}
      <Card
        className="cursor-pointer hover:bg-red-50 transition-colors"
        onClick={() => onFilterClick("critical_alerts")}
        title="Click to filter critical risk shipments"
      >
        <CardContent className="p-4">
          <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <AlertOctagon className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold leading-none text-red-600">
            {stats.criticalAlerts}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">Critical alerts</p>
        </CardContent>
      </Card>
    </div>
  );
}
