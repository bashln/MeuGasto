import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, TextInput, ActivityIndicator, Text as RNText } from 'react-native';
import { Text, FAB, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDrafts } from '../context';
import { DraftCard, Header, Loading, ErrorMessage } from '../components';
import { Rascunho } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type DraftsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Drafts'>;
};

export const DraftsScreen: React.FC<DraftsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { drafts, isLoading, isLoadingMore, hasMore, page, error, fetchDrafts, loadMoreDrafts, deleteDraft } = useDrafts();
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
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    const nextPage = (page?.pageNumber ?? 0) + 1;
    await loadMoreDrafts(buildServerFilter(nextPage));
  }, [buildServerFilter, hasMore, isLoading, isLoadingMore, loadMoreDrafts, page?.pageNumber]);

  const handleDraftPress = (draft: Rascunho) => {
    navigation.navigate('DraftDetail', { draftId: draft.id });
  };

  const handleDeleteDraft = (draft: Rascunho) => {
    Alert.alert(
      'Excluir Rascunho',
      'Tem certeza que deseja excluir este rascunho?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteDraft(draft.id),
        },
      ]
    );
  };

  const handleAddDraft = () => {
    navigation.navigate('DraftDetail', { draftId: 0 });
  };

  const filteredDrafts = drafts.filter((draft) => {
    const content = draft.conteudo.toLowerCase();
    const supermarketName = draft.supermarket?.name?.toLowerCase() || '';
    return (
      content.includes(searchQuery.toLowerCase()) ||
      supermarketName.includes(searchQuery.toLowerCase())
    );
  });

  if (isLoading && drafts.length === 0) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => loadDrafts()} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundApp }]}>
      <Header title="Rascunhos" iconName="note-multiple" />

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedText} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar rascunhos..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.mutedText}
        />
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
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="note-multiple-outline" size={48} color={colors.mutedText} style={{ marginBottom: 12 }} />
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Nenhum rascunho encontrado
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              Crie um rascunho para planejar suas compras
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={colors.primary} />
              <RNText style={styles.footerText}>Carregando mais rascunhos...</RNText>
            </View>
          ) : !hasMore && drafts.length > 0 ? (
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
        style={[styles.fab, { backgroundColor: colors.success }]}
        onPress={handleAddDraft}
        color={colors.primaryText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  list: {
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
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
