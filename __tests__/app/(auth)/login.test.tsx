import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import LoginScreen from '../../../app/(auth)/login';
import { Alert } from 'react-native';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: '1' } }, error: null }),
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: null }, error: null }),
      setSession: jest.fn().mockResolvedValue({ data: {}, error: null }),
      exchangeCodeForSession: jest.fn().mockResolvedValue({ data: {}, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));
jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'cancel', url: '' }),
  maybeCompleteAuthSession: jest.fn(),
  dismissBrowser: jest.fn(),
}));
jest.mock('expo-linking', () => ({
  createURL: jest.fn().mockReturnValue('pothole://'),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));
jest.mock('expo-constants', () => ({
  default: { appOwnership: 'standalone', expoConfig: { hostUri: 'localhost:8081' } },
}));
jest.mock('lucide-react-native', () => ({
  Globe: 'Globe',
}));

import { supabase } from '../../../services/supabase';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

const mockSupabase = supabase as any;
const mockRouter = useRouter as jest.Mock;
const mockWebBrowser = WebBrowser as any;

describe('Login Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    });
  });

  it('renders correctly with all UI elements', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    expect(getByText('Pothole')).toBeTruthy();
    expect(getByText('Report and track local road hazards')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
    expect(getByText('Sign in with Google')).toBeTruthy();
    expect(getByText('Sign up')).toBeTruthy();
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('allows typing email and password', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('you@example.com');
    const passwordInput = getByPlaceholderText('••••••••');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    expect(emailInput.props.value).toBe('test@example.com');
    expect(passwordInput.props.value).toBe('password123');
  });

  it('shows error alert when fields are empty', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign In'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter your email and password');
    alertSpy.mockRestore();
  });

  it('calls supabase signInWithPassword on valid input', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: '1' } }, error: null });

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');

    await act(async () => {
      fireEvent.press(getByText('Sign In'));
    });

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('shows error alert on login failure', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid credentials' },
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'wrongpassword');

    await act(async () => {
      fireEvent.press(getByText('Sign In'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Sign In Failed', 'Invalid credentials');
    alertSpy.mockRestore();
  });

  it('toggles password visibility', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const passwordInput = getByPlaceholderText('••••••••');
    expect(passwordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(getByText('Show'));

    expect(passwordInput.props.secureTextEntry).toBe(false);
  });

  it('navigates to register on Sign up press', () => {
    const { getByText } = render(<LoginScreen />);
    const push = mockRouter().push;

    fireEvent.press(getByText('Sign up'));

    expect(push).toHaveBeenCalledWith('/register');
  });

  it('navigates to forgot-password on Forgot password press', () => {
    const { getByText } = render(<LoginScreen />);
    const push = mockRouter().push;

    fireEvent.press(getByText('Forgot password?'));

    expect(push).toHaveBeenCalledWith('/forgot-password');
  });

  it('calls Google login handler and processes session tokens', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://google.com/auth' },
      error: null,
    });
    mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'pothole://#access_token=token123&refresh_token=refresh123',
    });
    mockSupabase.auth.setSession.mockResolvedValue({ data: {}, error: null });

    const { getByText } = render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign in with Google'));
    });

    expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'token123',
      refresh_token: 'refresh123',
    });
  });

  it('shows error alert when Google login url is missing tokens', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://google.com/auth' },
      error: null,
    });
    mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'pothole://#error=access_denied',
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign in with Google'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Google Sign In Error',
      'Authentication tokens missing in callback URL'
    );
    alertSpy.mockRestore();
  });
});
