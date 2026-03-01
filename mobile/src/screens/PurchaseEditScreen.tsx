import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, TextInput, Menu } from 'react-native-paper';
import { purchaseService, supermarketService } from '../services';
import { Purchase, Supermarket } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type PurchaseEditScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PurchaseEdit'>;
  route: RouteProp<RootStackParamList, 'PurchaseEdit'>;
};

export const PurchaseEditScreen: React.FC<PurchaseEditScreenProps> = ({ navigation, route }) => {
  const { purchaseId } = route.params;
  const isNewPurchase = purchaseId === 0;
  const headerTitle = isNewPurchase ? 'Compra Manual' : 'Editar Compra';
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [date, setDate] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, [purchaseId]);

  const loadData = async () => {
    try {
      if (!isNewPurchase) {
        const data = await purchaseService.getPurchaseById(purchaseId);
        setPurchase(data);
        setDate(data.date || '');
        setTotalPrice(String(data.totalPrice ?? 0));
        setSelectedSupermarketId(data.supermarket?.id ?? null);
      } else {
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setTotalPrice('');
        setSelectedSupermarketId(null);
      }

      const supermarketsResult = await supermarketService.getSupermarkets(0, 200);
      setSupermarkets(supermarketsResult.data || []);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao carregar compra');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isNewPurchase && !purchase?.isManual) {
      Alert.alert('Compra importada', 'Compras importadas via NFC-e não podem ser alteradas.');
      return;
    }

    if (!date.trim()) {
      Alert.alert('Erro', 'Informe a data da compra');
      return;
    }

    const total = Number(totalPrice.replace(',', '.'));
    if (Number.isNaN(total)) {
      Alert.alert('Erro', 'Informe um total válido');
      return;
    }

    setIsSaving(true);
    try {
      if (isNewPurchase) {
        const created = await purchaseService.createManualPurchase({
          date: date.trim(),
          totalPrice: total,
          supermarketId: selectedSupermarketId ?? undefined,
          items: [],
        });
        Alert.alert('Sucesso', 'Compra manual criada com sucesso');
        navigation.navigate('PurchaseDetail', { purchaseId: created.id });
      } else {
        await purchaseService.updatePurchase(purchaseId, {
          date: date.trim(),
          totalPrice: total,
          supermarketId: selectedSupermarketId,
        });
        Alert.alert('Sucesso', 'Compra atualizada com sucesso');
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao atualizar compra');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <RNText style={styles.backIcon}>←</RNText>
          </TouchableOpacity>
          <RNText style={styles.headerTitle}>{headerTitle}</RNText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <RNText style={styles.backIcon}>←</RNText>
        </TouchableOpacity>
        <RNText style={styles.headerTitle}>{headerTitle}</RNText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dados da compra</Text>
        <Text style={styles.subtitle}>Edite data, total e supermercado.</Text>

        <Text style={styles.label}>Data</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          mode="outlined"
          placeholder="YYYY-MM-DD"
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.input}
        />

        <Text style={styles.label}>Total</Text>
        <TextInput
          value={totalPrice}
          onChangeText={setTotalPrice}
          mode="outlined"
          keyboardType="decimal-pad"
          placeholder="0,00"
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.input}
        />

        <Text style={styles.label}>Supermercado</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity style={styles.menuAnchor} onPress={() => setMenuVisible(true)}>
              <RNText style={styles.menuText}>
                {selectedSupermarketId
                  ? supermarkets.find((s) => s.id === selectedSupermarketId)?.name || 'Selecionar'
                  : 'Sem supermercado'}
              </RNText>
              <RNText style={styles.menuCaret}>▼</RNText>
            </TouchableOpacity>
          }
        >
          <Menu.Item
            title="Sem supermercado"
            onPress={() => {
              setSelectedSupermarketId(null);
              setMenuVisible(false);
            }}
          />
          {supermarkets.map((s) => (
            <Menu.Item
              key={s.id}
              title={s.name}
              onPress={() => {
                setSelectedSupermarketId(s.id);
                setMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <RNText style={styles.saveButtonText}>
            {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </RNText>
        </TouchableOpacity>
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
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    height: 50,
    fontSize: 15,
    marginBottom: 14,
  },
  menuAnchor: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  menuText: {
    color: colors.text,
    fontSize: 15,
  },
  menuCaret: {
    color: colors.mutedText,
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: colors.success,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
