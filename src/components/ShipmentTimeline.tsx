"use client";

import {
  Truck,
  Package,
  Anchor,
  ArrowLeftRight,
  MapPin,
  CheckCircle,
  AlertTriangle,
  DoorOpen,
  Clock,
} from "lucide-react";
import { TrackingEvent, PublicTrackingMilestone, ShipmentStatus, EventType } from "@/types";
import { eventLabel, formatDateTimePtBR } from "@/lib/utils";

type TimelineEvent = TrackingEvent | PublicTrackingMilestone;

interface ShipmentTimelineProps {
  events: TimelineEvent[];
  status: ShipmentStatus;
}

// Ícone por tipo de evento
const EVENT_ICONS: Record<string, React.ReactNode> = {
  GATE_IN: <Truck className="h-4 w-4" />,
  LOADED: <Package className="h-4 w-4" />,
  DEPARTED: <Anchor className="h-4 w-4" />,
  TRANSSHIPMENT: <ArrowLeftRight className="h-4 w-4" />,
  ARRIVED: <MapPin className="h-4 w-4" />,
  CUSTOMS_RELEASE: <CheckCircle className="h-4 w-4" />,
  CUSTOMS_HOLD: <AlertTriangle className="h-4 w-4" />,
  GATE_OUT: <DoorOpen className="h-4 w-4" />,
};

// Progressão padrão de milestones esperados por status
const MILESTONE_CHAIN: EventType[] = [
  "GATE_IN",
  "LOADED",
  "DEPARTED",
  "ARRIVED",
  "CUSTOMS_RELEASE",
  "GATE_OUT",
];

// Dado o status atual, quais milestones ainda são esperados (não registrados)
function getProjectedMilestones(
  events: TimelineEvent[],
  status: ShipmentStatus
): EventType[] {
  // Se já chegou/entregue/cancelado, não projetar nada
  if (["ARRIVED", "DELIVERED", "GATE_OUT", "CANCELLED"].includes(status)) {
    return [];
  }

  const recordedTypes = new Set(events.map((e) => e.type));

  return MILESTONE_CHAIN.filter((milestone) => !recordedTypes.has(milestone));
}

interface TimelineItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string | null;
  location?: string;
  dateTime?: string;
  isLast: boolean;
  isCurrent: boolean;
  isProjected?: boolean;
  isHold?: boolean;
}

function TimelineItem({
  icon,
  label,
  description,
  location,
  dateTime,
  isLast,
  isCurrent,
  isProjected = false,
  isHold = false,
}: TimelineItemProps) {
  const iconBg = isProjected
    ? "border-dashed border-gray-300 bg-gray-50 text-gray-400"
    : isHold
    ? "border-red-400 bg-red-50 text-red-500"
    : isCurrent
    ? "border-primary bg-primary text-white shadow-sm shadow-primary/30"
    : "border-primary bg-primary/10 text-primary";

  const labelColor = isProjected
    ? "text-gray-400"
    : isHold
    ? "text-red-600"
    : isCurrent
    ? "text-primary font-semibold"
    : "text-foreground font-medium";

  const connectorColor = isProjected ? "bg-gray-200" : "bg-primary/30";

  return (
    <div className="flex gap-4">
      {/* Coluna da esquerda: ícone + linha conectora */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${iconBg} transition-all`}
        >
          {isProjected ? <Clock className="h-4 w-4" /> : icon}
        </div>
        {!isLast && (
          <div className={`w-0.5 grow ${connectorColor} mt-1 mb-1 min-h-[24px]`} />
        )}
      </div>

      {/* Conteúdo */}
      <div className={`pb-6 pt-1 ${isLast ? "pb-0" : ""}`}>
        <p className={`text-sm ${labelColor}`}>
          {label}
          {isCurrent && (
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Current
            </span>
          )}
          {isProjected && (
            <span className="ml-2 text-xs text-gray-400 font-normal italic">
              expected
            </span>
          )}
        </p>

        {description && !isProjected && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}

        {!isProjected && (location || dateTime) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
            {location && dateTime && <span className="text-muted-foreground/50">·</span>}
            {dateTime && <span>{dateTime}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShipmentTimeline({ events, status }: ShipmentTimelineProps) {
  const projectedMilestones = getProjectedMilestones(events, status);
  const allItems = events.length + projectedMilestones.length;

  if (allItems === 0) {
    return (
      <div className="py-6 text-center">
        <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No events recorded yet. Tracking will appear here once cargo is in movement.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Eventos registrados */}
      {events.map((event, index) => {
        const isLastRecorded = index === events.length - 1;
        const isCurrent = isLastRecorded && projectedMilestones.length === 0;
        const isHold = event.type === "CUSTOMS_HOLD";

        return (
          <TimelineItem
            key={`event-${index}`}
            icon={EVENT_ICONS[event.type] || <MapPin className="h-4 w-4" />}
            label={eventLabel(event.type)}
            description={"description" in event ? event.description : undefined}
            location={event.location}
            dateTime={formatDateTimePtBR(event.occurredAt)}
            isLast={
              isLastRecorded &&
              projectedMilestones.length === 0
            }
            isCurrent={isCurrent || (isLastRecorded && projectedMilestones.length > 0)}
            isHold={isHold}
          />
        );
      })}

      {/* Milestones projetados */}
      {projectedMilestones.map((milestone, index) => {
        const isLast = index === projectedMilestones.length - 1;

        return (
          <TimelineItem
            key={`projected-${milestone}`}
            icon={EVENT_ICONS[milestone] || <MapPin className="h-4 w-4" />}
            label={eventLabel(milestone)}
            isLast={isLast}
            isCurrent={false}
            isProjected={true}
          />
        );
      })}
    </div>
  );
}
