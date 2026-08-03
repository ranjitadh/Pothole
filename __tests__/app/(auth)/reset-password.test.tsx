import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ResetPasswordScreen from '../../../app/(auth)/reset-password';
import { Alert } from 'react-native';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      updateUser: jest.fn().mockResolvedValue({ data: { user: {} }, error: null }),
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

describe('Reset Password Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    });
  });

  it('renders correctly with all UI elements', () => {
    const { getByText, getAllByPlaceholderText } = render(<ResetPasswordScreen />);

    expect(getByText('Set New Password')).toBeTruthy();
    expect(getByText('Enter your new password below')).toBeTruthy();
    expect(getAllByPlaceholderText('••••••••')).toHaveLength(2);
    expect(getByText('Update Password')).toBeTruthy();
    expect(getByText('Back to Sign In')).toBeTruthy();
  });

  it('shows error alert when fields are empty', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<ResetPasswordScreen />);

    await act(async () => {
      fireEvent.press(getByText('Update Password'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter and confirm your new password');
    alertSpy.mockRestore();
  });

  it('shows error alert when passwords do not match', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getAllByPlaceholderText, getByText } = render(<ResetPasswordScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(inputs[0], 'newpassword123');
    fireEvent.changeText(inputs[1], 'different123');

    await act(async () => {
      fireEvent.press(getByText('Update Password'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Passwords do not match');
    alertSpy.mockRestore();
  });

  it('calls updateUser on valid input', async () => {
    mockSupabase.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });

    const { getAllByPlaceholderText, getByText } = render(<ResetPasswordScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(inputs[0], 'newpassword123');
    fireEvent.changeText(inputs[1], 'newpassword123');

    await act(async () => {
      fireEvent.press(getByText('Update Password'));
    });

    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpassword123',
    });
  });

  it('shows success alert after updating password', async () => {
    mockSupabase.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getAllByPlaceholderText, getByText } = render(<ResetPasswordScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(inputs[0], 'newpassword123');
    fireEvent.changeText(inputs[1], 'newpassword123');

    await act(async () => {
      fireEvent.press(getByText('Update Password'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Your password has been reset successfully.',
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('navigates to login on Back to Sign In press', () => {
    const { getByText } = render(<ResetPasswordScreen />);
    const push = mockRouter().push;

    fireEvent.press(getByText('Back to Sign In'));

    expect(push).toHaveBeenCalledWith('/login');
  });
});
