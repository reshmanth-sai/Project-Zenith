// This file is a CommonJS / ESM compatible helper for satellite orbital tracking,
// satisfying requirements for root-level `/lib/satellite.js` imports.

const satellite = require('satellite.js');

/**
 * Parses a TLE string (containing 2 or 3 lines) and extracts Line 1 and Line 2.
 */
function parseTle(tleStr) {
  const lines = tleStr
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    throw new Error('Invalid TLE format: TLE must contain at least Line 1 and Line 2.');
  }

  if (lines.length >= 3) {
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

  return {
    line1: lines[0],
    line2: lines[1]
  };
}

/**
 * Calculates current look angles (altitude/elevation and azimuth) of a satellite TLE
 * relative to a ground observer location at a given timestamp.
 */
function getLookAngles(tleStr, location, timestamp = new Date()) {
  try {
    const { line1, line2 } = parseTle(tleStr);
    const satrec = satellite.twoline2satrec(line1, line2);
    
    const positionAndVelocity = satellite.propagate(satrec, timestamp);
    const positionEci = positionAndVelocity.position;

    if (!positionEci || typeof positionEci === 'boolean') {
      return null;
    }

    const gmst = satellite.gstime(timestamp);
    const positionEcf = satellite.eciToEcf(positionEci, gmst);

    const observerGd = {
      latitude: satellite.degreesToRadians(location.latitude),
      longitude: satellite.degreesToRadians(location.longitude),
      height: (location.elevationM || 0) / 1000 // height in km
    };

    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    const altitudeDegrees = satellite.radiansToDegrees(lookAngles.elevation);
    const azimuthDegrees = satellite.radiansToDegrees(lookAngles.azimuth);

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
 */
function getLookAnglesIfVisible(tleStr, location, timestamp = new Date()) {
  const angles = getLookAngles(tleStr, location, timestamp);
  if (angles && angles.altitude > 0) {
    return angles;
  }
  return null;
}

module.exports = {
  parseTle,
  getLookAngles,
  getLookAnglesIfVisible
};
