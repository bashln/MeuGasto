import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Text as RNText,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { PriceComparisonSession } from '../types';
import { priceComparisonService } from '../services';
import { Header } from '../components';
import { colors } from '../theme/colors';


type SavedComparisonScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SavedComparison'>;
};

export const SavedComparisonScreen: React.FC<SavedComparisonScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<PriceComparisonSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const data = await priceComparisonService.getActiveSessions();
      setSessions(data);
    } catch (error) {
      console.error('[SavedComparison] Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
  }, [loadSessions]);

  const handleDeleteSession = (session: PriceComparisonSession) => {
    Alert.alert('Excluir Sessão', 'Tem certeza? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await priceComparisonService.deleteSession(session.id);
            setSessions(prev => prev.filter(s => s.id !== session.id));
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir a sessão.');
          }
        },
      },
    ]);
  };

  const formatExpiry = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expirando hoje';
    if (days === 1) return 'Expira amanhã';
    return `${days} dias restantes`;
  };

  const renderSession = ({ item }: { item: PriceComparisonSession }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => navigation.navigate('ComparisonSessionDetail', { sessionId: item.id })}
      onLongPress={() => handleDeleteSession(item)}
    >
      <View style={styles.sessionHeader}>
        <MaterialCommunityIcons name="scale-balance" size={20} color={colors.primary} />
        <RNText style={styles.sessionTitle} numberOfLines={1}>{item.title}</RNText>
      </View>
      <View style={styles.sessionMeta}>
        <RNText style={styles.sessionDate}>
          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
        </RNText>
        <RNText style={styles.sessionExpiry}>{formatExpiry(item.expiresAt)}</RNText>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title="Comparações Salvas"
        iconName="scale-balance"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id.toString()}
          renderItem={renderSession}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cart-off" size={48} color={colors.mutedText} />
              <RNText style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                Nenhuma comparação salva
              </RNText>
              <RNText style={{ color: colors.mutedText, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, marginTop: 4 }}>
                Use o Comparador de Preços e salve suas sessões para consultar depois.
              </RNText>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => navigation.navigate('PriceComparator')}
              >
                <RNText style={styles.ctaButtonText}>Ir para Comparador</RNText>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundApp,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    fontSize: 12,
    color: colors.mutedText,
  },
  sessionExpiry: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 4,
  },
  ctaButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  ctaButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
});
