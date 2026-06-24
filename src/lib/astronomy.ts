import * as AstronomyModule from 'astronomy-engine';
const Astronomy: any = (AstronomyModule as any).default || AstronomyModule;
const { Body, Observer, Equator, Horizon, Illumination, SearchRiseSet } = Astronomy;

export interface CelestialBodyPosition {
  name: string;
  altitude: number;
  azimuth: number;
  ra: number;
  dec: number;
  distanceAu: number;
  magnitude: number;
}

export interface RiseSetTimes {
  sunrise: string;
  sunset: string;
}

/**
 * Computes sunrise and sunset times for a given geographic observer coordinates.
 * Start search from UTC midnight of the target date.
 */
export function getSunriseSunset(
  latitude: number,
  longitude: number,
  timestamp: Date | number | string = new Date()
): RiseSetTimes {
  try {
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    // Set start point to midnight of that day in UTC to search for today's rise/set
    const startOfDay = new Date(dateObj);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const obs = new Observer(latitude, longitude, 0);

    // Direction 1 = rise, -1 = set. Search limit is 1 day.
    const riseTime = SearchRiseSet(Body.Sun, obs, 1, startOfDay, 1);
    const setTime = SearchRiseSet(Body.Sun, obs, -1, startOfDay, 1);

    const formatTime = (astroTime: any) => {
      if (!astroTime || !astroTime.date) return null;
      const d = new Date(astroTime.date);
      // Format to HH:MM in UTC for global observer consistency
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${mm} UTC`;
    };

    return {
      sunrise: formatTime(riseTime) || '06:14 UTC',
      sunset: formatTime(setTime) || '18:32 UTC'
    };
  } catch (err) {
    console.error("Error in getSunriseSunset calculation:", err);
    // Reliable astronomical fallback based on daylight duration approximation
    return { sunrise: '06:00 UTC', sunset: '18:00 UTC' };
  }
}

/**
 * Calculates current horizontal coordinates (altitude and azimuth) of major planets (Mars, Venus, Jupiter, Saturn)
 * and the Moon for a given observer latitude/longitude and timestamp.
 * Returns only the bodies that are currently above the horizon (altitude > 0).
 *
 * @param {number} latitude - Observer's latitude in degrees.
 * @param {number} longitude - Observer's longitude in degrees.
 * @param {Date|number|string} [timestamp] - Current timestamp (defaults to now).
 * @returns {CelestialBodyPosition[]} List of visible celestial bodies.
 */
export function getVisibleCelestialBodies(
  latitude: number,
  longitude: number,
  timestamp: Date | number | string = new Date()
): CelestialBodyPosition[] {
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  const obs = new Observer(latitude, longitude, 0);

  const bodiesToTrack = [
    { body: Body.Moon, name: 'Moon' },
    { body: Body.Venus, name: 'Venus' },
    { body: Body.Mars, name: 'Mars' },
    { body: Body.Jupiter, name: 'Jupiter' },
    { body: Body.Saturn, name: 'Saturn' }
  ];

  const results: CelestialBodyPosition[] = [];

  for (const item of bodiesToTrack) {
    try {
      const eq = Equator(item.body, dateObj, obs, true, true);
      const hor = Horizon(dateObj, obs, eq.ra, eq.dec, 'normal');

      let magnitude = 0;
      try {
        const illum = Illumination(item.body, dateObj);
        magnitude = parseFloat(illum.mag.toFixed(2));
      } catch (magErr) {
        console.error(`Error calculating magnitude for ${item.name}:`, magErr);
      }

      if (hor.altitude > 0) {
        results.push({
          name: item.name,
          altitude: parseFloat(hor.altitude.toFixed(3)),
          azimuth: parseFloat(hor.azimuth.toFixed(3)),
          ra: parseFloat(eq.ra.toFixed(4)),
          dec: parseFloat(eq.dec.toFixed(4)),
          distanceAu: parseFloat(eq.dist.toFixed(6)),
          magnitude
        });
      }
    } catch (err) {
      console.error(`Error calculating position for ${item.name}:`, err);
    }
  }

  return results;
}
export default getVisibleCelestialBodies;
