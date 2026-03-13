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

export interface LidarScan {
  id: string;
  filename: string;
  format: 'ply' | 'obj' | 'glb' | 'usdz';
  fileUrl: string;
  vertexCount: number;
  boundingBox: {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
  };
  depthRange: { min: number; max: number };
  surfaceArea?: number;
  volume?: number;
  createdAt: number;
  deviceInfo?: string;
}

export interface SiteRecording {
  id: string;
  createdAt: number;
  name?: string;
  tourNodes: any[];
  tourId?: string;
  points: Point[];
  approved?: boolean;
  lidarScans?: LidarScan[];
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
  recordings?: SiteRecording[];
}

export interface Point {
  lat: number;
  lng: number;
}

export interface SiteMetrics {
  perimeterMeters: number;
  vertexCount: number;
  estimatedWalkTimeMinutes: number;
  tourNodes?: any[];
  tourId?: string;
}
