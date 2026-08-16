import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View, useThemeColor } from '../../components/Themed';
import { useThemeStore } from '../../store/theme-store';

describe('Themed components & useThemeColor hook', () => {
  beforeEach(() => {
    useThemeStore.setState({ themeMode: 'light' });
  });

  it('renders Text with light/dark colors', () => {
    const { getByText } = render(
      <Text lightColor="#111" darkColor="#eee">
        Themed Text
      </Text>
    );
    expect(getByText('Themed Text')).toBeTruthy();
  });

  it('renders View with light/dark colors', () => {
    const { getByText } = render(
      <View lightColor="#fff" darkColor="#000">
        <Text>Content</Text>
      </View>
    );
    expect(getByText('Content')).toBeTruthy();
  });
});
