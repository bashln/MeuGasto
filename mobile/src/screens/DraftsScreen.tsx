import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, FAB, useTheme, Searchbar } from 'react-native-paper';
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
  const { drafts, isLoading, error, fetchDrafts, deleteDraft, convertToPurchase } = useDrafts();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = useCallback(async () => {
    await fetchDrafts();
  }, [fetchDrafts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  }, [loadDrafts]);

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

      <Searchbar
        placeholder="Buscar rascunhos..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

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
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Nenhum rascunho encontrado
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              Crie um rascunho para planejar suas compras
            </Text>
          </View>
        }
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
  searchbar: {
    margin: 16,
    marginBottom: 8,
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
});
