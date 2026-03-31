// ==================== Auth ====================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

// ==================== Shipment ====================

export type ShipmentStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "GATE_IN"
  | "LOADED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "GATE_OUT"
  | "DELIVERED"
  | "CANCELLED";

export type ContainerType =
  | "TEU20"
  | "TEU40"
  | "TEU40HC"
  | "REEFER20"
  | "REEFER40";

// Matches ShipmentResponse.java (flat DTO)
export interface Shipment {
  id: string;
  booking: string;
  containerNumber: string | null;
  containerType: ContainerType | null;
  status: ShipmentStatus;
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

// ==================== Shipment Stats ====================

export interface ShipmentStats {
  total: number;
  inTransit: number;
  arrived: number;
  delayed: number;
  atRisk: number;
}

// ==================== Event ====================

export type EventType =
  | "GATE_IN"
  | "LOADED"
  | "DEPARTED"
  | "TRANSSHIPMENT"
  | "ARRIVED"
  | "GATE_OUT"
  | "CUSTOMS_HOLD"
  | "CUSTOMS_RELEASE";

// Matches TrackingResponse.TrackingEvent (nested record)
export interface TrackingEvent {
  type: EventType;
  location: string;
  occurredAt: string;
  reportedAt: string;
  description: string;
}

// ==================== Tracking ====================

// Matches TrackingResponse.java (flat DTO)
export interface TrackingResponse {
  booking: string;
  containerNumber: string | null;
  status: ShipmentStatus;
  vesselName: string;
  voyageNumber: string;
  originPort: string;
  originPortUnlocode: string;
  destinationPort: string;
  destinationPortUnlocode: string;
  etd: string;
  eta: string;
  events: TrackingEvent[];
}

// ==================== Pagination ====================

// Matches PageResponse.java { data, meta }
export interface PageMeta {
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface PageResponse<T> {
  data: T[];
  meta: PageMeta;
}

// ==================== API Error ====================

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ==================== Create Shipment ====================

export interface CreateShipmentRequest {
  booking: string;
  containerNumber?: string;
  containerType?: ContainerType;
  voyageId: string;
  originPortId: string;
  destPortId: string;
  consignee?: string;
  shipper?: string;
}

// ==================== Voyage (for selects) ====================

export interface VoyageOption {
  id: string;
  voyageNumber: string;
  vesselName: string;
  originPortUnlocode: string;
  destinationPortUnlocode: string;
  etd: string;
  eta: string;
}

// ==================== Port (for selects) ====================

export interface PortOption {
  id: string;
  unlocode: string;
  name: string;
  country: string;
}

// ==================== AIS / Vessel Position ====================

export interface AisPosition {
  imo: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  course: number | null;
  status: string;
  timestamp: string;
  estimated: boolean;
}

export interface VoyageTracking {
  voyageId: string;
  voyageNumber: string;
  status: string;
  vesselName: string;
  vesselImo: string;
  originPortName: string;
  originPortUnlocode: string;
  originLat: number;
  originLon: number;
  destinationPortName: string;
  destinationPortUnlocode: string;
  destinationLat: number;
  destinationLon: number;
  etd: string;
  eta: string;
  vesselPosition: AisPosition;
}
