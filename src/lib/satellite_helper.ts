/**
 * Calculates a satellite's geodetic position (latitude/longitude) based on a circular
 * Keplerian orbit model, with an option to freeze Earth's rotation drift.
 */
export function getSatellitePosition(
  inclination: number,
  period: number,
  altitude: number,
  seed: number,
  timestampMs: number,
  baseTimestampMs?: number
) {
  const angleSpeedRad = (2 * Math.PI) / period;
  const seconds = ((timestampMs / 1000) + seed * 100) % period;
  const u = angleSpeedRad * seconds; // Orbit argument
  
  const incRad = (inclination * Math.PI) / 180;
  const x = Math.cos(u);
  const y = Math.sin(u) * Math.cos(incRad);
  const z = Math.sin(u) * Math.sin(incRad);
  
  const latRad = Math.asin(z);
  let rawLngRad = Math.atan2(y, x);
  
  // Drifting due to Earth rotation (frozen at baseTimestampMs if provided)
  const earthRateRad = (2 * Math.PI) / 86400;
  const driftTimeMs = baseTimestampMs !== undefined ? baseTimestampMs : timestampMs;
  const driftRad = (driftTimeMs / 1000) * earthRateRad;
  let lngRad = rawLngRad - driftRad + (seed * 0.77);
  lngRad = ((lngRad + Math.PI) % (2 * Math.PI));
  if (lngRad < 0) lngRad += 2 * Math.PI;
  lngRad -= Math.PI;
  
  return {
    latitude: (latRad * 180) / Math.PI,
    longitude: (lngRad * 180) / Math.PI,
  };
}
