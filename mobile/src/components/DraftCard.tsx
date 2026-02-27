import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, IconButton, useTheme } from 'react-native-paper';
import { Rascunho } from '../types';
import { formatMoney, formatDate } from '../utils';

interface DraftCardProps {
  draft: Rascunho;
  onPress?: (draft: Rascunho) => void;
  onDelete?: (draft: Rascunho) => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({ draft, onPress, onDelete }) => {
  const theme = useTheme();

  return (
    <TouchableOpacity onPress={() => onPress?.(draft)} activeOpacity={0.7}>
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.info}>
              <Text variant="titleMedium" style={styles.title}>
                {draft.supermarket?.name || 'Sem supermercado'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatDate(draft.createdAt)}
              </Text>
            </View>
            {onDelete && (
              <IconButton
                icon="delete-outline"
                iconColor={theme.colors.error}
                size={20}
                onPress={() => onDelete(draft)}
              />
            )}
          </View>

          <Text
            variant="bodyMedium"
            numberOfLines={2}
            style={[styles.content, { color: theme.colors.onSurfaceVariant }]}
          >
            {draft.conteudo}
          </Text>

          <View style={styles.footer}>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
              {formatMoney(draft.totalPrice)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
  content: {
    marginTop: 8,
  },
  footer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
});
