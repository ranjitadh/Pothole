import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import CreateScreen from '../../../app/(tabs)/create';
import { Alert, Text } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

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
  uploadPhoto: jest.fn().mockImplementation((uri: string) => Promise.resolve(`https://example.com/uploaded-${uri.split('/').pop()}`)),
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
  Accuracy: { High: 4, Balanced: 3, Low: 2 },
}));

jest.mock('base-64', () => ({ decode: jest.fn(() => '') }));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = (props: any) => React.createElement(View, props);
  const MockMarker = (props: any) => React.createElement(View, props);
  return { __esModule: true, default: MockMapView, Marker: MockMarker };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Camera: () => React.createElement(Text, null, 'Camera'),
    Image: () => React.createElement(Text, null, 'ImageIcon'),
    MapPin: () => React.createElement(Text, null, 'MapPin'),
    X: () => React.createElement(Text, null, 'X'),
    Search: () => React.createElement(Text, null, 'Search'),
    Locate: () => React.createElement(Text, null, 'Locate'),
    Maximize2: () => React.createElement(Text, null, 'Maximize2'),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import { createPost, uploadPhoto } from '../../../services/post';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

const mockCreatePost = createPost as jest.Mock;
const mockUploadPhoto = uploadPhoto as jest.Mock;
const mockImagePicker = ImagePicker as any;
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

  it('launches camera and attaches photo', async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo1.jpg' }],
    });

    const { getByText } = render(<CreateScreen />);

    const cameraBtn = getByText('Camera');
    await act(async () => {
      fireEvent.press(cameraBtn);
    });

    expect(mockImagePicker.launchCameraAsync).toHaveBeenCalled();
  });

  it('launches photo library and attaches selected images', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo2.jpg' }],
    });

    const { getByText } = render(<CreateScreen />);

    const libraryBtn = getByText('ImageIcon');
    await act(async () => {
      fireEvent.press(libraryBtn);
    });

    expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('submits post with text and uploaded image', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///pothole.jpg' }],
    });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    });

    const { getByPlaceholderText, getByText } = render(<CreateScreen />);

    fireEvent.changeText(getByPlaceholderText('Describe the pothole or hazard...'), 'Pothole alert');

    const libraryBtn = getByText('ImageIcon');
    await act(async () => {
      fireEvent.press(libraryBtn);
    });

    await act(async () => {
      fireEvent.press(getByText('Post'));
    });

    expect(mockUploadPhoto).toHaveBeenCalledWith('file:///pothole.jpg');
    expect(mockCreatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Pothole alert',
        visibility: 'public',
        media: [{ url: 'https://example.com/uploaded-pothole.jpg', type: 'image' }],
      })
    );

    alertSpy.mockRestore();
  });
});
