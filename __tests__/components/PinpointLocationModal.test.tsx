import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PinpointLocationModal } from '../../components/PinpointLocationModal';

// Mock safety contexts
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

// Mock Lucide icons as React Native text elements for easy queries in tests
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    X: (props: any) => React.createElement(Text, props, 'X'),
    Search: (props: any) => React.createElement(Text, props, 'Search'),
    Locate: (props: any) => React.createElement(Text, props, 'Locate'),
    Maximize2: (props: any) => React.createElement(Text, props, 'Maximize2'),
    MapPin: (props: any) => React.createElement(Text, props, 'MapPin'),
    AlertTriangle: (props: any) => React.createElement(Text, props, 'AlertTriangle'),
  };
});

// Configure explicit mock spies for expo-location
const mockRequestForegroundPermissions = jest.fn();
const mockGetLastKnownPosition = jest.fn();
const mockGetCurrentPosition = jest.fn();
const mockReverseGeocode = jest.fn();
const mockGeocode = jest.fn();
const mockHasServicesEnabled = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: any[]) => mockRequestForegroundPermissions(...args),
  getLastKnownPositionAsync: (...args: any[]) => mockGetLastKnownPosition(...args),
  getCurrentPositionAsync: (...args: any[]) => mockGetCurrentPosition(...args),
  reverseGeocodeAsync: (...args: any[]) => mockReverseGeocode(...args),
  geocodeAsync: (...args: any[]) => mockGeocode(...args),
  hasServicesEnabledAsync: (...args: any[]) => mockHasServicesEnabled(...args),
  Accuracy: {
    High: 4,
    Balanced: 3,
    Low: 2,
  },
}));

// Configure explicit mock spy for react-native-maps
const mockAnimateToRegion = jest.fn();

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  class MockMapView extends React.Component<any> {
    animateToRegion = mockAnimateToRegion;
    componentDidMount() {
      if (this.props.onMapReady) {
        this.props.onMapReady();
      }
    }
    render() {
      const { children, ...props } = this.props;
      return React.createElement(View, { ...props, testID: 'MapView' }, children);
    }
  }

  const MockMarker = (props: any) => React.createElement(View, { ...props, testID: 'Marker' });

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
  };
});

describe('PinpointLocationModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Default mock returns to prevent warnings and unhandled promises
    mockHasServicesEnabled.mockResolvedValue(true);
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPosition.mockResolvedValue({
      coords: { latitude: 27.6710, longitude: 85.3240 },
    });
    mockGetCurrentPosition.mockResolvedValue({
      coords: { latitude: 27.6710, longitude: 85.3240 },
    });
    mockReverseGeocode.mockResolvedValue([
      { streetNumber: '123', street: 'Test St', city: 'Kathmandu' }
    ]);
    mockGeocode.mockResolvedValue([
      { latitude: 27.7172, longitude: 85.3240 }
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders modal content and triggers deferred map mount timer', async () => {
    const { getByText, getByPlaceholderText, queryByTestId } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={{ latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' }}
      />
    );

    // Prior to timer, MapView should not be mounted (protects newArch fabric layouts)
    expect(queryByTestId('MapView')).toBeNull();

    // Advance timers past the 50ms deferred layout mount point
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(getByText('Pinpoint Location')).toBeTruthy();
    expect(getByPlaceholderText('Search for an address or place...')).toBeTruthy();
    expect(getByText('Confirm Location')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
    expect(queryByTestId('MapView')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const { getByText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    fireEvent.press(getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onConfirm with coordinates when Confirm Location is pressed', async () => {
    const initialLoc = { latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' };
    const { getByText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={initialLoc}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    fireEvent.press(getByText('Confirm Location'));
    expect(mockOnConfirm).toHaveBeenCalledWith({
      latitude: 27.6710,
      longitude: 85.3240,
      placeName: 'Lalitpur',
    });
  });

  it('requests location permissions and fetches current position if initialLocation is null', async () => {
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPosition.mockResolvedValue({
      coords: { latitude: 27.7172, longitude: 85.3240 }
    });
    mockReverseGeocode.mockResolvedValue([
      { streetNumber: '123', street: 'Main St', city: 'Kathmandu' }
    ]);

    const { getByPlaceholderText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(mockRequestForegroundPermissions).toHaveBeenCalled();
    expect(mockGetLastKnownPosition).toHaveBeenCalled();
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7172, longitude: 85.3240 });
    
    // Address matches formatting: [streetNumber, street, city || subregion || district]
    expect(getByPlaceholderText('Search for an address or place...').props.value).toBe('123 Main St Kathmandu');
  });

  it('alerts the user when location permission is blocked', async () => {
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(mockRequestForegroundPermissions).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Location Permission Blocked',
      expect.stringContaining('permanently denied'),
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('searches for an address, moves marker, and calls reverse geocoding', async () => {
    mockGeocode.mockResolvedValue([{ latitude: 27.7000, longitude: 85.3200 }]);
    mockReverseGeocode.mockResolvedValue([{ streetNumber: '456', street: 'New Road', city: 'Kathmandu' }]);

    const { getByPlaceholderText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={{ latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' }}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    const searchInput = getByPlaceholderText('Search for an address or place...');
    
    await act(async () => {
      fireEvent.changeText(searchInput, 'New Road Kathmandu');
    });

    await act(async () => {
      fireEvent(searchInput, 'submitEditing');
    });

    expect(mockGeocode).toHaveBeenCalledWith('New Road Kathmandu');
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 27.7000, longitude: 85.3200 }),
      500
    );
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7000, longitude: 85.3200 });
  });

  it('updates coordinates and reverse geocodes when map is pressed', async () => {
    const { getByTestId } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={{ latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' }}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    await act(async () => {
      fireEvent(getByTestId('MapView'), 'press', {
        nativeEvent: {
          coordinate: { latitude: 27.7011, longitude: 85.3150 },
        },
      });
    });

    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7011, longitude: 85.3150 });
  });

  it('updates coordinates and reverse geocodes when marker is dragged', async () => {
    const { getByTestId } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={{ latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' }}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    await act(async () => {
      fireEvent(getByTestId('Marker'), 'dragEnd', {
        nativeEvent: {
          coordinate: { latitude: 27.7055, longitude: 85.3111 },
        },
      });
    });

    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7055, longitude: 85.3111 });
  });

  it('requests current location when Locate button is pressed', async () => {
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPosition.mockResolvedValue(null);
    mockGetCurrentPosition.mockResolvedValue({
      coords: { latitude: 27.7007, longitude: 85.3001 }
    });
    mockReverseGeocode.mockResolvedValue([
      { street: 'Locate Road', city: 'Kathmandu' }
    ]);

    const { getByText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={{ latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' }}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    // Clear initial calls on component mount
    mockRequestForegroundPermissions.mockClear();
    mockGetLastKnownPosition.mockClear();
    mockGetCurrentPosition.mockClear();
    mockReverseGeocode.mockClear();

    await act(async () => {
      fireEvent.press(getByText('Locate'));
    });

    expect(mockRequestForegroundPermissions).toHaveBeenCalled();
    expect(mockGetLastKnownPosition).toHaveBeenCalled();
    expect(mockGetCurrentPosition).toHaveBeenCalled();
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7007, longitude: 85.3001 });
  });
});
