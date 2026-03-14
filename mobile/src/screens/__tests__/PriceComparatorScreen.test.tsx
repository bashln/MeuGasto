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
import { ItemInputRow } from '../../components/ItemInputRow';

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

  it('mostra badge de mais barato apenas dentro do mesmo grupo de unidade', () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <PriceComparatorScreen navigation={{ goBack: jest.fn() } as never} />,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'price-comparator-add-item-button' }).props.onPress();
      renderer!.root.findByProps({ testID: 'price-comparator-add-item-button' }).props.onPress();
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'unit-button-1-kg' }).props.onPress();
      renderer!.root.findByProps({ testID: 'price-input-1' }).props.onChangeText('10');
      renderer!.root.findByProps({ testID: 'quantity-input-1' }).props.onChangeText('1');

      renderer!.root.findByProps({ testID: 'unit-button-2-l' }).props.onPress();
      renderer!.root.findByProps({ testID: 'price-input-2' }).props.onChangeText('5');
      renderer!.root.findByProps({ testID: 'quantity-input-2' }).props.onChangeText('1');

      renderer!.root.findByProps({ testID: 'unit-button-3-l' }).props.onPress();
      renderer!.root.findByProps({ testID: 'price-input-3' }).props.onChangeText('8');
      renderer!.root.findByProps({ testID: 'quantity-input-3' }).props.onChangeText('1');
    });

    const rows = renderer!.root.findAllByType(ItemInputRow);
    const cheapestRows = rows.filter((row: { props: { isCheapest?: boolean } }) => row.props.isCheapest === true);

    expect(cheapestRows).toHaveLength(1);
    expect(cheapestRows[0].props.isCheapest).toBe(true);
  });
});
