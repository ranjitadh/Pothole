import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  isValidCoordinate,
  checkAndRequestLocationPermission,
  getCurrentLocation,
  reverseGeocodeCoords,
  getLocationWithAddress,
  LocationErrorCode,
} from '../../services/location';

jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: {
    High: 4,
    Balanced: 3,
    Low: 2,
  },
}));

describe('Location Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('isValidCoordinate', () => {
    it('returns true for valid lat/lng numbers', () => {
      expect(isValidCoordinate(27.7172, 85.3240)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate('27', 85)).toBe(false);
      expect(isValidCoordinate(NaN, 85)).toBe(false);
      expect(isValidCoordinate(27, Infinity)).toBe(false);
    });
  });

  describe('checkAndRequestLocationPermission', () => {
    it('returns unavailable on web', async () => {
      (Platform as any).OS = 'web';
      const result = await checkAndRequestLocationPermission();
      expect(result).toEqual({
        status: 'unavailable',
        reason: 'Location is not supported on web.',
      });
    });

    it('returns unavailable when services are disabled', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('unavailable');
    });

    it('returns unavailable when hasServicesEnabledAsync throws', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockRejectedValue(new Error('service check error'));
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('unavailable');
    });

    it('returns granted when permissions are already granted', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      const result = await checkAndRequestLocationPermission();
      expect(result).toEqual({ status: 'granted' });
    });

    it('returns blocked when getForegroundPermissionsAsync returns canAskAgain=false', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('blocked');
    });

    it('requests permission when getForegroundPermissionsAsync throws', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('err'));
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('granted');
    });

    it('requests permission and returns blocked if result cannot be asked again', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('blocked');
    });

    it('returns denied if request result is denied but can ask again', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      });
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('denied');
    });

    it('returns denied when requestForegroundPermissionsAsync throws', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('req err'));
      const result = await checkAndRequestLocationPermission();
      expect(result.status).toBe('denied');
    });
  });

  describe('getCurrentLocation', () => {
    it('returns cached position if valid', async () => {
      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 27.7172, longitude: 85.3240 },
      });
      const result = await getCurrentLocation();
      expect(result).toEqual({
        ok: true,
        coords: { latitude: 27.7172, longitude: 85.3240 },
      });
    });

    it('falls back to getCurrentPositionAsync if cached is null or throws', async () => {
      (Location.getLastKnownPositionAsync as jest.Mock).mockRejectedValue(new Error('no cache'));
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: { latitude: 27.7000, longitude: 85.3000 },
      });
      const result = await getCurrentLocation();
      expect(result).toEqual({
        ok: true,
        coords: { latitude: 27.7000, longitude: 85.3000 },
      });
    });

    it('cascades through accuracy levels when higher accuracy fails or returns invalid coords', async () => {
      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(null);
      (Location.getCurrentPositionAsync as jest.Mock)
        .mockResolvedValueOnce({ coords: { latitude: 999, longitude: 999 } })
        .mockRejectedValueOnce(new Error('timed out'))
        .mockResolvedValueOnce({ coords: { latitude: 27.7000, longitude: 85.3000 } });

      const result = await getCurrentLocation();
      expect(result).toEqual({
        ok: true,
        coords: { latitude: 27.7000, longitude: 85.3000 },
      });
    });

    it('returns GPS_UNAVAILABLE when all accuracy levels fail', async () => {
      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(null);
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('failed'));
      const result = await getCurrentLocation();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(LocationErrorCode.GPS_UNAVAILABLE);
      }
    });
  });

  describe('reverseGeocodeCoords', () => {
    it('returns formatted address on successful reverse geocode', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        { streetNumber: '123', street: 'Main St', city: 'Kathmandu' },
      ]);
      const result = await reverseGeocodeCoords(27.7172, 85.3240);
      expect(result).toEqual({
        address: '123 Main St Kathmandu',
        resolved: true,
      });
    });

    it('returns fallback string when reverseGeocodeAsync returns empty fields', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        { streetNumber: null, street: null, city: null },
      ]);
      const result = await reverseGeocodeCoords(27.7172, 85.3240);
      expect(result).toEqual({
        address: '27.7172, 85.3240',
        resolved: false,
      });
    });

    it('returns fallback string when reverseGeocodeAsync throws or times out', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(new Error('Network error'));
      const result = await reverseGeocodeCoords(27.7172, 85.3240);
      expect(result).toEqual({
        address: '27.7172, 85.3240',
        resolved: false,
      });
    });
  });

  describe('getLocationWithAddress', () => {
    it('returns failure when permission stage fails', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);
      const result = await getLocationWithAddress();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(LocationErrorCode.SERVICES_DISABLED);
      }
    });

    it('returns failure when GPS stage fails', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(null);
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('GPS Error'));

      const result = await getLocationWithAddress();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(LocationErrorCode.GPS_UNAVAILABLE);
      }
    });

    it('returns success with resolved address when pipeline succeeds', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 27.7172, longitude: 85.3240 },
      });
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        { streetNumber: '10', street: 'Durbar Marg', city: 'Kathmandu' },
      ]);

      const result = await getLocationWithAddress();
      expect(result).toEqual({
        ok: true,
        coords: { latitude: 27.7172, longitude: 85.3240 },
        address: '10 Durbar Marg Kathmandu',
        addressResolved: true,
      });
    });
  });
});
