import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ComparisonResult } from '../types';
import { colors } from '../theme/colors';
import { formatMoney } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'ShoppingListComparison'>;

export const ShoppingListComparisonScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const comparison: ComparisonResult = route.params.comparison;

  const isEconomy = comparison.economyOrLoss >= 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Análise da Compra</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.doneButtonText}>Concluir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card Resumo Financeiro */}
        <View style={[styles.summaryCard, isEconomy ? styles.summaryCardSuccess : styles.summaryCardDanger]}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons
              name={isEconomy ? 'trending-down' : 'trending-up'}
              size={28}
              color={isEconomy ? colors.success : colors.danger}
            />
            <Text style={[styles.summaryTitle, { color: isEconomy ? colors.success : colors.danger }]}>
              {isEconomy ? 'Economia Realizada!' : 'Orçamento Excedido!'}
            </Text>
          </View>

          <Text style={styles.summaryDiff}>
            {isEconomy ? '+' : ''}
            {formatMoney(comparison.economyOrLoss)}
          </Text>
          <Text style={styles.summarySubtext}>
            {isEconomy ? 'Você gastou menos do que a média esperada.' : 'Você gastou mais do que o planejado.'}
          </Text>

          <View style={styles.divider} />

          <View style={styles.pricesRow}>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Planejado (Média)</Text>
              <Text style={styles.priceVal}>{formatMoney(comparison.estimatedTotal)}</Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Pago (Real)</Text>
              <Text style={[styles.priceVal, styles.boldVal]}>{formatMoney(comparison.realTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Categoria 1: Itens Correspondidos */}
        {comparison.matchedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Comprados (Conforme Planejado)</Text>
              <Text style={styles.sectionCount}>{comparison.matchedItems.length}</Text>
            </View>

            {comparison.matchedItems.map((match, index) => {
              const totalSavings = (match.planned.estimatedPrice - match.real.price) * match.real.quantity;
              const isPriceSaving = totalSavings >= 0;
              return (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{match.planned.name}</Text>
                    <Text style={styles.itemScannedName} numberOfLines={1}>
                      Fisco: {match.real.name}
                    </Text>
                    <Text style={styles.itemDetailText}>
                      Qtd: {match.planned.quantity} {match.planned.unit} → {match.real.quantity} {match.real.unit}
                    </Text>
                    {match.unitIncompatible && (
                      <Text style={styles.unitWarning}>
                        Unidade diferente: {match.planned.unit} → {match.real.unit}
                      </Text>
                    )}
                  </View>
                  <View style={styles.itemPriceDetail}>
                    <Text style={styles.itemRealPrice}>{formatMoney(match.real.price * match.real.quantity)}</Text>
                    <Text style={[styles.itemPriceDiff, { color: isPriceSaving ? colors.success : colors.danger }]}>
                      {isPriceSaving ? '-' : '+'}
                      {formatMoney(Math.abs(totalSavings))}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Categoria 2: Itens Esquecidos */}
        {comparison.forgottenItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.sectionTitle}>Itens Esquecidos / Não Comprados</Text>
              <Text style={styles.sectionCount}>{comparison.forgottenItems.length}</Text>
            </View>

            {comparison.forgottenItems.map((item, index) => (
              <View key={index} style={[styles.itemRow, styles.itemRowRed]}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemNameMuted}>{item.name}</Text>
                  <Text style={styles.itemDetailText}>
                    Planejado: {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.itemPriceDetail}>
                  <Text style={styles.itemEstimatedPriceMuted}>
                    Est. {formatMoney(item.quantity * item.estimatedPrice)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Categoria 3: Itens Extras / Impulso */}
        {comparison.extraItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="shopping-outline" size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Compras por Impulso / Extra</Text>
              <Text style={styles.sectionCount}>{comparison.extraItems.length}</Text>
            </View>

            {comparison.extraItems.map((item, index) => (
              <View key={index} style={[styles.itemRow, styles.itemRowOrange]}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDetailText}>
                    Quantidade: {item.quantity} {item.unit} • {formatMoney(item.price)}/un
                  </Text>
                </View>
                <View style={styles.itemPriceDetail}>
                  <Text style={styles.itemRealPrice}>{formatMoney(item.price * item.quantity)}</Text>
                  <Text style={styles.extraTag}>Impulso</Text>
                </View>
              </View>
            ))}
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  doneButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  doneButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryCardSuccess: {
    borderLeftWidth: 6,
    borderLeftColor: colors.success,
  },
  summaryCardDanger: {
    borderLeftWidth: 6,
    borderLeftColor: colors.danger,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  summaryDiff: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 4,
  },
  summarySubtext: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  pricesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.mutedText,
    textTransform: 'uppercase',
  },
  priceVal: {
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  boldVal: {
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: colors.inputBackground,
    color: colors.mutedText,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRowRed: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    paddingLeft: 8,
  },
  itemRowOrange: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    paddingLeft: 8,
  },
  itemMain: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemNameMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
    textDecorationLine: 'line-through',
  },
  itemScannedName: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  itemDetailText: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  unitWarning: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 2,
  },
  itemPriceDetail: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  itemRealPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  itemEstimatedPriceMuted: {
    fontSize: 13,
    color: colors.mutedText,
  },
  itemPriceDiff: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  extraTag: {
    fontSize: 10,
    backgroundColor: colors.dangerBackground,
    color: colors.danger,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
  },
});
