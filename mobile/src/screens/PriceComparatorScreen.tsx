import React, { useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text as RNText, TouchableOpacity, View, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Header, ItemInputRow } from '../components';
import { RootStackParamList } from '../navigation/types';
import { Item } from '../types';
import { findCheapestItem } from '../utils';
import { priceComparisonService, shoppingListService } from '../services';
import { colors } from '../theme/colors';

type PriceComparatorScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PriceComparator'>;
};

const createDefaultItem = (id: number): Item => ({
  id,
  name: '',
  price: 0,
  quantity: 1,
  unit: 'un',
});

export const PriceComparatorScreen: React.FC<PriceComparatorScreenProps> = ({ navigation }) => {
  const [items, setItems] = useState<Item[]>([createDefaultItem(1)]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [importingList, setImportingList] = useState(false);

  const addItem = () => {
    setItems((current) => {
      const nextId = current.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
      return [...current, createDefaultItem(nextId)];
    });
  };

  const removeItem = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateItem = (id: number, updates: Partial<Item>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const clearAll = () => {
    setItems([]);
  };

  const cheapestItemId = useMemo(() => findCheapestItem(items)?.id, [items]);

  const handleImportFromList = useCallback(async () => {
    try {
      setImportingList(true);
      const lists = await shoppingListService.getShoppingLists('active');
      if (lists.length === 0) {
        Alert.alert('Sem lista ativa', 'Crie uma lista no Planejamento primeiro.');
        return;
      }
      const detailedList = await shoppingListService.getShoppingListById(lists[0].id);
      const items = detailedList.items || [];
      if (items.length === 0) {
        Alert.alert('Lista vazia', 'A lista ativa não possui itens.');
        return;
      }

      let nextId = 0;
      const newItems: Item[] = items.map((li) => {
        nextId += 1;
        return {
          id: nextId,
          name: li.name,
          price: li.estimatedPrice,
          quantity: li.quantity,
          unit: li.unit.toLowerCase(),
        };
      });

      setItems(newItems);
      Alert.alert('Importado', `${newItems.length} itens importados da lista de compras.`);
    } catch {
      Alert.alert('Erro', 'Não foi possível importar da lista.');
    } finally {
      setImportingList(false);
    }
  }, []);

  const handleSaveSession = useCallback(async () => {
    const validItems = items.filter((i) => i.name.trim() && i.price > 0);
    if (validItems.length === 0) {
      Alert.alert('Nada para salvar', 'Adicione itens com nome e preço antes de salvar.');
      return;
    }
    setSaveModalVisible(true);
    setSessionTitle(`Comparação ${new Date().toLocaleDateString('pt-BR')}`);
  }, [items]);

  const confirmSaveSession = useCallback(async () => {
    const title = sessionTitle.trim() || `Comparação ${new Date().toLocaleDateString('pt-BR')}`;
    const validItems = items.filter((i) => i.name.trim() && i.price > 0);

    try {
      setSaving(true);
      const session = await priceComparisonService.createSession(title);
      const quote = await priceComparisonService.addQuote(
        session.id,
        'Comparação Atual',
      );
      await priceComparisonService.copyItemsToQuote(
        quote.id,
        validItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          price: i.price,
        })),
      );
      setSaveModalVisible(false);
      setSessionTitle('');
      Alert.alert('Salvo', 'Sessão salva com sucesso!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a sessão.');
    } finally {
      setSaving(false);
    }
  }, [sessionTitle, items, navigation]);

  return (
    <View style={styles.container}>
      <Header title="Comparador de Preços" iconName="scale-balance" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <RNText style={styles.title}>Compare preços e salve para consultar depois</RNText>
        <RNText style={styles.subtitle}>
          Adicione produtos, ajuste quantidade e unidade, e veja automaticamente qual item tem o melhor custo por unidade.
        </RNText>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={addItem}
            testID="price-comparator-add-item-button"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.primaryText} />
            <RNText style={styles.addButtonText}>Adicionar Item</RNText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAll}
            testID="price-comparator-clear-button"
          >
            <MaterialCommunityIcons name="broom" size={18} color={colors.text} />
            <RNText style={styles.clearButtonText}>Limpar Tudo</RNText>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleImportFromList}
            disabled={importingList}
          >
            <MaterialCommunityIcons name="playlist-check" size={16} color={colors.primary} />
            <RNText style={styles.secondaryButtonText}>
              {importingList ? 'Importando...' : 'Importar da Lista'}
            </RNText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.saveButton]}
            onPress={handleSaveSession}
          >
            <MaterialCommunityIcons name="content-save" size={16} color={colors.primaryText} />
            <RNText style={[styles.secondaryButtonText, { color: colors.primaryText }]}>
              Salvar Sessão
            </RNText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.savedLink}
          onPress={() => navigation.navigate('SavedComparison')}
        >
          <MaterialCommunityIcons name="folder-multiple-outline" size={16} color={colors.info} />
          <RNText style={styles.savedLinkText}>Ver comparações salvas</RNText>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.info} />
        </TouchableOpacity>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-off" size={32} color={colors.mutedText} />
            <RNText style={styles.emptyText}>Nenhum item para comparar.</RNText>
            <RNText style={styles.emptyHint}>{'Toque em "Adicionar Item" ou importe da sua lista.'}</RNText>
          </View>
        ) : (
          items.map((item, idx) => (
            <ItemInputRow
              key={item.id}
              item={item}
              index={idx}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              isCheapest={item.id === cheapestItemId}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={saveModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <RNText style={styles.modalTitle}>Salvar Sessão de Comparação</RNText>
            <TextInput
              style={styles.modalInput}
              placeholder="Título da sessão"
              placeholderTextColor={colors.mutedText}
              value={sessionTitle}
              onChangeText={setSessionTitle}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setSaveModalVisible(false)}
              >
                <RNText style={styles.modalCancelText}>Cancelar</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmSaveSession}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primaryText} />
                ) : (
                  <RNText style={styles.modalConfirmText}>Salvar</RNText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.success,
    paddingVertical: 10,
  },
  addButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 13,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
  },
  clearButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyHint: {
    marginTop: 4,
    color: colors.mutedText,
    fontSize: 12,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
  },
  savedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
    paddingVertical: 8,
  },
  savedLinkText: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: colors.inputBackground,
    color: colors.text,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
});
