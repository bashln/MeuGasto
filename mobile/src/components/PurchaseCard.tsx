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
        {/* Linha 1: Nome do mercado + Valor */}
        <View style={styles.row1}>
          <RNText style={styles.marketName}>
            {purchase.supermarket?.name || 'Supermercado'}
          </RNText>
          <RNText style={styles.totalValue}>
            {formatMoney(purchase.totalPrice)}
          </RNText>
        </View>

        {/* Linha 2: Data e hora */}
        <RNText style={styles.dateText}>
          {formatDate(purchase.date)}
        </RNText>

        {/* Linha 3: Categoria + quantidade */}
        <RNText style={styles.categoryText}>
          {purchase.isManual ? 'Manual' : 'NFC-e'} • {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </RNText>

        {/* Linha 4: Ações */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => onPress?.(purchase)}
          >
            <RNText style={styles.detailsButtonText}>Ver detalhes</RNText>
          </TouchableOpacity>

          <View style={styles.sideActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEdit?.(purchase)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primaryText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete?.(purchase)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <MaterialCommunityIcons name="trash-can" size={18} color={colors.primaryText} />
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
    marginBottom: 6,
  },
  marketName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  dateText: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsButton: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  detailsButtonText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  sideActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: colors.warning,
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: colors.danger,
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
