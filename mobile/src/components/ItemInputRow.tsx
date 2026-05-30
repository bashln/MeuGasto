import React from 'react';
import { StyleSheet, Text as RNText, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Item } from '../types';
import { calculateUnitPrice, formatMoney, getStandardUnit, ITEM_UNIT_OPTIONS } from '../utils';
import { colors } from '../theme/colors';

type ItemInputRowProps = {
  item: Item;
  index?: number;
  onUpdate: (updates: Partial<Item>) => void;
  onRemove: () => void;
  isCheapest?: boolean;
};

const parseNumericInput = (value: string): number => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ItemInputRow: React.FC<ItemInputRowProps> = ({ item, index, onUpdate, onRemove, isCheapest = false }) => {
  const [priceStr, setPriceStr] = React.useState(item.price ? String(item.price) : '');
  const [quantityStr, setQuantityStr] = React.useState(item.quantity ? String(item.quantity) : '');

  React.useEffect(() => {
    const parsedLocal = parseNumericInput(priceStr);
    if (parsedLocal !== item.price) {
      setPriceStr(item.price ? String(item.price) : '');
    }
  }, [item.price, priceStr]);

  React.useEffect(() => {
    const parsedLocal = parseNumericInput(quantityStr);
    if (parsedLocal !== item.quantity) {
      setQuantityStr(item.quantity ? String(item.quantity) : '');
    }
  }, [item.quantity, quantityStr]);
  let unitPriceLabel = 'Preço por unidade: inválido';

  try {
    const unitPrice = calculateUnitPrice(item);
    const standardUnit = getStandardUnit(item.unit) ?? 'un';
    unitPriceLabel = `Preço por unidade: ${formatMoney(unitPrice)}/${standardUnit}`;
  } catch {
    unitPriceLabel = 'Preço por unidade: inválido';
  }

  return (
    <View
      style={[styles.container, isCheapest && styles.containerCheapest]}
      testID="item-input-row"
    >
      <View style={styles.headerRow}>
        <RNText style={styles.title}>{index !== undefined ? `Item ${index + 1}` : 'Item'}</RNText>
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
          value={priceStr}
          onChangeText={(value) => {
            setPriceStr(value);
            onUpdate({ price: parseNumericInput(value) });
          }}
          placeholder="Preço"
          keyboardType="decimal-pad"
          style={[styles.input, styles.inputHalf]}
          placeholderTextColor={colors.mutedText}
          testID={`price-input-${item.id}`}
        />
        <TextInput
          value={quantityStr}
          onChangeText={(value) => {
            setQuantityStr(value);
            onUpdate({ quantity: parseNumericInput(value) });
          }}
          placeholder="Quantidade"
          keyboardType="decimal-pad"
          style={[styles.input, styles.inputHalf]}
          placeholderTextColor={colors.mutedText}
          testID={`quantity-input-${item.id}`}
        />
      </View>

      <View style={styles.unitsContainer}>
        {ITEM_UNIT_OPTIONS.map((unitOption) => {
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
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`remove-item-${item.id}`}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.mutedText} />
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
});
