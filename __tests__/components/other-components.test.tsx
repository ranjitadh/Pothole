import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { MonoText } from '../../components/StyledText';
import { ExternalLink } from '../../components/ExternalLink';
import EditScreenInfo from '../../components/EditScreenInfo';
import { useClientOnlyValue } from '../../components/useClientOnlyValue';
import * as WebBrowser from 'expo-web-browser';

jest.mock('expo-router', () => ({
  Link: (props: any) => {
    const React = require('react');
    const { TouchableOpacity } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      { testID: 'external-link-btn', onPress: props.onPress },
      props.children
    );
  },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({}),
}));

describe('Utility components', () => {
  it('renders MonoText correctly', () => {
    const { getByText } = render(<MonoText>Mono Content</MonoText>);
    expect(getByText('Mono Content')).toBeTruthy();
  });

  it('renders ExternalLink and calls WebBrowser on press on iOS', () => {
    (Platform as any).OS = 'ios';
    const { getByTestId, getByText } = render(
      <ExternalLink href="https://example.com">
        <Text>Click me</Text>
      </ExternalLink>
    );

    expect(getByText('Click me')).toBeTruthy();

    const linkBtn = getByTestId('external-link-btn');
    const mockPreventDefault = jest.fn();
    fireEvent.press(linkBtn, { preventDefault: mockPreventDefault });

    expect(mockPreventDefault).toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com');
  });

  it('renders EditScreenInfo component', () => {
    const { getByText } = render(<EditScreenInfo path="app/(tabs)/index.tsx" />);
    expect(getByText('Open up the code for this screen:')).toBeTruthy();
  });

  it('returns client value in useClientOnlyValue', () => {
    expect(useClientOnlyValue('server', 'client')).toBe('client');
  });
});
