import React from 'react';
import { render } from '@testing-library/react-native';
import NotFoundScreen from '../../app/+not-found';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  Stack: {
    Screen: () => null,
  },
}));

describe('NotFoundScreen', () => {
  it('renders not found text and link', () => {
    const { getByText } = render(<NotFoundScreen />);
    expect(getByText("This screen doesn't exist.")).toBeTruthy();
    expect(getByText('Go to home screen!')).toBeTruthy();
  });
});
