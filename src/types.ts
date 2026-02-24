export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  sites: Site[];
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
