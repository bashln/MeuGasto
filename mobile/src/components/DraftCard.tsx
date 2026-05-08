import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Draft } from '../types';
import { formatMoney, formatDate } from '../utils';
import { colors } from '../theme/colors';

interface DraftCardProps {
  draft: Draft;
  onPress?: (draft: Draft) => void;
  onDelete?: (draft: Draft) => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({ draft, onPress, onDelete }) => {
  const itemCount = draft.items?.length ?? 0;

  return (
    <TouchableOpacity onPress={() => onPress?.(draft)} activeOpacity={0.7}>
      <View style={styles.card}>
        <View style={styles.row1}>
          <RNText style={styles.marketName} numberOfLines={1}>
            {draft.supermarket?.name || 'Sem supermercado'}
          </RNText>
          <RNText style={styles.totalValue}>
            {formatMoney(draft.totalPrice)}
          </RNText>
        </View>

        <View style={styles.row2}>
          <RNText style={styles.metaText}>
            {formatDate(draft.createdAt)}
            {'  ·  '}
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          </RNText>

          {onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(draft)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.mutedText} />
            </TouchableOpacity>
          )}
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
});
