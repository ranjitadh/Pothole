import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import CreateScreen from '../../../app/(tabs)/create';
import { Alert } from 'react-native';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
      }),
    },
  },
}));
jest.mock('../../../services/post', () => ({
  createPost: jest.fn().mockResolvedValue({ id: 'new-post' }),
}));
jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 27.7172, longitude: 85.324 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([
    { streetNumber: '123', street: 'Main St', city: 'Kathmandu', subregion: 'Bagmati' },
  ]),
}));
jest.mock('base-64', () => ({ decode: jest.fn(() => '') }));
jest.mock('lucide-react-native', () => ({
  Camera: 'Camera',
  Image: 'Image',
  MapPin: 'MapPin',
  X: 'X',
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import { createPost } from '../../../services/post';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

const mockCreatePost = createPost as jest.Mock;
const mockImagePicker = ImagePicker as any;
const mockLocation = Location as any;
const mockRouter = useRouter as jest.Mock;

describe('Create Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    });
  });

  it('renders correctly with all UI elements', () => {
    const { getByText, getByPlaceholderText } = render(<CreateScreen />);

    expect(getByText('Report Road Hazard')).toBeTruthy();
    expect(getByPlaceholderText('Describe the pothole or hazard...')).toBeTruthy();
    expect(getByText('Post')).toBeTruthy();
  });

  it('allows typing a description', () => {
    const { getByPlaceholderText } = render(<CreateScreen />);
    const textInput = getByPlaceholderText('Describe the pothole or hazard...');

    fireEvent.changeText(textInput, 'Large pothole on Ring Road');

    expect(textInput.props.value).toBe('Large pothole on Ring Road');
  });

  it('shows error when submitting without text or image', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<CreateScreen />);

    await act(async () => {
      fireEvent.press(getByText('Post'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please write a description or attach a photo.');
    alertSpy.mockRestore();
  });

  it('calls createPost when submitting with text', async () => {
    mockCreatePost.mockResolvedValue({ id: 'new-post' });

    const { getByPlaceholderText, getByText } = render(<CreateScreen />);

    fireEvent.changeText(getByPlaceholderText('Describe the pothole or hazard...'), 'New pothole');

    await act(async () => {
      fireEvent.press(getByText('Post'));
    });

    expect(mockCreatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'New pothole',
        visibility: 'public',
      })
    );
  });

  it('requests camera permission on camera button press', async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg' }],
    });

    const { getByPlaceholderText } = render(<CreateScreen />);
    expect(getByPlaceholderText('Describe the pothole or hazard...')).toBeTruthy();
  });

  it('requests location permission on location button press', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 27.7172, longitude: 85.324 },
    });
    mockLocation.reverseGeocodeAsync.mockResolvedValue([
      { streetNumber: '123', street: 'Main St', city: 'Kathmandu', subregion: 'Bagmati' },
    ]);

    const { getByText } = render(<CreateScreen />);
    expect(getByText('Report Road Hazard')).toBeTruthy();
  });

  it('shows success alert after successful post', async () => {
    mockCreatePost.mockResolvedValue({ id: 'new-post' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByPlaceholderText, getByText } = render(<CreateScreen />);

    fireEvent.changeText(getByPlaceholderText('Describe the pothole or hazard...'), 'Test post');

    await act(async () => {
      fireEvent.press(getByText('Post'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Hazard report posted successfully!',
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('shows error alert on post failure', async () => {
    mockCreatePost.mockRejectedValue(new Error('Upload failed'));

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = render(<CreateScreen />);

    fireEvent.changeText(getByPlaceholderText('Describe the pothole or hazard...'), 'Test post');

    await act(async () => {
      fireEvent.press(getByText('Post'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Failed to Post', 'Upload failed');
    alertSpy.mockRestore();
  });
});
