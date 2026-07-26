import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet, Platform, Keyboard, Alert, Dimensions, BackHandler } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, Locate, Maximize2, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.warn('[PinpointLocation] MapErrorBoundary caught:', error.message); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' }}>
          <MapPin size={32} color="#ea580c" />
          <Text style={{ color: '#64748b', fontWeight: '600', textAlign: 'center', marginTop: 8 }}>Map unavailable</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4 }}>Use the search bar or locate button to set your location.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

interface PinpointLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: { latitude: number; longitude: number; placeName?: string }) => void;
  initialLocation?: { latitude: number; longitude: number; placeName?: string } | null;
}

const DEFAULT_COORDS = { latitude: 27.6710, longitude: 85.3240 };
const DEFAULT_REGION = { ...DEFAULT_COORDS, latitudeDelta: 0.008, longitudeDelta: 0.008 };

export function PinpointLocationModal({ visible, onClose, onConfirm, initialLocation }: PinpointLocationModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const mountedRef = useRef(true);
  const insets = useSafeAreaInsets();
  const [mapReady, setMapReady] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [markerCoords, setMarkerCoords] = useState(DEFAULT_COORDS);
  const [placeName, setPlaceName] = useState('');
  const [region, setRegion] = useState(DEFAULT_REGION);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => handler.remove();
  }, [visible, onClose]);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  useEffect(() => {
    if (!visible) {
      setMapReady(false);
      return;
    }

    if (initialLocation?.latitude != null && initialLocation?.longitude != null) {
      const coords = { latitude: initialLocation.latitude, longitude: initialLocation.longitude };
      const newRegion = { ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
      safeSet(setMarkerCoords, coords);
      safeSet(setPlaceName, initialLocation.placeName || '');
      safeSet(setSearchText, initialLocation.placeName || '');
      safeSet(setRegion, newRegion);
    } else {
      handleGetCurrentLocation();
    }
  }, [visible]);

  const handleGetCurrentLocation = useCallback(async () => {
    safeSet(setIsLocating, true);
    try {
      let status = 'granted';
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        status = perm.status;
      } catch {
        status = 'denied';
      }

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to pinpoint your location. Please enable it in Settings.');
        return;
      }

      let current: Location.LocationObject | null = null;
      try {
        current = await Location.getLastKnownPositionAsync();
      } catch {
        current = null;
      }

      if (!current) {
        try {
          current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch {
          current = null;
        }
      }

      if (current?.coords) {
        const lat = current.coords.latitude;
        const lng = current.coords.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          Alert.alert('Location Error', 'Received invalid coordinates. Please try again.');
          return;
        }
        const coords = { latitude: lat, longitude: lng };
        const newRegion = { ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
        safeSet(setMarkerCoords, coords);
        safeSet(setRegion, newRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 500);
        }
        await reverseGeocode(lat, lng);
      } else {
        Alert.alert('Location Error', 'Could not retrieve coordinates. Please try searching for an address or check your GPS settings.');
      }
    } catch (err: any) {
      console.warn('[PinpointLocation] getCurrentLocation error:', err?.message || err);
      Alert.alert('Location Error', 'Error fetching position: ' + (err?.message || 'Unknown error'));
    } finally {
      safeSet(setIsLocating, false);
    }
  }, [safeSet]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    safeSet(setIsGeocoding, true);
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode && geocode.length > 0) {
        const address = geocode[0];
        const name = [
          address.streetNumber,
          address.street,
          address.city || address.subregion || address.district,
        ].filter(Boolean).join(' ').trim();

        const formattedAddress = name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        safeSet(setPlaceName, formattedAddress);
        safeSet(setSearchText, formattedAddress);
      } else {
        const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        safeSet(setPlaceName, fallback);
        safeSet(setSearchText, fallback);
      }
    } catch {
      const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      safeSet(setPlaceName, fallback);
      safeSet(setSearchText, fallback);
    } finally {
      safeSet(setIsGeocoding, false);
    }
  }, [safeSet]);

  const handleSearch = useCallback(async () => {
    const query = searchText.trim();
    if (!query) return;
    safeSet(setIsSearching, true);
    Keyboard.dismiss();
    try {
      const results = await Location.geocodeAsync(query);
      if (results && results.length > 0) {
        const result = results[0];
        const lat = result.latitude;
        const lng = result.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          Alert.alert('Error', 'Received invalid coordinates for this address.');
          return;
        }
        const coords = { latitude: lat, longitude: lng };
        const newRegion = { ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
        safeSet(setMarkerCoords, coords);
        safeSet(setRegion, newRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 500);
        }
        await reverseGeocode(lat, lng);
      } else {
        Alert.alert('Not Found', 'Address not found. Please try a different query.');
      }
    } catch (err: any) {
      Alert.alert('Search Error', 'Error searching address: ' + (err?.message || 'Unknown error'));
    } finally {
      safeSet(setIsSearching, false);
    }
  }, [searchText, safeSet, reverseGeocode]);

  const handleMapPress = useCallback((e: any) => {
    const coords = e?.nativeEvent?.coordinate;
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') return;
    safeSet(setMarkerCoords, coords);
    reverseGeocode(coords.latitude, coords.longitude);
  }, [safeSet, reverseGeocode]);

  const handleMarkerDragEnd = useCallback((e: any) => {
    const coords = e?.nativeEvent?.coordinate;
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') return;
    safeSet(setMarkerCoords, coords);
    reverseGeocode(coords.latitude, coords.longitude);
  }, [safeSet, reverseGeocode]);

  const handleConfirm = useCallback(() => {
    onConfirm({
      latitude: markerCoords.latitude,
      longitude: markerCoords.longitude,
      placeName: placeName || undefined,
    });
    onClose();
  }, [markerCoords, placeName, onConfirm, onClose]);

  const handleMapReady = useCallback(() => {
    safeSet(setMapReady, true);
  }, [safeSet]);

  if (!visible) return null;

  const screenHeight = Dimensions.get('window').height;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.modalCard, {
        maxHeight: screenHeight * 0.85,
        marginTop: insets.top + 8,
        marginBottom: insets.bottom + 8,
      }]}
        onStartShouldSetResponder={() => true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <MapPin size={18} color="#ea580c" />
            <Text style={styles.headerTitle}>Pinpoint Location</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchWrapper}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for an address or place..."
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#ea580c" />
            ) : (
              <TouchableOpacity onPress={handleGetCurrentLocation} disabled={isLocating} style={styles.locateButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {isLocating ? (
                  <ActivityIndicator size="small" color="#ea580c" />
                ) : (
                  <Locate size={16} color="#64748b" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Map view */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.webFallbackContainer}>
              <Text style={styles.webFallbackTitle}>Native Maps Unavailable</Text>
              <Text style={styles.webFallbackSubtitle}>Pinpoint map is optimized for iOS and Android.</Text>
            </View>
          ) : (
            <MapErrorBoundary>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={DEFAULT_REGION}
                region={region}
                onMapReady={handleMapReady}
                onPress={handleMapPress}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsTraffic={false}
                loadingEnabled
                loadingBackgroundColor="#f8fafc"
              >
                <Marker
                  coordinate={markerCoords}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                  pinColor="#ea580c"
                />
              </MapView>
              <TouchableOpacity
                style={styles.maximizeButton}
                onPress={() => {
                  if (mapRef.current) {
                    mapRef.current.animateToRegion({
                      ...markerCoords,
                      latitudeDelta: 0.004,
                      longitudeDelta: 0.004,
                    }, 500);
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Maximize2 size={16} color="#64748b" />
              </TouchableOpacity>
            </MapErrorBoundary>
          )}

          {isGeocoding && (
            <View style={styles.geocodingToast}>
              <ActivityIndicator size="small" color="#ea580c" />
              <Text style={styles.geocodingToastText}>Getting address...</Text>
            </View>
          )}
        </View>

        {/* Instruction */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            Search above, tap the map, or drag the red pin to select your location.
          </Text>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    flexDirection: 'column',
    zIndex: 1,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    marginLeft: 8,
    paddingVertical: 4,
  },
  locateButton: {
    padding: 4,
  },
  mapContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#f8fafc',
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  webFallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  webFallbackTitle: {
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  webFallbackSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  maximizeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  geocodingToast: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  geocodingToastText: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  instructionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  instructionText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
