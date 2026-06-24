import * as satellite from 'satellite.js';

interface Location {
  latitude: number;
  longitude: number;
  elevationM?: number; // optional observer elevation in meters
}

interface LookAngles {
  altitude: number;  // elevation angle in degrees (referenced as altitude by the user)
  azimuth: number;   // azimuth angle in degrees
  rangeKm: number;   // distance to the satellite in km
}

/**
 * Parses a TLE string (containing 2 or 3 lines) and extracts Line 1 and Line 2.
 * Handles any leading/trailing whitespace or carriage returns.
 */
export function parseTle(tleStr: string): { line1: string; line2: string; name?: string } {
  const lines = tleStr
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    throw new Error('Invalid TLE format: TLE must contain at least Line 1 and Line 2.');
  }

  // If three lines, first is name, second is Line 1, third is Line 2
  if (lines.length >= 3) {
    // Check if the lines look like TLE (Line 1 starts with 1, Line 2 starts with 2)
    const line1Candidate = lines[1];
    const line2Candidate = lines[2];
    if (line1Candidate.startsWith('1 ') && line2Candidate.startsWith('2 ')) {
      return {
        name: lines[0],
        line1: line1Candidate,
        line2: line2Candidate
      };
    }
  }

  // Otherwise assume lines[0] is line 1 and lines[1] is line 2
  return {
    line1: lines[0],
    line2: lines[1]
  };
}

/**
 * Calculates current look angles (altitude/elevation and azimuth) of a satellite TLE
 * relative to a ground observer location at a given timestamp.
 * Returns null if calculation fails or if ECI position is unavailable.
 */
export function getLookAngles(
  tleStr: string,
  location: Location,
  timestamp: Date = new Date()
): LookAngles | null {
  try {
    const { line1, line2 } = parseTle(tleStr);
    const satrec = satellite.twoline2satrec(line1, line2);
    
    const positionAndVelocity = satellite.propagate(satrec, timestamp);
    const positionEci = positionAndVelocity.position;

    if (!positionEci || typeof positionEci === 'boolean') {
      return null;
    }

    const gmst = satellite.gstime(timestamp);
    const positionEcf = satellite.eciToEcf(positionEci as any, gmst);

    const observerGd = {
      latitude: location.latitude * Math.PI / 180,
      longitude: location.longitude * Math.PI / 180,
      height: (location.elevationM || 0) / 1000 // satellite.js expects height in km
    };

    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf as any);

    const altitudeDegrees = lookAngles.elevation * 180 / Math.PI;
    const azimuthDegrees = lookAngles.azimuth * 180 / Math.PI;

    return {
      altitude: parseFloat(altitudeDegrees.toFixed(3)),
      azimuth: parseFloat(azimuthDegrees.toFixed(3)),
      rangeKm: parseFloat(lookAngles.rangeSat.toFixed(2))
    };
  } catch (error) {
    console.error('Error calculating look angles for TLE:', error);
    return null;
  }
}

/**
 * Takes a TLE string and a user's current geographic location, computes look angles,
 * and returns the look angles ONLY if the satellite is above the horizon (altitude > 0).
 * Returns null if the satellite is below the horizon or if the calculation fails.
 */
export function getLookAnglesIfVisible(
  tleStr: string,
  location: Location,
  timestamp: Date = new Date()
): LookAngles | null {
  const angles = getLookAngles(tleStr, location, timestamp);
  if (angles && angles.altitude > 0) {
    return angles;
  }
  return null;
}

// Real TLE for ISS (ZARYA)
export const ISS_TLE = `1 25544U 98067A   26168.51329243  .00014603  00000-0  26305-3 0  9997
2 25544  51.6393 252.1793 0001844 195.1432 232.0673 15.49881845572979`;

/**
 * Calculates ISS projected latitude, longitude and altitude coordinates at any given timestamp.
 */
export function getIssPositionAtTime(timestampMs: number): { latitude: number; longitude: number; altitude: number } {
  try {
    const satrec = satellite.twoline2satrec(
      "1 25544U 98067A   26168.51329243  .00014603  00000-0  26305-3 0  9997",
      "2 25544  51.6393 252.1793 0001844 195.1432 232.0673 15.49881845572979"
    );
    const time = new Date(timestampMs);
    const positionAndVelocity = satellite.propagate(satrec, time);
    const positionEci = positionAndVelocity.position;

    if (positionEci && typeof positionEci !== 'boolean') {
      const gmst = satellite.gstime(time);
      const positionGd = satellite.eciToGeodetic(positionEci as any, gmst);
      const latDeg = positionGd.latitude * 180 / Math.PI;
      const lngDeg = positionGd.longitude * 180 / Math.PI;

      if (!isNaN(latDeg) && !isNaN(lngDeg)) {
        return {
          latitude: parseFloat(latDeg.toFixed(4)),
          longitude: parseFloat(lngDeg.toFixed(4)),
          altitude: parseFloat((positionGd.height || 418.5).toFixed(1))
        };
      }
    }
  } catch (error) {
    console.error("Error computing precision fallback ISS position:", error);
  }
  return { latitude: 0, longitude: 0, altitude: 418.5 };
}

/**
 * Calculates ISS projected latitude and longitude at 5-minute intervals for the next 90 minutes.
 * Returns an array of [latitude, longitude] coordinates.
 */
export function getIssFuturePath(startTimeMs: number): [number, number][] {
  const points: [number, number][] = [];
  const satrec = satellite.twoline2satrec(
    "1 25544U 98067A   26168.51329243  .00014603  00000-0  26305-3 0  9997",
    "2 25544  51.6393 252.1793 0001844 195.1432 232.0673 15.49881845572979"
  );

  // Generate 1-min intervals from 0 to 95 minutes for high-resolution smooth curves
  for (let mins = 0; mins <= 95; mins += 1) {
    const time = new Date(startTimeMs + mins * 60 * 1000);
    const positionAndVelocity = satellite.propagate(satrec, time);
    const positionEci = positionAndVelocity.position;

    if (positionEci && typeof positionEci !== 'boolean') {
      const gmst = satellite.gstime(time);
      const positionGd = satellite.eciToGeodetic(positionEci as any, gmst);
      const latDeg = positionGd.latitude * 180 / Math.PI;
      const lngDeg = positionGd.longitude * 180 / Math.PI;

      if (!isNaN(latDeg) && !isNaN(lngDeg)) {
        points.push([
          parseFloat(latDeg.toFixed(4)),
          parseFloat(lngDeg.toFixed(4))
        ]);
      }
    }
  }

  return points;
}

