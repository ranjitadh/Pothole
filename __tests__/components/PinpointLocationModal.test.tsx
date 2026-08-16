import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert, Platform, BackHandler } from 'react-native';
import { PinpointLocationModal } from '../../components/PinpointLocationModal';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

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
    (Platform as any).OS = 'ios';

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

    expect(queryByTestId('MapView')).toBeNull();

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

  it('updates coordinates when map is pressed or marker is dragged', async () => {
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
        nativeEvent: { coordinate: { latitude: 27.7011, longitude: 85.3150 } },
      });
    });

    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7011, longitude: 85.3150 });

    await act(async () => {
      fireEvent(getByTestId('Marker'), 'dragEnd', {
        nativeEvent: { coordinate: { latitude: 27.7055, longitude: 85.3111 } },
      });
    });

    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 27.7055, longitude: 85.3111 });
  });

  it('handles locate button press and reverse geocoding fallback', async () => {
    mockGetLastKnownPosition.mockResolvedValue(null);

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

    await act(async () => {
      fireEvent.press(getByText('Locate'));
    });

    expect(mockGetCurrentPosition).toHaveBeenCalled();
  });

  it('renders web fallback text when Platform.OS === web', async () => {
    (Platform as any).OS = 'web';

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

    expect(getByText('Native Maps Unavailable')).toBeTruthy();
  });
});
