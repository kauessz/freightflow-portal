// ==================== Auth ====================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
  customerId: string | null;
  customerName: string | null;
  active: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserInfo;
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

export type DocumentStatus = "PENDING" | "PARTIALLY_RECEIVED" | "COMPLETE";
export type CustomsStatus = "NOT_STARTED" | "IN_PROGRESS" | "CLEARED" | "HOLD";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// Matches ShipmentResponse.java
export interface Shipment {
  id: string;
  booking: string;
  // Documentos
  houseBl: string | null;
  masterBl: string | null;
  customerReference: string | null;
  // Container
  containerNumber: string | null;
  containerType: ContainerType | null;
  containerSizeFt: number | null;
  containerIsoCode: string | null;
  grossWeightKg: number | null;
  netWeightKg: number | null;
  volumeCbm: number | null;
  packages: number | null;
  packageType: string | null;
  // Status
  status: ShipmentStatus;
  documentStatus: DocumentStatus;
  customsStatus: CustomsStatus;
  riskLevel: RiskLevel;
  delayDays: number;
  // Portos
  originPortName: string;
  originPortUnlocode: string;
  destinationPortName: string;
  destinationPortUnlocode: string;
  transshipmentPortName: string | null;
  transshipmentPortUnlocode: string | null;
  // Partes
  shipper: string | null;
  consignee: string | null;
  notifyParty: string | null;
  operatorName: string | null;
  // Voyage
  vesselName: string;
  voyageNumber: string;
  carrier: string;
  serviceLane: string | null;
  eta: string;
  // Comercial
  incoterm: string | null;
  freightTerm: string | null;
  cargoDescription: string | null;
  // Misc
  vesselSourceUrl: string | null;
  notes: string | null;
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

// Matches TrackingResponse.java
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
  // Campos operacionais
  houseBl: string | null;
  masterBl: string | null;
  incoterm: string | null;
  cargoDescription: string | null;
  documentStatus: DocumentStatus;
  customsStatus: CustomsStatus;
  riskLevel: RiskLevel;
  delayDays: number;
  events: TrackingEvent[];
}

// ==================== Pagination ====================

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
  detail?: string;
  title?: string;
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

export type PositionSource =
  | "LIVE_AIS"
  | "CACHED_AIS"
  | "ESTIMATED"
  | "UNAVAILABLE"
  | string;

export interface AisPosition {
  imo: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  status: string | null;
  lastUpdate: string | null;
  positionSource: PositionSource | null;
  positionEstimated?: boolean | null;
  timestamp?: string | null;
  estimated?: boolean | null;
}

export interface VoyageTracking {
  voyageId: string;
  voyageNumber: string;
  status: string;
  vesselName: string;
  vesselImo: string;
  carrier: string | null;
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
  vesselPosition: AisPosition | null;
}
