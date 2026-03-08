import proj4 from 'proj4';

// Alabama State Plane East, NAD83, US Survey Feet (EPSG:2895 / ESRI 102629)
const AL_STATE_PLANE_EAST = '+proj=tmerc +lat_0=30.5 +lon_0=-85.83333333333333 +k=0.99996 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs';
const WGS84 = 'EPSG:4326';

proj4.defs('EPSG:2895', AL_STATE_PLANE_EAST);

/**
 * Convert Alabama State Plane East coordinates to WGS84
 * CRITICAL: CSV columns are mislabelled:
 *   - "Lat" column contains EASTING (X) values
 *   - "Long" column contains NORTHING (Y) values
 * 
 * @param {number} csvLat - Value from CSV "Lat" column (actually easting/X)
 * @param {number} csvLong - Value from CSV "Long" column (actually northing/Y)
 * @returns {{ lat: number, lng: number }} WGS84 coordinates
 */
export function convertToWGS84(csvLat, csvLong) {
  const easting = parseFloat(csvLat);   // "Lat" = X (easting)
  const northing = parseFloat(csvLong); // "Long" = Y (northing)

  if (isNaN(easting) || isNaN(northing)) return null;

  // proj4 expects [X, Y] = [easting, northing]
  const [lng, lat] = proj4('EPSG:2895', WGS84, [easting, northing]);

  return { lat, lng };
}

/**
 * Detect if values are in State Plane (large numbers) or already WGS84
 */
export function detectProjection(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (Math.abs(numLat) > 1000 || Math.abs(numLng) > 1000) {
    return 'state_plane';
  }
  return 'wgs84';
}
