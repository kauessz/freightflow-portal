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
  // Cabotagem (opcionais — só presentes em operationMode === "CABOTAGEM")
  operationMode?: "CABOTAGEM" | "LONGO_CURSO" | null;
  carrierClientCode?: string | null;
  cityOfOperation?: string | null;
  vehiclePlate?: string | null;
  trailerPlate?: string | null;
  sealNumber?: string | null;
  sealNumber2?: string | null;
  sealVerified?: boolean | null;
  driverName?: string | null;
  driverDocument?: string | null;
  scheduledPickupAt?: string | null;
  actualPickupAt?: string | null;
  pickupLocation?: string | null;
  scheduledDeliveryAt?: string | null;
  actualDeliveryAt?: string | null;
  deliveryLocation?: string | null;
  cteNumber?: string | null;
  cteIssuedAt?: string | null;
  nfNumber?: string | null;
  nfIssuedAt?: string | null;
  nfValueCents?: number | null;
  delayReason?: string | null;
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

// Internal tracking event used by authenticated shipment detail flows
export interface TrackingEvent {
  type: EventType;
  location: string;
  occurredAt: string;
  reportedAt: string;
  description: string;
}

// Public tracking milestone returned by GET /tracking/{booking}
export interface PublicTrackingMilestone {
  type: EventType;
  location: string;
  occurredAt: string;
}

// ==================== Tracking ====================

// PublicTrackingResponse.java
export interface PublicTrackingResponse {
  booking: string;
  containerNumber: string | null;
  status: ShipmentStatus;
  statusMessage: string | null;
  vesselName: string;
  voyageNumber: string;
  originPort: string;
  originPortUnlocode: string;
  destinationPort: string;
  destinationPortUnlocode: string;
  etd: string;
  eta: string;
  lastUpdate: string | null;
  milestones: PublicTrackingMilestone[];
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

// ==================== Cabotagem ====================

export interface CabotagemFields {
  operationMode?: "CABOTAGEM" | "LONGO_CURSO";
  carrierClientCode?: string | null;
  cityOfOperation?: string | null;
  vehiclePlate?: string | null;
  trailerPlate?: string | null;
  sealNumber?: string | null;
  sealNumber2?: string | null;
  sealVerified?: boolean | null;
  driverName?: string | null;
  driverDocument?: string | null;
  scheduledPickupAt?: string | null;
  actualPickupAt?: string | null;
  pickupLocation?: string | null;
  scheduledDeliveryAt?: string | null;
  actualDeliveryAt?: string | null;
  deliveryLocation?: string | null;
  cteNumber?: string | null;
  cteIssuedAt?: string | null;
  nfNumber?: string | null;
  nfIssuedAt?: string | null;
  nfValueCents?: number | null;
  delayReason?: string | null;
}

export interface DocumentRecord {
  id: string;
  type: "CTE" | "BL" | "NF" | "OTHER";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  description?: string | null;
  uploadedAt: string;
  presignedUrl: string;
}

export interface CabotagemImportResult {
  total: number;
  success: number;
  errors: number;
  errorDetails: Array<{ row: number; message: string }>;
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
  carrier?: string | null;
  originPortId?: string | null;        // UUID do porto de origem — usado para popular o form
  originPortName?: string | null;
  originPortUnlocode: string;
  destinationPortId?: string | null;   // UUID do porto de destino — usado para popular o form
  destinationPortName?: string | null;
  destinationPortUnlocode: string;
  etd: string;
  eta: string;
  eligibleForFleetMap?: boolean;
  ineligibilityReasons?: string[];
}

// ==================== Port (for selects) ====================

export interface PortOption {
  id: string;
  unlocode: string;
  name: string;
  country: string;
  active?: boolean;
}

export interface PortRecord {
  id: string;
  unlocode: string;
  name: string;
  country: string;
  active: boolean;
  timezone?: string | null;
  lat?: number | null;
  lon?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VesselRecord {
  id: string;
  name: string;
  imo: string | null;
  carrier: string | null;
  active: boolean;
  type?: string | null;
  flag?: string | null;
  capacityTeu?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoyageFleetMapReadiness {
  voyageId: string;
  voyageNumber: string;
  eligibleForFleetMap: boolean;
  ineligibilityReasons: string[];
}

export interface VoyageRecord {
  id: string;
  voyageNumber: string;
  vesselId?: string | null;
  vesselName: string;
  carrier: string | null;
  originPortId?: string | null;
  originPortName: string;
  originPortUnlocode: string;
  destinationPortId?: string | null;
  destinationPortName: string;
  destinationPortUnlocode: string;
  etd: string;
  eta: string;
  status: string;
  active?: boolean;
  eligibleForFleetMap?: boolean;
  ineligibilityReasons?: string[];
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

// ==================== Analytics ====================

export interface OperationsDashboardStats {
  totalShipments: number;
  inTransit: number;
  delayed: number;
  atRisk: number;
  awaitingDocs: number;
  openAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  byStatus: Record<string, number>;
  byCarrier: Record<string, number>;
}

// ==================== AIS Track History ====================

export interface PositionTrackPoint {
  lat: number;
  lon: number;
  occurredAt: string;
  speed: number | null;
  voyageId: string;
}

export interface RevisedEtaResponse {
  voyageId: string;
  voyageNumber: string;
  originalEta: string;
  revisedEta: string;
  distanceNm: number;
  speedKnots: number;
  delayHours: number;
  delayDays: number;
  positionSource: string;
  currentLat: number;
  currentLon: number;
}

// ==================== Voyage Tracking ====================

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

export interface FleetMapVoyage extends VoyageTracking {
  aggregatedRiskLevel?: RiskLevel | null;
  relatedShipments?: Shipment[];
}

export interface ActiveVesselWithShipmentsResponse {
  voyageId?: string | null;
  voyageNumber?: string | null;
  status?: string | null;
  vesselName?: string | null;
  vesselImo?: string | null;
  carrier?: string | null;
  originPortName?: string | null;
  originPortUnlocode?: string | null;
  originLat?: number | null;
  originLon?: number | null;
  destinationPortName?: string | null;
  destinationPortUnlocode?: string | null;
  destinationLat?: number | null;
  destinationLon?: number | null;
  etd?: string | null;
  eta?: string | null;
  vesselPosition?: AisPosition | null;
  aggregatedRiskLevel?: RiskLevel | null;
  relatedShipments?: Shipment[];
  shipments?: Shipment[];
  tracking?: VoyageTracking | null;
  voyage?: Partial<VoyageTracking> | null;
}
