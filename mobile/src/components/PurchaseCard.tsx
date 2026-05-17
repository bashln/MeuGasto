import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Purchase } from '../types';
import { formatMoney, formatDate } from '../utils';
import { colors } from '../theme/colors';

interface PurchaseCardProps {
  purchase: Purchase;
  onPress?: (purchase: Purchase) => void;
  onDelete?: (purchase: Purchase) => void;
  onEdit?: (purchase: Purchase) => void;
}

export const PurchaseCard: React.FC<PurchaseCardProps> = ({ purchase, onPress, onDelete, onEdit }) => {
  const itemCount = purchase.products?.length ?? 0;

  return (
    <TouchableOpacity onPress={() => onPress?.(purchase)} activeOpacity={0.7}>
      <View style={styles.card}>
        <View style={styles.row1}>
          <RNText style={styles.marketName} numberOfLines={1}>
            {purchase.supermarket?.name || 'Supermercado'}
          </RNText>
          <RNText style={styles.totalValue}>
            {formatMoney(purchase.totalPrice)}
          </RNText>
        </View>

        <View style={styles.row2}>
          <RNText style={styles.metaText}>
            {formatDate(purchase.date)}
            {'  ·  '}
            {purchase.isManual ? 'Manual' : 'NFC-e'}
            {'  ·  '}
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          </RNText>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => onEdit?.(purchase)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete?.(purchase)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.mutedText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  marketName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  row2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: colors.mutedText,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 12,
  },
});
