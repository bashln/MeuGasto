import React from 'react';
import { StyleSheet, Text as RNText, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Item } from '../types';
import { calculateUnitPrice, formatMoney } from '../utils';
import { colors } from '../theme/colors';

type ItemInputRowProps = {
  item: Item;
  onUpdate: (updates: Partial<Item>) => void;
  onRemove: () => void;
  isCheapest?: boolean;
};

const UNIT_OPTIONS = ['g', 'kg', 'l', 'un'] as const;

const parseNumericInput = (value: string): number => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ItemInputRow: React.FC<ItemInputRowProps> = ({ item, onUpdate, onRemove, isCheapest = false }) => {
  let unitPriceLabel = 'Preço por unidade: inválido';

  try {
    const unitPrice = calculateUnitPrice(item);
    const normalizedUnit = item.unit.trim().toLowerCase() || 'un';
    unitPriceLabel = `Preço por unidade: ${formatMoney(unitPrice)}/${normalizedUnit}`;
  } catch {
    unitPriceLabel = 'Preço por unidade: inválido';
  }

  return (
    <View
      style={[styles.container, isCheapest && styles.containerCheapest]}
      testID="item-input-row"
    >
      <View style={styles.headerRow}>
        <RNText style={styles.title}>Item</RNText>
        {isCheapest && (
          <View style={styles.cheapestBadge}>
            <MaterialCommunityIcons name="check-circle" size={14} color={colors.primaryText} />
            <RNText style={styles.cheapestBadgeText}>Mais barato</RNText>
          </View>
        )}
      </View>

      <TextInput
        value={item.name}
        onChangeText={(name) => onUpdate({ name })}
        placeholder="Nome do produto"
        style={styles.input}
        placeholderTextColor={colors.mutedText}
        testID={`name-input-${item.id}`}
      />

      <View style={styles.row}>
        <TextInput
          value={item.price ? String(item.price) : ''}
          onChangeText={(value) => onUpdate({ price: parseNumericInput(value) })}
          placeholder="Preço"
          keyboardType="decimal-pad"
          style={[styles.input, styles.inputHalf]}
          placeholderTextColor={colors.mutedText}
          testID={`price-input-${item.id}`}
        />
        <TextInput
          value={item.quantity ? String(item.quantity) : ''}
          onChangeText={(value) => onUpdate({ quantity: parseNumericInput(value) })}
          placeholder="Quantidade"
          keyboardType="decimal-pad"
          style={[styles.input, styles.inputHalf]}
          placeholderTextColor={colors.mutedText}
          testID={`quantity-input-${item.id}`}
        />
      </View>

      <View style={styles.unitsContainer}>
        {UNIT_OPTIONS.map((unitOption) => {
          const isActive = item.unit.trim().toLowerCase() === unitOption;

          return (
            <TouchableOpacity
              key={`${item.id}-${unitOption}`}
              style={[styles.unitButton, isActive && styles.unitButtonActive]}
              onPress={() => onUpdate({ unit: unitOption })}
              testID={`unit-button-${item.id}-${unitOption}`}
            >
              <RNText style={[styles.unitButtonText, isActive && styles.unitButtonTextActive]}>{unitOption}</RNText>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <RNText style={styles.unitPriceText}>{unitPriceLabel}</RNText>
        <TouchableOpacity style={styles.removeButton} onPress={onRemove} testID={`remove-item-${item.id}`}>
          <MaterialCommunityIcons name="delete-outline" size={18} color={colors.primaryText} />
          <RNText style={styles.removeButtonText}>Remover</RNText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  containerCheapest: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cheapestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cheapestBadgeText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 8,
    fontSize: 14,
  },
  inputHalf: {
    flex: 1,
  },
  unitsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  unitButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  unitButtonTextActive: {
    color: colors.primaryText,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitPriceText: {
    color: colors.mutedText,
    fontSize: 12,
    flex: 1,
    marginRight: 10,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  removeButtonText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
});
