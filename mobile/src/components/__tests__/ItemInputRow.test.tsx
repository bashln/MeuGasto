jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ItemInputRow } from '../ItemInputRow';
import { Item } from '../../types';

describe('ItemInputRow', () => {
  const baseItem: Item = {
    id: 1,
    name: 'Arroz',
    price: 10,
    quantity: 1,
    unit: 'un',
  };

  it('chama onUpdate quando os campos mudam', () => {
    const onUpdate = jest.fn();
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ItemInputRow item={baseItem} onUpdate={onUpdate} onRemove={jest.fn()} />,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'name-input-1' }).props.onChangeText('Arroz Tipo 1');
      renderer!.root.findByProps({ testID: 'price-input-1' }).props.onChangeText('16,90');
      renderer!.root.findByProps({ testID: 'quantity-input-1' }).props.onChangeText('2');
      renderer!.root.findByProps({ testID: 'unit-button-1-kg' }).props.onPress();
    });

    expect(onUpdate).toHaveBeenNthCalledWith(1, { name: 'Arroz Tipo 1' });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { price: 16.9 });
    expect(onUpdate).toHaveBeenNthCalledWith(3, { quantity: 2 });
    expect(onUpdate).toHaveBeenNthCalledWith(4, { unit: 'kg' });
  });

  it('chama onRemove ao tocar em remover', () => {
    const onRemove = jest.fn();
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ItemInputRow item={baseItem} onUpdate={jest.fn()} onRemove={onRemove} />,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'remove-item-1' }).props.onPress();
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
