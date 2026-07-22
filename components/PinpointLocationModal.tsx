import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Keyboard, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { X, Search, Locate, Maximize2, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

interface PinpointLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: { latitude: number; longitude: number; placeName?: string }) => void;
  initialLocation?: { latitude: number; longitude: number; placeName?: string } | null;
}

export function PinpointLocationModal({ visible, onClose, onConfirm, initialLocation }: PinpointLocationModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Default coordinate: Kathmandu fallback (Lalitpur/Kathmandu center)
  const defaultCoords = {
    latitude: 27.6710,
    longitude: 85.3240,
  };

  const [markerCoords, setMarkerCoords] = useState(defaultCoords);
  const [placeName, setPlaceName] = useState('');

  // Map Region State
  const [region, setRegion] = useState({
    latitude: defaultCoords.latitude,
    longitude: defaultCoords.longitude,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });

  // When modal becomes visible, initialize coordinates
  useEffect(() => {
    if (visible) {
      if (initialLocation) {
        const coords = {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
        };
        setMarkerCoords(coords);
        setPlaceName(initialLocation.placeName || '');
        setSearchText(initialLocation.placeName || '');
        const newRegion = {
          ...coords,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(newRegion);
        // Animate map if already rendered
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 500);
        }
      } else {
        // Fetch current coordinates automatically
        handleGetCurrentLocation();
      }
    }
  }, [visible]);

  const handleGetCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to pinpoint your location.');
        return;
      }

      // Try last known cached position first (extremely fast and reliable fallback)
      let current = await Location.getLastKnownPositionAsync({});
      
      if (!current) {
        // Fallback to getting current position with balanced accuracy
        current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (current) {
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setMarkerCoords(coords);
        const newRegion = {
          ...coords,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(newRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 500);
        }
        await reverseGeocode(coords.latitude, coords.longitude);
      } else {
        Alert.alert('Location Error', 'Could not retrieve coordinates. Please try searching for an address or check your GPS settings.');
      }
    } catch (err: any) {
      console.warn('Could not fetch current coordinates:', err);
      Alert.alert('Location Error', 'Error fetching position: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLocating(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
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
        setPlaceName(formattedAddress);
        setSearchText(formattedAddress);
      } else {
        const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setPlaceName(fallback);
        setSearchText(fallback);
      }
    } catch (err) {
      const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setPlaceName(fallback);
      setSearchText(fallback);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setIsSearching(true);
    Keyboard.dismiss();
    try {
      const results = await Location.geocodeAsync(searchText);
      if (results && results.length > 0) {
        const result = results[0];
        const coords = {
          latitude: result.latitude,
          longitude: result.longitude,
        };
        setMarkerCoords(coords);
        const newRegion = {
          ...coords,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(newRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 500);
        }
        await reverseGeocode(coords.latitude, coords.longitude);
      } else {
        alert('Address not found. Please try a different query.');
      }
    } catch (err: any) {
      alert('Error searching address: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapPress = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    setMarkerCoords(coords);
    reverseGeocode(coords.latitude, coords.longitude);
  };

  const handleMarkerDragEnd = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    setMarkerCoords(coords);
    reverseGeocode(coords.latitude, coords.longitude);
  };

  const handleConfirm = () => {
    onConfirm({
      latitude: markerCoords.latitude,
      longitude: markerCoords.longitude,
      placeName: placeName || undefined,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <MapPin size={18} color="#ea580c" />
              <Text style={styles.headerTitle}>Pinpoint Location</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#ea580c" />
              ) : (
                <TouchableOpacity onPress={handleGetCurrentLocation} disabled={isLocating} style={styles.locateButton}>
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
                <Text style={styles.webFallbackSubtitle}>Pinpoint map is optimized for iOS and Android emulator runtimes.</Text>
              </View>
            ) : (
              <>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={region}
                  onPress={handleMapPress}
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
                >
                  <Maximize2 size={16} color="#64748b" />
                </TouchableOpacity>
              </>
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
              You can search for an address above, click on the map, or drag the red pin to select your location.
            </Text>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={styles.confirmBtn}
            >
              <Text style={styles.confirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    flexDirection: 'column',
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
    flex: 1,
    minHeight: 300,
    backgroundColor: '#f8fafc',
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
    absolute: 'absolute',
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
