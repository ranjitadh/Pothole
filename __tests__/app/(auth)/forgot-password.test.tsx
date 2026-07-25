import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ForgotPasswordScreen from '../../../app/(auth)/forgot-password';
import { Alert } from 'react-native';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));
jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
jest.mock('lucide-react-native', () => ({}));

import { supabase } from '../../../services/supabase';
import { useRouter } from 'expo-router';

const mockSupabase = supabase as any;
const mockRouter = useRouter as jest.Mock;

describe('Forgot Password Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    });
  });

  it('renders correctly with all UI elements', () => {
    const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

    expect(getByText('Reset Password')).toBeTruthy();
    expect(getByText('Enter your email to receive a password reset link')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByText('Send Reset Link')).toBeTruthy();
    expect(getByText('Back to Sign In')).toBeTruthy();
  });

  it('allows typing email', () => {
    const { getByPlaceholderText } = render(<ForgotPasswordScreen />);
    const emailInput = getByPlaceholderText('you@example.com');

    fireEvent.changeText(emailInput, 'test@example.com');

    expect(emailInput.props.value).toBe('test@example.com');
  });

  it('shows error alert when email is empty', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.press(getByText('Send Reset Link'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter your email address');
    alertSpy.mockRestore();
  });

  it('calls resetPasswordForEmail on valid input', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');

    await act(async () => {
      fireEvent.press(getByText('Send Reset Link'));
    });

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: 'pothole://reset-password',
    });
  });

  it('shows success alert after sending reset link', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');

    await act(async () => {
      fireEvent.press(getByText('Send Reset Link'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Email Sent',
      'Password reset link has been sent to your email. Check your inbox.',
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('shows error alert on failure', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'Email not found' },
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'unknown@example.com');

    await act(async () => {
      fireEvent.press(getByText('Send Reset Link'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Reset Failed', 'Email not found');
    alertSpy.mockRestore();
  });

  it('navigates to login on Back to Sign In press', () => {
    const { getByText } = render(<ForgotPasswordScreen />);
    const push = mockRouter().push;

    fireEvent.press(getByText('Back to Sign In'));

    expect(push).toHaveBeenCalledWith('/login');
  });
});
