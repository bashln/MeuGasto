import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Text as RNText, Alert, TextInput } from 'react-native';
import { FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePurchases } from '../context';
import { Header, PurchaseCard, Loading, ErrorMessage } from '../components';
import { Purchase, PurchaseFilter } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { formatMoney } from '../utils';
import { colors } from '../theme/colors';

type PurchasesScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Purchases'>;
};

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({ navigation }) => {
  const { purchases, isLoading, error, fetchPurchases, deletePurchase } = usePurchases();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadPurchases = useCallback(async (filter?: PurchaseFilter) => {
    await fetchPurchases(filter);
  }, [fetchPurchases]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPurchases();
    setRefreshing(false);
  }, [loadPurchases]);

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
              await loadPurchases();
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
    const matchesSearch =
      purchase.supermarket?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.accessKey?.includes(searchQuery);
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'manual') return matchesSearch && purchase.isManual;
    if (filterType === 'nfce') return matchesSearch && !purchase.isManual;
    return matchesSearch;
  });

  // Métricas
  const totalPurchases = purchases?.length || 0;
  const totalValue = purchases?.reduce((sum, p) => sum + p.totalPrice, 0) || 0;
  const averageTicket = totalPurchases > 0 ? totalValue / totalPurchases : 0;

  if (isLoading && purchases.length === 0) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => loadPurchases()} />;
  }

  return (
    <View style={styles.container}>
      <Header title="Compras" iconName="cart" />

      {/* Métricas */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <RNText style={styles.metricLabel}>Total de Compras</RNText>
          <RNText style={styles.metricValue}>{totalPurchases}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Valor Total</RNText>
          <RNText style={styles.metricValue}>{formatMoney(totalValue)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Ticket Médio</RNText>
          <RNText style={styles.metricValue}>{formatMoney(averageTicket)}</RNText>
        </View>
      </View>

      {/* Campo de Busca */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedText} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar compras..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.mutedText}
        />
      </View>

      {/* Filtros */}
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

      {/* Lista de Compras */}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="cart-off" size={48} color={colors.mutedText} style={{ marginBottom: 12 }} />
            <RNText style={styles.emptyText}>Nenhuma compra encontrada</RNText>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('ScanQRCode')}
            >
              <RNText style={styles.emptyButtonText}>Escanear cupom fiscal</RNText>
            </TouchableOpacity>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddPurchase}
        color={colors.primaryText}
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
});
