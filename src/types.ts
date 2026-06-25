export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CelestialObject {
  id: string;
  name: string;
  type: 'star' | 'planet' | 'satellite' | 'constellation';
  color: string;
  size: number;
  ra?: number;
  dec?: number;
  altitude?: number;
  azimuth?: number;
  abbreviation?: string;
  brightestStar?: string;
  inclination?: number;
  period?: number;
  velocity?: number;
  rangeKm?: number;
  visible?: boolean;
  magnitude?: number;
  description: string;
  latitude?: number;
  longitude?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  localCoordinates?: {
    altitude: number;
    azimuth: number;
    rangeKm?: number;
  } | null;
}

export interface Observer {
  name: string;
  latitude: number;
  longitude: number;
  elevationM: number;
}

export interface ObsLog {
  id: string;
  objectName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  content: string;
  generationType: 'zenith' | 'static_fallback' | 'intel';
}
