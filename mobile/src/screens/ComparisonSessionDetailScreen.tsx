import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Text as RNText,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { PriceComparisonSession } from '../types';
import { priceComparisonService } from '../services';
import { Header } from '../components';
import { colors } from '../theme/colors';
import { formatMoney } from '../utils';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ComparisonSessionDetail'>;
  route: RouteProp<RootStackParamList, 'ComparisonSessionDetail'>;
};

export const ComparisonSessionDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId } = route.params;
  const [session, setSession] = useState<PriceComparisonSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const data = await priceComparisonService.getSessionById(sessionId);
      setSession(data);
    } catch (error) {
      console.error('[ComparisonSessionDetail] Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Header title="Carregando..." iconName="scale-balance" onBack={() => navigation.goBack()} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Header title="Sessão não encontrada" iconName="alert" onBack={() => navigation.goBack()} />
        <RNText style={{ color: colors.mutedText }}>Sessão expirou ou foi excluída.</RNText>
      </View>
    );
  }

  const quotes = session.quotes || [];

  return (
    <View style={styles.container}>
      <Header title={session.title} iconName="scale-balance" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {quotes.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-off" size={32} color={colors.mutedText} />
            <RNText style={styles.emptyText}>Nenhuma cotação nesta sessão.</RNText>
          </View>
        ) : (
          <>
            {quotes.map((quote) => (
              <View key={quote.id} style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <MaterialCommunityIcons name="store" size={20} color={colors.primary} />
                  <RNText style={styles.quoteMarketName}>{quote.marketNameSnapshot}</RNText>
                  <RNText style={styles.quoteTotal}>{formatMoney(quote.totalPrice)}</RNText>
                </View>

                {quote.items && quote.items.length > 0 ? (
                  <View style={styles.quoteItems}>
                    {quote.items.map((item) => (
                      <View key={item.id} style={styles.quoteItemRow}>
                        <RNText style={styles.quoteItemName} numberOfLines={1}>{item.name}</RNText>
                        <RNText style={styles.quoteItemDetail}>
                          {item.quantity} {item.unit} x {formatMoney(item.price)}
                        </RNText>
                        <RNText style={styles.quoteItemSubtotal}>
                          {formatMoney(item.price * item.quantity)}
                        </RNText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <RNText style={{ color: colors.mutedText, fontSize: 12, padding: 12 }}>
                    Sem itens nesta cotação.
                  </RNText>
                )}
              </View>
            ))}

            {quotes.length >= 2 && (
              <View style={styles.comparisonSummary}>
                <RNText style={styles.comparisonTitle}>Resumo da Comparação</RNText>
                {quotes[0].items?.map((item, idx) => {
                  const otherItem = quotes[1]?.items?.[idx];
                  if (!otherItem) return null;
                  const diff = item.price - otherItem.price;
                  return (
                    <View key={item.id} style={styles.comparisonRow}>
                      <RNText style={styles.comparisonItemName}>{item.name}</RNText>
                      <RNText style={[styles.comparisonPrice, diff > 0 && { color: colors.success }]}>
                        {formatMoney(item.price)}
                      </RNText>
                      <MaterialCommunityIcons name="arrow-right" size={16} color={colors.mutedText} />
                      <RNText style={[styles.comparisonPrice, diff < 0 && { color: colors.success }]}>
                        {formatMoney(otherItem.price)}
                      </RNText>
                    </View>
                  );
                })}
              </View>
            )}
          </>
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
  centered: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 15,
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  quoteMarketName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quoteTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  quoteItems: {
    padding: 12,
  },
  quoteItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  quoteItemName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  quoteItemDetail: {
    fontSize: 11,
    color: colors.mutedText,
    minWidth: 80,
    textAlign: 'right',
  },
  quoteItemSubtotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    minWidth: 70,
    textAlign: 'right',
  },
  comparisonSummary: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  comparisonItemName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  comparisonPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
