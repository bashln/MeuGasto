import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { shoppingListService } from '../services';
import { ShoppingList, ShoppingListItem } from '../types';
import { colors } from '../theme/colors';
import { formatMoney } from '../utils';
import { Header } from '../components';

type ShoppingListScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ShoppingList'>;
};

export const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);

  // Form fields
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
        // Load existing active list
        const detailedList = await shoppingListService.getShoppingListById(lists[0].id);
        setActiveList(detailedList);
        setItems(detailedList.items || []);
      } else {
        // Auto-create default active list if none exists
        const newList = await shoppingListService.createShoppingList('Minha Lista de Compras');
        setActiveList(newList);
        setItems([]);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar ou criar a lista de compras.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!itemName.trim() || !activeList) {
      Alert.alert('Aviso', 'Por favor, digite o nome do item.');
      return;
    }

    const qty = parseFloat(itemQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Aviso', 'Digite uma quantidade válida maior que zero.');
      return;
    }

    try {
      setAddingItem(true);
      const newItem = await shoppingListService.addShoppingListItem(
        activeList.id,
        itemName.trim(),
        qty,
        itemUnit
      );

      setItems((prev) => [...prev, newItem]);
      setItemName('');
      setItemQuantity('1');
      setItemUnit('UN');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível adicionar o item.');
      console.error(error);
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await shoppingListService.deleteShoppingListItem(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível excluir o item.');
      console.error(error);
    }
  };

  const estimatedTotal = items.reduce((acc, item) => acc + item.quantity * item.estimatedPrice, 0);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando sua lista de compras...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Lista de Compras"
        iconName="clipboard-list"
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ScanQRCode', {
                fromShoppingList: true,
                shoppingListId: activeList?.id,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Escanear nota fiscal para comparar"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.primaryText} />
          </TouchableOpacity>
        }
      />

      {/* Estimativa de Preço Total */}
      <View style={styles.budgetCard}>
        <View style={styles.budgetTexts}>
          <Text style={styles.budgetLabel}>Custo Estimado do Carrinho</Text>
          <Text style={styles.budgetValue}>{formatMoney(estimatedTotal)}</Text>
        </View>
        <View style={styles.budgetBadge}>
          <MaterialCommunityIcons name="lightbulb-on" size={16} color={colors.warning} />
          <Text style={styles.budgetBadgeText}>Preditivo</Text>
        </View>
      </View>

      {/* Input Form */}
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
            <Text style={styles.unitSelectorText}>{itemUnit}</Text>
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

      {/* Items List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity} {item.unit} •{' '}
                {item.estimatedPrice > 0
                  ? `Méd. Histórica: ${formatMoney(item.estimatedPrice)}`
                  : 'Sem histórico de preço'}
              </Text>
            </View>
            <View style={styles.itemPriceArea}>
              <Text style={styles.itemSubtotal}>
                {formatMoney(item.quantity * item.estimatedPrice)}
              </Text>
              <TouchableOpacity
                onPress={() => handleDeleteItem(item.id)}
                style={styles.deleteButton}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="playlist-plus" size={64} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>Sua lista está vazia</Text>
            <Text style={styles.emptyText}>
              Adicione itens que pretende comprar para obter o custo total estimado.
            </Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundApp,
  },
  loadingText: {
    marginTop: 12,
    color: colors.mutedText,
    fontSize: 15,
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  actionButton: {
    padding: 6,
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
  },
  budgetCard: {
    margin: 16,
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
  budgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
  },
  budgetBadgeText: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: 'bold',
  },
  formCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
  listContent: {
    padding: 16,
    paddingTop: 8,
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
    borderBottomColor: colors.border,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});
