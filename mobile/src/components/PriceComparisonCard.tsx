import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { Item } from '../types';
import { formatMoney } from '../utils';
import { PriceComparisonResult } from '../utils/priceComparison';
import { colors } from '../theme/colors';

type PriceComparisonCardProps = {
  comparison: PriceComparisonResult;
  item1: Item;
  item2: Item;
};

export const PriceComparisonCard: React.FC<PriceComparisonCardProps> = ({ comparison, item1, item2 }) => {
  if (!comparison.isComparable) {
    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleSmall" style={styles.title}>Resultado da comparação</Text>
          <Text variant="bodyMedium" style={styles.warningText}>{comparison.message}</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleSmall" style={styles.title}>Resultado da comparação</Text>
        <View style={styles.row}>
          <Text variant="bodyMedium" style={styles.itemName}>{item1.name}</Text>
          <Text variant="bodyMedium" style={styles.itemPrice}>
            {formatMoney(comparison.item1UnitPrice ?? 0)}/{comparison.standardUnit}
          </Text>
        </View>
        <View style={styles.row}>
          <Text variant="bodyMedium" style={styles.itemName}>{item2.name}</Text>
          <Text variant="bodyMedium" style={styles.itemPrice}>
            {formatMoney(comparison.item2UnitPrice ?? 0)}/{comparison.standardUnit}
          </Text>
        </View>

        <Text variant="bodyLarge" style={styles.highlightText}>{comparison.message}</Text>

        {comparison.savingsPercentage !== null && comparison.savingsPercentage > 0 && comparison.cheaperItem && (
          <Text variant="bodySmall" style={styles.savingsText}>
            Economia aproximada de {comparison.savingsPercentage.toFixed(1)}% ao escolher {comparison.cheaperItem.name}.
          </Text>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  title: {
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    flex: 1,
    marginRight: 12,
  },
  itemPrice: {
    color: colors.primary,
    fontWeight: '600',
  },
  highlightText: {
    marginTop: 8,
    color: colors.success,
    fontWeight: '600',
  },
  savingsText: {
    marginTop: 6,
    color: colors.mutedText,
  },
  warningText: {
    color: colors.warning,
  },
});
