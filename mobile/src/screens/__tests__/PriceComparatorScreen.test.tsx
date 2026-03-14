jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../components', () => {
  return {
    Header: () => null,
    ItemInputRow: jest.requireActual('../../components/ItemInputRow').ItemInputRow,
  };
});

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PriceComparatorScreen } from '../PriceComparatorScreen';

describe('PriceComparatorScreen', () => {
  it('adiciona e remove itens da lista local', () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <PriceComparatorScreen navigation={{ goBack: jest.fn() } as never} />,
      );
    });

    expect(renderer!.root.findAllByProps({ testID: 'remove-item-1' }).length).toBeGreaterThan(0);

    act(() => {
      renderer!.root.findByProps({ testID: 'price-comparator-add-item-button' }).props.onPress();
    });

    expect(renderer!.root.findAllByProps({ testID: 'remove-item-2' }).length).toBeGreaterThan(0);

    act(() => {
      renderer!.root.findByProps({ testID: 'remove-item-1' }).props.onPress();
    });

    expect(renderer!.root.findAllByProps({ testID: 'remove-item-1' })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ testID: 'remove-item-2' }).length).toBeGreaterThan(0);
  });

  it('limpa todos os itens', () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <PriceComparatorScreen navigation={{ goBack: jest.fn() } as never} />,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'price-comparator-clear-button' }).props.onPress();
    });

    expect(renderer!.root.findAllByProps({ testID: 'item-input-row' })).toHaveLength(0);
    expect(renderer!.root.findByProps({ children: 'Nenhum item para comparar.' })).toBeTruthy();
  });
});
