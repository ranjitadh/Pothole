/**
 * services/location.ts
 *
 * Production-safe location service for the Pothole app.
 *
 * Responsibilities:
 *  - OS permission check & request
 *  - GPS position acquisition with accuracy cascade (HIGH → BALANCED → LOW)
 *  - 15-second per-attempt timeout (prevents hanging on prod devices)
 *  - Reverse geocoding with 10-second timeout + coordinate fallback
 *
 * Error handling philosophy:
 *  - Every public function returns a typed result union — never throws.
 *  - Failure codes are granular so the UI can show the right message and
 *    log exactly which stage failed in production.
 *
 * NOTE: reverseGeocodeAsync calls Google's Geocoding API on Android.
 * For this to work in production the API key (com.google.android.geo.API_KEY
 * in the manifest) must have the Geocoding API enabled in Google Cloud Console
 * and an Android app restriction matching the Play Store signing certificate SHA-1.
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocationPermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

/** Granular error codes — one per failure stage. */
export enum LocationErrorCode {
  SERVICES_DISABLED = 'SERVICES_DISABLED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PERMISSION_BLOCKED = 'PERMISSION_BLOCKED', // permanently denied, needs settings
  GPS_TIMEOUT = 'GPS_TIMEOUT',
  GPS_UNAVAILABLE = 'GPS_UNAVAILABLE',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  GEOCODE_FAILED = 'GEOCODE_FAILED',
  GEOCODE_TIMEOUT = 'GEOCODE_TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationSuccess {
  ok: true;
  coords: LocationCoords;
  /** Human-readable address, or "lat, lng" fallback if geocoding fails. */
  address: string;
  /** true if address came from reverse geocoding, false if it's the coord fallback */
  addressResolved: boolean;
}

export interface LocationFailure {
  ok: false;
  code: LocationErrorCode;
  /** Human-readable message for the UI */
  message: string;
  /** Raw error for logging */
  raw?: unknown;
}

export type LocationResult = LocationSuccess | LocationFailure;

// ── Constants ─────────────────────────────────────────────────────────────────

const GPS_TIMEOUT_MS = 15_000;
const GEOCODE_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 60_000; // 1 minute

/** Accuracy levels tried in order. Stops at first success. */
const ACCURACY_CASCADE: Location.Accuracy[] = [
  Location.Accuracy.High,
  Location.Accuracy.Balanced,
  Location.Accuracy.Low,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

function coordinateString(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function fail(code: LocationErrorCode, message: string, raw?: unknown): LocationFailure {
  // Always log to console so failures are visible in production crash/log tools.
  console.warn(`[Location] ${code}: ${message}`, raw ?? '');
  return { ok: false, code, message, raw };
}

function makeTimeout(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
}

// ── Permission ────────────────────────────────────────────────────────────────

/**
 * Checks whether location services are on and foreground permission is granted.
 * Requests permission if undetermined. Returns a typed status — never throws.
 */
export async function checkAndRequestLocationPermission(): Promise<
  { status: 'granted' } | { status: 'denied' | 'blocked' | 'unavailable'; reason: string }
> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', reason: 'Location is not supported on web.' };
  }

  // 1. Check if GPS hardware/service is enabled on the device.
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        status: 'unavailable',
        reason: 'GPS is disabled. Please enable Location Services in System Settings.',
      };
    }
  } catch (e) {
    return { status: 'unavailable', reason: 'Could not check location services.', };
  }

  // 2. Check current permission state before prompting.
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === 'granted') return { status: 'granted' };

    // canAskAgain=false means the user permanently denied — sending them to Settings
    // is the only option.
    if (!existing.canAskAgain) {
      return {
        status: 'blocked',
        reason:
          'Location permission was permanently denied. Please enable it in Settings → Apps → Pothole → Permissions.',
      };
    }
  } catch {
    // Fall through and try requesting.
  }

  // 3. Request permission.
  try {
    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status === 'granted') return { status: 'granted' };

    if (!result.canAskAgain) {
      return {
        status: 'blocked',
        reason:
          'Location permission was permanently denied. Please enable it in Settings → Apps → Pothole → Permissions.',
      };
    }

    return {
      status: 'denied',
      reason: 'Location permission is required to pinpoint your location.',
    };
  } catch (e) {
    return {
      status: 'denied',
      reason: 'Failed to request location permission.',
    };
  }
}

// ── GPS acquisition ───────────────────────────────────────────────────────────

/**
 * Acquires the current GPS position.
 *
 * Strategy:
 *  1. getLastKnownPositionAsync — fast, no GPS spin-up (max age: 1 min)
 *  2. getCurrentPositionAsync(HIGH) with 15s timeout
 *  3. getCurrentPositionAsync(BALANCED) with 15s timeout
 *  4. getCurrentPositionAsync(LOW) with 15s timeout
 *
 * Returns the first successful result. Returns a failure if all attempts fail.
 * Does NOT check permissions — call checkAndRequestLocationPermission() first.
 */
export async function getCurrentLocation(): Promise<
  { ok: true; coords: LocationCoords } | LocationFailure
> {
  // Try cached last-known position first (instant, no battery drain).
  try {
    const cached = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (cached?.coords) {
      const { latitude, longitude } = cached.coords;
      if (isValidCoordinate(latitude, longitude)) {
        console.log(`[Location] Used cached position: ${coordinateString(latitude, longitude)}`);
        return { ok: true, coords: { latitude, longitude } };
      }
    }
  } catch (e) {
    console.warn('[Location] getLastKnownPositionAsync failed:', e);
  }

  // Accuracy cascade with per-attempt timeout.
  for (const accuracy of ACCURACY_CASCADE) {
    const label = `getCurrentPositionAsync(accuracy=${accuracy})`;
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy }),
        makeTimeout(GPS_TIMEOUT_MS, label),
      ]);

      if (position?.coords) {
        const { latitude, longitude } = position.coords;
        if (isValidCoordinate(latitude, longitude)) {
          console.log(`[Location] GPS fix at accuracy=${accuracy}: ${coordinateString(latitude, longitude)}`);
          return { ok: true, coords: { latitude, longitude } };
        } else {
          console.warn(`[Location] ${label} returned invalid coords`, position.coords);
        }
      }
    } catch (e: any) {
      const isTimeout = e?.message?.includes('timed out');
      console.warn(`[Location] ${label} ${isTimeout ? 'timed out' : 'failed'}:`, e?.message ?? e);
      // Continue to next accuracy level.
    }
  }

  return fail(
    LocationErrorCode.GPS_UNAVAILABLE,
    'Could not obtain your location. Please ensure GPS is enabled and try again.',
  );
}

// ── Reverse geocoding ─────────────────────────────────────────────────────────

/**
 * Converts coordinates to a human-readable address string.
 *
 * On Android, this calls Google's Geocoding API using the API key baked into
 * the manifest. Requires:
 *   - Geocoding API enabled in Google Cloud Console
 *   - Android app restriction on the key including the Play Store SHA-1
 *
 * Always returns a string — falls back to "lat, lng" format on any failure.
 */
export async function reverseGeocodeCoords(
  lat: number,
  lng: number,
): Promise<{ address: string; resolved: boolean }> {
  const fallback = coordinateString(lat, lng);

  try {
    const results = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
      makeTimeout(GEOCODE_TIMEOUT_MS, 'reverseGeocodeAsync'),
    ]);

    if (results && results.length > 0) {
      const a = results[0];
      const parts = [
        a.streetNumber,
        a.street,
        a.city || a.subregion || a.district,
      ].filter(Boolean);

      if (parts.length > 0) {
        const address = parts.join(' ').trim();
        console.log(`[Location] Geocoded (${fallback}) → "${address}"`);
        return { address, resolved: true };
      }
    }

    // API returned results but all fields were empty — use coordinates.
    console.warn('[Location] reverseGeocodeAsync returned empty address fields. Using coordinates fallback.');
    return { address: fallback, resolved: false };
  } catch (e: any) {
    // This typically means:
    //  - Geocoding API not enabled in Google Cloud Console, OR
    //  - API key restricted and Play Store SHA-1 not added
    console.warn(
      '[Location] reverseGeocodeAsync failed — check that Geocoding API is enabled in Google Cloud Console ' +
        'and the API key Android restriction includes the Play Store certificate SHA-1.',
      e?.message ?? e,
    );
    return { address: fallback, resolved: false };
  }
}

// ── Combined helper ───────────────────────────────────────────────────────────

/**
 * Full pipeline: permission check → GPS acquisition → reverse geocoding.
 * Returns a single typed result — the caller doesn't need to orchestrate stages.
 */
export async function getLocationWithAddress(): Promise<LocationResult> {
  // Stage 1: Permission
  const perm = await checkAndRequestLocationPermission();
  if (perm.status !== 'granted') {
    const code =
      perm.status === 'blocked'
        ? LocationErrorCode.PERMISSION_BLOCKED
        : perm.status === 'unavailable'
        ? LocationErrorCode.SERVICES_DISABLED
        : LocationErrorCode.PERMISSION_DENIED;
    return fail(code, perm.reason);
  }

  // Stage 2: GPS
  const gps = await getCurrentLocation();
  if (!gps.ok) return gps;

  // Stage 3: Geocoding (non-fatal — fallback to coordinates)
  const { address, resolved } = await reverseGeocodeCoords(
    gps.coords.latitude,
    gps.coords.longitude,
  );

  return {
    ok: true,
    coords: gps.coords,
    address,
    addressResolved: resolved,
  };
}
