import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
  Text as RNText,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useDrafts } from '../context';
import { DraftCard, Header } from '../components';
import { Draft, ShoppingList, ShoppingListItem } from '../types';
import { shoppingListService } from '../services';
import { colors } from '../theme/colors';
import { formatMoney } from '../utils';

const TopTab = createMaterialTopTabNavigator();

// ─── Drafts Tab ──────────────────────────────────────────────
const DraftsTab: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    drafts,
    isLoading,
    isLoadingMore,
    hasMore,
    page,
    fetchDrafts,
    loadMoreDrafts,
    deleteDraft,
  } = useDrafts();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const PAGE_SIZE = 20;

  const buildServerFilter = useCallback((pageNumber = 0) => ({
    page: pageNumber,
    size: PAGE_SIZE,
  }), []);

  const loadDrafts = useCallback(async () => {
    await fetchDrafts(buildServerFilter(0));
  }, [fetchDrafts, buildServerFilter]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  }, [loadDrafts]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore) return;
    const nextPage = (page?.pageNumber ?? 0) + 1;
    await loadMoreDrafts(buildServerFilter(nextPage));
  }, [buildServerFilter, hasMore, isLoading, isLoadingMore, loadMoreDrafts, page?.pageNumber]);

  const handleDraftPress = (draft: Draft) => {
    navigation.navigate('DraftDetail', { draftId: draft.id });
  };

  const handleDeleteDraft = (draft: Draft) => {
    Alert.alert('Excluir Rascunho', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteDraft(draft.id) },
    ]);
  };

  const handleAddDraft = () => {
    navigation.navigate('DraftDetail', { draftId: 0 });
  };

  const filteredDrafts = drafts.filter((d) => {
    const content = d.content.toLowerCase();
    const market = d.supermarket?.name?.toLowerCase() || '';
    return content.includes(searchQuery.toLowerCase()) || market.includes(searchQuery.toLowerCase());
  });

  if (isLoading && drafts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.tabContainer}>
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedText} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar rascunhos..."
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

      <FlatList
        data={filteredDrafts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <DraftCard
            draft={item}
            onPress={handleDraftPress}
            onDelete={handleDeleteDraft}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="note-multiple-outline" size={48} color={colors.mutedText} />
            <Text variant="bodyLarge" style={{ color: colors.mutedText, marginTop: 12 }}>
              Nenhum rascunho encontrado
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
              <RNText style={styles.footerText}>Carregando...</RNText>
            </View>
          ) : !hasMore && drafts.length > 0 ? (
            <View style={styles.footer}>
              <RNText style={styles.footerText}>Fim da lista</RNText>
            </View>
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.success }]}
        onPress={handleAddDraft}
        color={colors.primaryText}
      />
    </View>
  );
};

// ─── Shopping List Tab ──────────────────────────────────────
const ShoppingListTab: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnit, setItemUnit] = useState('UN');
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    loadOrCreateActiveList();
  }, []);

  const loadOrCreateActiveList = async () => {
    try {
      setLoading(true);
      const lists = await shoppingListService.getShoppingLists('active');
      if (lists.length > 0) {
        const detailedList = await shoppingListService.getShoppingListById(lists[0].id);
        setActiveList(detailedList);
        setItems(detailedList.items || []);
      } else {
        const newList = await shoppingListService.createShoppingList('Minha Lista de Compras');
        setActiveList(newList);
        setItems([]);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar a lista de compras.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!itemName.trim() || !activeList) {
      Alert.alert('Aviso', 'Digite o nome do item.');
      return;
    }
    const qty = parseFloat(itemQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Aviso', 'Quantidade inválida.');
      return;
    }
    try {
      setAddingItem(true);
      const newItem = await shoppingListService.addShoppingListItem(activeList.id, itemName.trim(), qty, itemUnit);
      setItems(prev => [...prev, newItem]);
      setItemName('');
      setItemQuantity('1');
      setItemUnit('UN');
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar o item.');
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await shoppingListService.deleteShoppingListItem(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch {
      Alert.alert('Erro', 'Não foi possível excluir o item.');
    }
  };

  const estimatedTotal = items.reduce((acc, item) => acc + item.quantity * item.estimatedPrice, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.tabContainer}
    >
      <View style={styles.budgetCard}>
        <View style={styles.budgetTexts}>
          <RNText style={styles.budgetLabel}>Custo Estimado do Carrinho</RNText>
          <RNText style={styles.budgetValue}>{formatMoney(estimatedTotal)}</RNText>
        </View>
        <TouchableOpacity
          style={styles.budgetScanButton}
          onPress={() => navigation.navigate('ScanQRCode', { fromShoppingList: true, shoppingListId: activeList?.id })}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.input, styles.inputName]}
            placeholder="Nome do item (ex: Leite, Arroz...)"
            placeholderTextColor={colors.mutedText}
            value={itemName}
            onChangeText={setItemName}
          />
          <TextInput
            style={[styles.input, styles.inputQty]}
            placeholder="Qtd"
            placeholderTextColor={colors.mutedText}
            keyboardType="numeric"
            value={itemQuantity}
            onChangeText={setItemQuantity}
          />
          <TouchableOpacity
            style={styles.unitSelector}
            onPress={() => {
              const nextUnit = itemUnit === 'UN' ? 'KG' : itemUnit === 'KG' ? 'L' : 'UN';
              setItemUnit(nextUnit);
            }}
          >
            <RNText style={styles.unitSelectorText}>{itemUnit}</RNText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddItem} disabled={addingItem}>
            {addingItem ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <MaterialCommunityIcons name="plus" size={22} color={colors.primaryText} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <RNText style={styles.itemName}>{item.name}</RNText>
              <RNText style={styles.itemDetails}>
                {item.quantity} {item.unit} • {item.estimatedPrice > 0 ? `Méd: ${formatMoney(item.estimatedPrice)}` : 'Sem histórico'}
              </RNText>
            </View>
            <View style={styles.itemPriceArea}>
              <RNText style={styles.itemSubtotal}>{formatMoney(item.quantity * item.estimatedPrice)}</RNText>
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteButton}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="playlist-plus" size={64} color={colors.mutedText} />
            <RNText style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 8 }}>
              Sua lista está vazia
            </RNText>
            <RNText style={{ color: colors.mutedText, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, marginTop: 4 }}>
              Adicione itens que pretende comprar.
            </RNText>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
};

// ─── Planning Screen (top-level) ─────────────────────────────
type PlanningScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Planning'>;
};

export const PlanningScreen: React.FC<PlanningScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Header title="Planejamento" iconName="clipboard-list" onBack={() => navigation.goBack()} />
      <TopTab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0 },
          tabBarLabelStyle: { fontSize: 14, fontWeight: '600', textTransform: 'none' },
          tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 3 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedText,
        }}
      >
        <TopTab.Screen
          name="DraftsTab"
          component={DraftsTab}
          options={{ tabBarLabel: 'Rascunhos', tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="note-multiple" size={18} color={color} />
          )}}
        />
        <TopTab.Screen
          name="ShoppingListTab"
          component={ShoppingListTab}
          options={{ tabBarLabel: 'Lista', tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="playlist-check" size={18} color={color} />
          )}}
        />
      </TopTab.Navigator>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  tabContainer: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundApp,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  budgetCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  budgetTexts: {
    flex: 1,
  },
  budgetLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  budgetValue: {
    color: colors.primaryText,
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 4,
  },
  budgetScanButton: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  formCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.text,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputName: {
    flex: 2.5,
  },
  inputQty: {
    flex: 0.8,
    textAlign: 'center',
  },
  unitSelector: {
    flex: 0.8,
    backgroundColor: colors.inputAltBackground,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitSelectorText: {
    fontWeight: 'bold',
    color: colors.text,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: colors.secondary,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemInfo: {
    flex: 1.5,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  itemDetails: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
  itemPriceArea: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
  },
  itemSubtotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  deleteButton: {
    padding: 4,
  },
});
