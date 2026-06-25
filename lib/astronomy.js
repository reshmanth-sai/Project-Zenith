import * as AstronomyModule from 'astronomy-engine';
const Astronomy = AstronomyModule.default || AstronomyModule;
const { Body, Observer, Equator, Horizon } = Astronomy;

/**
 * Calculates the current positions (altitude and azimuth) of major planets (Mars, Venus, Jupiter, Saturn)
 * and the Moon based on user latitude and longitude, at the provided timestamp.
 * Returns only the celestial bodies that are currently above the horizon (altitude > 0).
 *
 * @param {number} latitude - Observer's latitude in degrees.
 * @param {number} longitude - Observer's longitude in degrees.
 * @param {Date|number|string} [timestamp] - Current timestamp (defaults to now).
 * @returns {Array<{name: string, altitude: number, azimuth: number, ra: number, dec: number, distanceAu: number}>}
 */
export function getVisibleCelestialBodies(latitude, longitude, timestamp = new Date()) {
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  const obs = new Observer(latitude, longitude, 0);

  const bodiesToTrack = [
    { id: 'Moon', body: Body.Moon, name: 'Moon' },
    { id: 'Venus', body: Body.Venus, name: 'Venus' },
    { id: 'Mars', body: Body.Mars, name: 'Mars' },
    { id: 'Jupiter', body: Body.Jupiter, name: 'Jupiter' },
    { id: 'Saturn', body: Body.Saturn, name: 'Saturn' }
  ];

  const results = [];

  for (const item of bodiesToTrack) {
    try {
      // Calculate topocentric equatorial coordinates of date (ofdate=true), corrected for aberration (aberration=true)
      const eq = Equator(item.body, dateObj, obs, true, true);
      
      // Convert equatorial coordinates to horizontal (altitude, azimuth)
      const hor = Horizon(dateObj, obs, eq.ra, eq.dec, 'normal');

      // Only return bodies that are currently above the horizon
      if (hor.altitude > 0) {
        results.push({
          name: item.name,
          altitude: parseFloat(hor.altitude.toFixed(3)),
          azimuth: parseFloat(hor.azimuth.toFixed(3)),
          ra: parseFloat(eq.ra.toFixed(4)),
          dec: parseFloat(eq.dec.toFixed(4)),
          distanceAu: parseFloat(eq.dist.toFixed(6))
        });
      }
    } catch (err) {
      console.error(`Error calculating position for ${item.name}:`, err);
    }
  }

  return results;
}
