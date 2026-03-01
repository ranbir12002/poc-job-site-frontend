export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  sites: Site[];
  pipes?: Pipe[];
}

export enum PipeStage {
  PORT = 'PORT',
  TRANSIT = 'TRANSIT',
  WAREHOUSE = 'WAREHOUSE',
  TRANSIT_2 = 'TRANSIT_2',
  STAGING = 'STAGING',
  INSTALLED = 'INSTALLED',
  MISSING = 'MISSING'
}

export interface LocationLog {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface PipeEvent {
  id: string;
  stage: PipeStage;
  timestamp: number;
  notes?: string;
  vehicleNumber?: string;
  location?: [number, number];
  locationLogs?: LocationLog[];
}

export interface Pipe {
  id: string;
  rfid: string;
  material: string;
  length: number; // in meters
  radius: number; // in inches or cm
  stage: PipeStage;
  eventHistory: PipeEvent[];
  geoTag?: Point;
  shippedBy?: string;
  vehicleNumber?: string;
  approvedBy?: string;
  updatedAt: number;
}

export interface DailyProgress {
  id: string;
  date: number;
  metersCompleted: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  customTileUrl?: string;
}

export interface Site {
  id: string;
  name: string;
  createdAt: number;
  points: Point[];
  metrics: SiteMetrics;
  isClosed?: boolean;
  customTileUrl?: string;
  contractorCommitmentPerDay?: number;
  dailyProgress?: DailyProgress[];
  pathThickness?: number;
  approved?: boolean;
}

export interface Point {
  lat: number;
  lng: number;
}

export interface SiteMetrics {
  perimeterMeters: number;
  vertexCount: number;
  estimatedWalkTimeMinutes: number;
}
