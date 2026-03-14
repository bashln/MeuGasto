import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text as RNText, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Header, ItemInputRow } from '../components';
import { RootStackParamList } from '../navigation/types';
import { Item } from '../types';
import { calculateUnitPrice } from '../utils';
import { colors } from '../theme/colors';

type PriceComparatorScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PriceComparator'>;
};

const createDefaultItem = (id: number): Item => ({
  id,
  name: '',
  price: 0,
  quantity: 1,
  unit: 'un',
});

export const PriceComparatorScreen: React.FC<PriceComparatorScreenProps> = ({ navigation }) => {
  const [items, setItems] = useState<Item[]>([createDefaultItem(1)]);

  const addItem = () => {
    setItems((current) => {
      const nextId = current.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
      return [...current, createDefaultItem(nextId)];
    });
  };

  const removeItem = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateItem = (id: number, updates: Partial<Item>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const clearAll = () => {
    setItems([]);
  };

  const cheapestItemId = useMemo(() => {
    const sortableItems = items
      .map((item) => {
        try {
          return { id: item.id, unitPrice: calculateUnitPrice(item) };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { id: number; unitPrice: number } => entry !== null)
      .sort((a, b) => a.unitPrice - b.unitPrice);

    return sortableItems[0]?.id;
  }, [items]);

  return (
    <View style={styles.container}>
      <Header title="Comparador de Preços" iconName="scale-balance" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <RNText style={styles.title}>Compare preços sem salvar no histórico</RNText>
        <RNText style={styles.subtitle}>
          Adicione produtos, ajuste quantidade e unidade, e veja automaticamente qual item tem o melhor custo por unidade.
        </RNText>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={addItem}
            testID="price-comparator-add-item-button"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.primaryText} />
            <RNText style={styles.addButtonText}>Adicionar Item</RNText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAll}
            testID="price-comparator-clear-button"
          >
            <MaterialCommunityIcons name="broom" size={18} color={colors.text} />
            <RNText style={styles.clearButtonText}>Limpar Tudo</RNText>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-off" size={32} color={colors.mutedText} />
            <RNText style={styles.emptyText}>Nenhum item para comparar.</RNText>
            <RNText style={styles.emptyHint}>Toque em "Adicionar Item" para começar.</RNText>
          </View>
        ) : (
          items.map((item) => (
            <ItemInputRow
              key={item.id}
              item={item}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              isCheapest={item.id === cheapestItemId}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.success,
    paddingVertical: 10,
  },
  addButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 13,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
  },
  clearButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyHint: {
    marginTop: 4,
    color: colors.mutedText,
    fontSize: 12,
  },
});
