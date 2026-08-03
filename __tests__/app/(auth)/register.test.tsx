import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import RegisterScreen from '../../../app/(auth)/register';
import { Alert } from 'react-native';

const mockFrom = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
});

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: { id: '1' }, session: null }, error: null }),
    },
    from: (table: string) => mockFrom(table),
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

describe('Register Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    });
  });

  it('renders correctly with all UI elements', () => {
    const { getByText, getByPlaceholderText, getAllByPlaceholderText } = render(<RegisterScreen />);

    expect(getByText('Create Account')).toBeTruthy();
    expect(getByText('Join Pothole and start reporting local hazards')).toBeTruthy();
    expect(getByPlaceholderText('username')).toBeTruthy();
    expect(getByPlaceholderText('John Doe')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getAllByPlaceholderText('••••••••')).toHaveLength(2);
    expect(getByText('Sign Up')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('allows typing in all input fields', () => {
    const { getByPlaceholderText, getAllByPlaceholderText } = render(<RegisterScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(getByPlaceholderText('username'), 'testuser');
    fireEvent.changeText(getByPlaceholderText('John Doe'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(inputs[0], 'password123');
    fireEvent.changeText(inputs[1], 'password123');

    expect(getByPlaceholderText('username').props.value).toBe('testuser');
    expect(getByPlaceholderText('John Doe').props.value).toBe('Test User');
    expect(getByPlaceholderText('you@example.com').props.value).toBe('test@example.com');
    expect(inputs[0].props.value).toBe('password123');
    expect(inputs[1].props.value).toBe('password123');
  });

  it('shows error alert when fields are empty', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<RegisterScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign Up'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please fill out all fields');
    alertSpy.mockRestore();
  });

  it('shows error alert when passwords do not match', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<RegisterScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(getByPlaceholderText('username'), 'testuser');
    fireEvent.changeText(getByPlaceholderText('John Doe'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(inputs[0], 'password123');
    fireEvent.changeText(inputs[1], 'different123');

    await act(async () => {
      fireEvent.press(getByText('Sign Up'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Passwords do not match');
    alertSpy.mockRestore();
  });

  it('calls supabase signUp on valid input', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: { user: { id: '1' }, session: null }, error: null });

    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<RegisterScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(getByPlaceholderText('username'), 'testuser');
    fireEvent.changeText(getByPlaceholderText('John Doe'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(inputs[0], 'password123');
    fireEvent.changeText(inputs[1], 'password123');

    await act(async () => {
      fireEvent.press(getByText('Sign Up'));
    });

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: {
          username: 'testuser',
          display_name: 'Test User',
        },
      },
    });
  });

  it('shows success alert after registration', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: { user: { id: '1' }, session: null }, error: null });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<RegisterScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(getByPlaceholderText('username'), 'testuser');
    fireEvent.changeText(getByPlaceholderText('John Doe'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(inputs[0], 'password123');
    fireEvent.changeText(inputs[1], 'password123');

    await act(async () => {
      fireEvent.press(getByText('Sign Up'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Registration successful! Please check your email to verify your account.',
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('shows error alert when username is already taken', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing_id' }, error: null }),
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<RegisterScreen />);

    const inputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(getByPlaceholderText('username'), 'existinguser');
    fireEvent.changeText(getByPlaceholderText('John Doe'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(inputs[0], 'password123');
    fireEvent.changeText(inputs[1], 'password123');

    await act(async () => {
      fireEvent.press(getByText('Sign Up'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Registration Failed',
      'Username is already taken. Please choose another username.'
    );
    alertSpy.mockRestore();
  });

  it('navigates to login on Sign In press', () => {
    const { getByText } = render(<RegisterScreen />);
    const push = mockRouter().push;

    fireEvent.press(getByText('Sign In'));

    expect(push).toHaveBeenCalledWith('/login');
  });
});
