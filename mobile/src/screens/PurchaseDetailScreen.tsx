import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Chip, useTheme, Surface, Divider, IconButton, Button, Menu, Portal, Dialog, RadioButton, TextInput } from 'react-native-paper';
import { purchaseService } from '../services';
import { Purchase } from '../types';
import { formatMoney, formatDate, compareItems, PriceComparisonResult } from '../utils';
import { Loading, ErrorMessage, Header, PriceComparisonCard } from '../components';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { CATEGORY_IDS, PRODUCT_CATEGORY_OPTIONS } from '../services/productCategoryRules';

type PurchaseDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PurchaseDetail'>;
  route: RouteProp<RootStackParamList, 'PurchaseDetail'>;
};

export const PurchaseDetailScreen: React.FC<PurchaseDetailScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { purchaseId } = route.params;
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PriceComparisonResult | null>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(0);
  const [secondItemIndex, setSecondItemIndex] = useState(1);
  const [firstItemMenuVisible, setFirstItemMenuVisible] = useState(false);
  const [secondItemMenuVisible, setSecondItemMenuVisible] = useState(false);
  const [itemBeingReclassified, setItemBeingReclassified] = useState<Purchase['products'][number] | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(CATEGORY_IDS.OUTROS);
  const [isSavingReclassification, setIsSavingReclassification] = useState(false);
  const [itemBeingEdited, setItemBeingEdited] = useState<Purchase['products'][number] | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [isSavingItemEdit, setIsSavingItemEdit] = useState(false);

  const loadPurchase = useCallback(async () => {
    try {
      const data = await purchaseService.getPurchaseById(purchaseId);
      setPurchase(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar compra';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    loadPurchase();
  }, [loadPurchase]);

  useEffect(() => {
    const products = purchase?.products ?? [];
    if (products.length >= 2) {
      setFirstItemIndex(0);
      setSecondItemIndex(1);
    }
    setComparisonResult(null);
  }, [purchase?.id, purchase?.products]);

  const handleDelete = () => {
    Alert.alert(
      'Excluir Compra',
      'Tem certeza que deseja excluir esta compra?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await purchaseService.deletePurchase(purchaseId);
              navigation.goBack();
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Erro ao excluir';
              Alert.alert('Erro', message);
            }
          },
        },
      ]
    );
  };

  const handleComparePrices = () => {
    const products = purchase?.products ?? [];
    const item1 = products[firstItemIndex];
    const item2 = products[secondItemIndex];

    if (!item1 || !item2) {
      Alert.alert('Comparação', 'Selecione dois itens válidos para comparar.');
      return;
    }

    if (firstItemIndex === secondItemIndex) {
      Alert.alert('Comparação', 'Selecione dois itens diferentes para comparar.');
      return;
    }

    try {
      const result = compareItems(item1, item2);
      setComparisonResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao comparar itens';
      Alert.alert('Comparação', message);
    }
  };

  const openReclassificationModal = (item: Purchase['products'][number]) => {
    setItemBeingReclassified(item);
    setSelectedCategoryId(item.categoryId ?? CATEGORY_IDS.OUTROS);
  };

  const closeReclassificationModal = () => {
    if (isSavingReclassification) {
      return;
    }

    setItemBeingReclassified(null);
  };

  const handleConfirmReclassification = async () => {
    if (!itemBeingReclassified) {
      return;
    }

    try {
      setIsSavingReclassification(true);
      await purchaseService.reclassifyPurchaseItem(itemBeingReclassified.id, itemBeingReclassified.name, selectedCategoryId);

      setPurchase((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          products: (current.products ?? []).map((product) =>
            product.id === itemBeingReclassified.id
              ? { ...product, categoryId: selectedCategoryId }
              : product
          ),
        };
      });

      setItemBeingReclassified(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao reclassificar item';
      Alert.alert('Reclassificação', message);
    } finally {
      setIsSavingReclassification(false);
    }
  };

  const openItemEditModal = (item: Purchase['products'][number]) => {
    if (!purchase?.isManual) {
      return;
    }
    setItemBeingEdited(item);
    setEditItemName(item.name);
    setEditItemQuantity(String(item.quantity));
    setEditItemPrice(String(item.price));
  };

  const closeItemEditModal = () => {
    if (isSavingItemEdit) {
      return;
    }
    setItemBeingEdited(null);
  };

  const handleSaveItemEdit = async () => {
    if (!purchase || !itemBeingEdited) {
      return;
    }

    const parsedQuantity = Number(editItemQuantity.replace(',', '.'));
    const parsedPrice = Number(editItemPrice.replace(',', '.'));

    if (!editItemName.trim()) {
      Alert.alert('Editar item', 'Informe o nome do item.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Editar item', 'Informe uma quantidade válida maior que zero.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Editar item', 'Informe um preço unitário válido.');
      return;
    }

    try {
      setIsSavingItemEdit(true);
      const updatedPurchase = await purchaseService.editItem(purchase.id, itemBeingEdited.id, {
        name: editItemName.trim(),
        quantity: parsedQuantity,
        price: parsedPrice,
      });
      setPurchase(updatedPurchase);
      setItemBeingEdited(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao editar item';
      Alert.alert('Editar item', message);
    } finally {
      setIsSavingItemEdit(false);
    }
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !purchase) {
    return <ErrorMessage message={error || 'Compra não encontrada'} onRetry={loadPurchase} />;
  }

  const products = purchase.products ?? [];
  const selectedItem1 = products[firstItemIndex];
  const selectedItem2 = products[secondItemIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundApp }]}>
      <Header title="Detalhes da Compra" iconName="cart" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text variant="headlineSmall" style={styles.supermarketName}>
                {purchase.supermarket?.name || 'Supermercado'}
              </Text>
              {purchase.supermarket?.city && purchase.supermarket?.state && (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {purchase.supermarket.city} - {purchase.supermarket.state}
                </Text>
              )}
            </View>
            <IconButton
              icon="delete"
              iconColor={theme.colors.error}
              onPress={handleDelete}
            />
          </View>

          <Chip
            mode="flat"
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          >
            {purchase.isManual ? 'Manual' : 'NFC-e'}
          </Chip>
          {!purchase.isManual && (
            <Chip mode="outlined" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              Somente leitura
            </Chip>
          )}

          <Divider style={styles.divider} />

          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Data
            </Text>
            <Text variant="bodyLarge">{formatDate(purchase.date)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={{ color: colors.mutedText }}>
              Total
            </Text>
            <Text variant="headlineSmall" style={{ color: colors.primary }}>
              {formatMoney(purchase.totalPrice)}
            </Text>
          </View>

          {purchase.accessKey && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={{ color: colors.mutedText }}>
                Chave de Acesso
              </Text>
              <Text variant="bodySmall" numberOfLines={2}>
                {purchase.accessKey}
              </Text>
            </View>
          )}
        </Surface>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Itens ({purchase.products?.length ?? 0})
        </Text>

        <Card style={styles.itemsCard} mode="elevated">
          {products.map((item, index) => (
            <React.Fragment key={item.id || index}>
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => openItemEditModal(item)}
                disabled={!purchase.isManual}
                activeOpacity={purchase.isManual ? 0.7 : 1}
              >
                <View style={styles.itemInfo}>
                  <Text variant="bodyLarge">
                    {item.quantity}x {item.name} {formatMoney(item.price)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.mutedText }}>
                    Valor unitário
                  </Text>
                  {purchase.isManual ? (
                    <Button
                      mode="text"
                      compact
                      contentStyle={styles.reclassifyButtonContent}
                      style={styles.reclassifyButton}
                      onPress={() => openReclassificationModal(item)}
                    >
                      Reclassificar
                    </Button>
                  ) : (
                    <Text variant="bodySmall" style={styles.readOnlyHint}>
                      Item não editável (NFC-e)
                    </Text>
                  )}
                </View>
                <Text variant="titleMedium" style={{ color: colors.primary }}>
                  {formatMoney(item.price * item.quantity)}
                </Text>
              </TouchableOpacity>
              {index < products.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Card>

        {products.length >= 2 && (
          <Surface style={styles.comparisonSurface} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Regra de 3</Text>
            <Text variant="bodyMedium" style={styles.helperText}>
              Selecione dois itens para comparar o preço por unidade padrão.
            </Text>

            <Menu
              visible={firstItemMenuVisible}
              onDismiss={() => setFirstItemMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setFirstItemMenuVisible(true)}
                >
                  <Text variant="bodyMedium" numberOfLines={1}>
                    Item 1: {selectedItem1?.name || 'Selecionar item'}
                  </Text>
                </TouchableOpacity>
              }
            >
              {products.map((item, index) => (
                <Menu.Item
                  key={`compare-first-${item.id}-${index}`}
                  title={item.name}
                  onPress={() => {
                    setFirstItemIndex(index);
                    setFirstItemMenuVisible(false);
                  }}
                />
              ))}
            </Menu>

            <Menu
              visible={secondItemMenuVisible}
              onDismiss={() => setSecondItemMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setSecondItemMenuVisible(true)}
                >
                  <Text variant="bodyMedium" numberOfLines={1}>
                    Item 2: {selectedItem2?.name || 'Selecionar item'}
                  </Text>
                </TouchableOpacity>
              }
            >
              {products.map((item, index) => (
                <Menu.Item
                  key={`compare-second-${item.id}-${index}`}
                  title={item.name}
                  onPress={() => {
                    setSecondItemIndex(index);
                    setSecondItemMenuVisible(false);
                  }}
                />
              ))}
            </Menu>

            <Button mode="contained-tonal" onPress={handleComparePrices} style={styles.compareButton}>
              Comparar Preços
            </Button>

            {comparisonResult && selectedItem1 && selectedItem2 && (
              <PriceComparisonCard
                comparison={comparisonResult}
                item1={selectedItem1}
                item2={selectedItem2}
              />
            )}
          </Surface>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={!!itemBeingEdited} onDismiss={closeItemEditModal}>
          <Dialog.Title>Editar item</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nome"
              mode="outlined"
              value={editItemName}
              onChangeText={setEditItemName}
              style={styles.dialogInput}
            />
            <TextInput
              label="Quantidade"
              mode="outlined"
              keyboardType="decimal-pad"
              value={editItemQuantity}
              onChangeText={setEditItemQuantity}
              style={styles.dialogInput}
            />
            <TextInput
              label="Preço unitário"
              mode="outlined"
              keyboardType="decimal-pad"
              value={editItemPrice}
              onChangeText={setEditItemPrice}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeItemEditModal} disabled={isSavingItemEdit}>Cancelar</Button>
            <Button onPress={handleSaveItemEdit} loading={isSavingItemEdit}>Salvar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!itemBeingReclassified} onDismiss={closeReclassificationModal}>
          <Dialog.Title>Reclassificar produto</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogDescription}>
              {itemBeingReclassified?.name}
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setSelectedCategoryId(Number(value))}
              value={String(selectedCategoryId)}
            >
              {PRODUCT_CATEGORY_OPTIONS.map((category) => (
                <TouchableOpacity
                  key={`category-option-${category.id}`}
                  style={styles.categoryOptionRow}
                  onPress={() => setSelectedCategoryId(category.id)}
                >
                  <RadioButton value={String(category.id)} />
                  <Text variant="bodyMedium">{category.label}</Text>
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeReclassificationModal} disabled={isSavingReclassification}>Cancelar</Button>
            <Button onPress={handleConfirmReclassification} loading={isSavingReclassification}>
              Salvar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  supermarketName: {
    fontWeight: '600',
  },
  divider: {
    marginVertical: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  itemsCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  reclassifyButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginLeft: -8,
  },
  reclassifyButtonContent: {
    height: 28,
  },
  readOnlyHint: {
    marginTop: 8,
    color: colors.mutedText,
  },
  comparisonSurface: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  helperText: {
    marginBottom: 12,
    color: colors.mutedText,
  },
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  compareButton: {
    marginTop: 2,
  },
  dialogDescription: {
    marginBottom: 10,
    color: colors.mutedText,
  },
  dialogInput: {
    marginBottom: 10,
  },
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
