import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Text as RNText, Alert, TextInput, ActivityIndicator } from 'react-native';
import { FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePurchases } from '../context';
import { PurchaseCard, Loading, ErrorMessage } from '../components';
import { Purchase, PurchaseFilter } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { formatMoney } from '../utils';
import { colors } from '../theme/colors';

type PurchasesScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Purchases'>;
};

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { purchases, isLoading, isLoadingMore, hasMore, page, error, metrics, fetchPurchases, loadMorePurchases, deletePurchase } = usePurchases();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const PAGE_SIZE = 20;

  const buildServerFilter = useCallback((pageNumber = 0): PurchaseFilter => {
    const isManual = filterType === 'all' ? undefined : filterType === 'manual';
    return {
      page: pageNumber,
      size: PAGE_SIZE,
      isManual,
    };
  }, [filterType]);

  const loadPurchases = useCallback(async (filter?: PurchaseFilter) => {
    await fetchPurchases(filter);
  }, [fetchPurchases]);

  useEffect(() => {
    loadPurchases(buildServerFilter(0));
  }, [loadPurchases, buildServerFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPurchases(buildServerFilter(0));
    setRefreshing(false);
  }, [loadPurchases, buildServerFilter]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }
    const nextPage = (page?.pageNumber ?? 0) + 1;
    await loadMorePurchases(buildServerFilter(nextPage));
  }, [buildServerFilter, hasMore, isLoading, isLoadingMore, loadMorePurchases, page?.pageNumber]);

  const handlePurchasePress = (purchase: Purchase) => {
    navigation.navigate('PurchaseDetail', { purchaseId: purchase.id });
  };

  const handleAddPurchase = () => {
    navigation.navigate('ScanQRCode');
  };

  const handleDeletePurchase = (purchase: Purchase) => {
    Alert.alert(
      'Excluir compra',
      'Tem certeza que deseja excluir esta compra?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchase(purchase.id);
              await loadPurchases(buildServerFilter(0));
            } catch (err) {
              console.warn('Erro ao deletar:', err);
            }
          },
        },
      ]
    );
  };

  const handleEditPurchase = (purchase: Purchase) => {
    if (!purchase.isManual) {
      Alert.alert('Compra importada', 'Compras importadas via NFC-e não podem ser alteradas.');
      return;
    }
    navigation.navigate('PurchaseEdit', { purchaseId: purchase.id });
  };

  const filteredPurchases = (purchases || []).filter((purchase) => {
    if (!searchQuery) return true;
    return purchase.supermarket?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPurchases = metrics.totalCount;
  const totalValue = metrics.totalValue;
  const averageTicket = totalPurchases > 0 ? totalValue / totalPurchases : 0;

  const hasActiveFilters = filterType !== 'all' || !!searchQuery;

  const renderEmptyState = () => {
    if (hasActiveFilters) {
      const filterLabels: string[] = [];
      if (filterType !== 'all') filterLabels.push(filterType === 'manual' ? 'Manual' : 'NFC-e');
      if (searchQuery) filterLabels.push(`"${searchQuery}"`);
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="filter-off" size={48} color={colors.mutedText} style={{ marginBottom: 12 }} />
          <RNText style={styles.emptyText}>Nenhum resultado para {filterLabels.join(', ')}</RNText>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => { setFilterType('all'); setSearchQuery(''); }}
          >
            <RNText style={styles.emptyButtonText}>Limpar filtros</RNText>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="cart-off" size={48} color={colors.mutedText} style={{ marginBottom: 12 }} />
        <RNText style={styles.emptyText}>Nenhuma compra ainda</RNText>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate('ScanQRCode')}
        >
          <RNText style={styles.emptyButtonText}>Escanear cupom fiscal</RNText>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading && purchases.length === 0) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => loadPurchases(buildServerFilter(0))} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <RNText style={styles.metricLabel}>Compras</RNText>
          <RNText style={styles.metricValue}>{totalPurchases}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Total gasto</RNText>
          <RNText style={styles.metricValue}>{formatMoney(totalValue)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Ticket médio</RNText>
          <RNText style={styles.metricValue}>{formatMoney(averageTicket)}</RNText>
        </View>
      </View>
      <RNText style={styles.metricsScopeLabel}>
        {filterType === 'nfce' ? 'Totais das compras NFC-e' : filterType === 'manual' ? 'Totais das compras manuais' : 'Totais de todas as compras'}
      </RNText>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedText} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por supermercado..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.mutedText}
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.mutedText} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
          onPress={() => setFilterType('all')}
        >
          <RNText style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>Todas</RNText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'nfce' && styles.filterButtonActive]}
          onPress={() => setFilterType('nfce')}
        >
          <RNText style={[styles.filterText, filterType === 'nfce' && styles.filterTextActive]}>NFC-e</RNText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'manual' && styles.filterButtonActive]}
          onPress={() => setFilterType('manual')}
        >
          <RNText style={[styles.filterText, filterType === 'manual' && styles.filterTextActive]}>Manual</RNText>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredPurchases}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PurchaseCard
            purchase={item}
            onPress={handlePurchasePress}
            onDelete={handleDeletePurchase}
            onEdit={handleEditPurchase}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState()}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={colors.primary} />
              <RNText style={styles.footerText}>Carregando mais compras...</RNText>
            </View>
          ) : !hasMore && purchases.length > 0 ? (
            <View style={styles.listFooter}>
              <RNText style={styles.footerText}>Fim da lista</RNText>
            </View>
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddPurchase}
        color={colors.primaryText}
        accessibilityLabel="Adicionar compra manual"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  metricPurple: {
    backgroundColor: colors.secondary,
  },
  metricBlue: {
    backgroundColor: colors.info,
  },
  metricLabel: {
    color: colors.primaryText,
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricsScopeLabel: {
    fontSize: 11,
    color: colors.mutedText,
    paddingHorizontal: 16,
    marginTop: -8,
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    color: colors.mutedText,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.primaryText,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
  },
  emptyButton: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  emptyButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    backgroundColor: colors.success,
    borderRadius: 16,
  },
  listFooter: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerText: {
    color: colors.mutedText,
    fontSize: 12,
  },
});
