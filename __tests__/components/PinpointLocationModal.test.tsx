import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PinpointLocationModal } from '../../components/PinpointLocationModal';

jest.mock('expo-location');
jest.mock('react-native-maps');
jest.mock('lucide-react-native', () => ({
  X: 'X',
  Search: 'Search',
  Locate: 'Locate',
  Maximize2: 'Maximize2',
  MapPin: 'MapPin',
}));

const mockLocation = require('expo-location');

describe('PinpointLocationModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal content when visible is true', () => {
    const { getByText, getByPlaceholderText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={{ latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' }}
      />
    );

    expect(getByText('Pinpoint Location')).toBeTruthy();
    expect(getByPlaceholderText('Search for an address or place...')).toBeTruthy();
    expect(getByText('Confirm Location')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', () => {
    const { getByText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    fireEvent.press(getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onConfirm with coordinates when Confirm Location is pressed', () => {
    const initialLoc = { latitude: 27.6710, longitude: 85.3240, placeName: 'Lalitpur' };
    const { getByText } = render(
      <PinpointLocationModal
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialLocation={initialLoc}
      />
    );

    fireEvent.press(getByText('Confirm Location'));
    expect(mockOnConfirm).toHaveBeenCalledWith({
      latitude: 27.6710,
      longitude: 85.3240,
      placeName: 'Lalitpur',
    });
  });
});
