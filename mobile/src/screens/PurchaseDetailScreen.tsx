import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, useTheme, Surface, Divider, IconButton, Button } from 'react-native-paper';
import { purchaseService } from '../services';
import { Purchase } from '../types';
import { formatMoney, formatDate } from '../utils';
import { Loading, ErrorMessage, Header } from '../components';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

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

  useEffect(() => {
    loadPurchase();
  }, [purchaseId]);

  const loadPurchase = async () => {
    try {
      const data = await purchaseService.getPurchaseById(purchaseId);
      setPurchase(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar compra');
    } finally {
      setIsLoading(false);
    }
  };

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
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Erro ao excluir');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !purchase) {
    return <ErrorMessage message={error || 'Compra não encontrada'} onRetry={loadPurchase} />;
  }

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
          {(purchase.products ?? []).map((item, index) => (
            <React.Fragment key={item.id || index}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text variant="bodyLarge">{item.name}</Text>
                  <Text variant="bodySmall" style={{ color: colors.mutedText }}>
                    {item.quantity} {item.unit} x {formatMoney(item.price)}
                  </Text>
                </View>
                <Text variant="titleMedium" style={{ color: colors.primary }}>
                  {formatMoney(item.price * item.quantity)}
                </Text>
              </View>
              {index < purchase.products.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Card>
      </ScrollView>
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
});
