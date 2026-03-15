import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { PeriodFilter } from '../PeriodFilter';

if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
  (window as Window & { dispatchEvent: (...args: unknown[]) => void }).dispatchEvent = jest.fn();
}

describe('PeriodFilter', () => {
  it('renderiza as opcoes de periodo esperadas', () => {
    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(
        <PeriodFilter selectedPeriod="6months" onPeriodChange={jest.fn()} />,
      );
    });

    expect(renderer!.root.findByProps({ children: '3M' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: '6M' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: '12M' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: 'Ano' })).toBeTruthy();
  });

  it('dispara callback quando usuario seleciona novo periodo', () => {
    const onPeriodChange = jest.fn();
    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(
        <PeriodFilter selectedPeriod="6months" onPeriodChange={onPeriodChange} />,
      );
    });

    const buttons = renderer!.root.findAllByType(TouchableOpacity);

    act(() => {
      buttons[0].props.onPress();
    });

    expect(onPeriodChange).toHaveBeenCalledWith('3months');
  });
});
