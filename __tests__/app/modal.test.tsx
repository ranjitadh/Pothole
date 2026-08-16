import React from 'react';
import { render } from '@testing-library/react-native';
import ModalScreen from '../../app/modal';

describe('ModalScreen', () => {
  it('renders modal content', () => {
    const { getByText } = render(<ModalScreen />);
    expect(getByText('Modal')).toBeTruthy();
  });
});
