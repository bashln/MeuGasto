import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  Surface,
  IconButton,
  List,
  Divider,
  Card,
} from 'react-native-paper';
import { useDrafts, usePurchases } from '../context';
import { draftService } from '../services';
import { Rascunho } from '../types';
import { formatMoney, formatDate } from '../utils';
import { Loading, ErrorMessage } from '../components';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type DraftDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DraftDetail'>;
  route: RouteProp<RootStackParamList, 'DraftDetail'>;
};

interface DraftItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

export const DraftDetailScreen: React.FC<DraftDetailScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { draftId } = route.params;
  const { getDraft, createDraft, updateDraft, deleteDraft } = useDrafts();
  
  const [draft, setDraft] = useState<Rascunho | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [conteudo, setConteudo] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [newItem, setNewItem] = useState<DraftItem>({ name: '', quantity: 1, unit: 'un', price: 0 });

  const isNewDraft = draftId === 0 || draftId === undefined;

  useEffect(() => {
    if (!isNewDraft) {
      loadDraft();
    } else {
      setIsLoading(false);
    }
  }, [draftId]);

  const loadDraft = async () => {
    try {
      const data = await getDraft(draftId);
      setDraft(data);
      setConteudo(data.conteudo);
      // Parse items from conteudo or set empty if not available
      setItems([]);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar rascunho');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!conteudo.trim()) {
      Alert.alert('Erro', 'Preencha o conteúdo do rascunho');
      return;
    }

    setIsSaving(true);

    try {
      if (isNewDraft) {
        await createDraft({ conteudo, items });
      } else {
        await updateDraft(draftId, { conteudo, items });
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao salvar rascunho');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir Rascunho',
      'Tem certeza que deseja excluir este rascunho?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(draftId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Erro ao excluir');
            }
          },
        },
      ]
    );
  };

  const addItem = () => {
    if (!newItem.name.trim()) {
      Alert.alert('Erro', 'Nome do item é obrigatório');
      return;
    }
    setItems([...items, newItem]);
    setNewItem({ name: '', quantity: 1, unit: 'un', price: 0 });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error && !isNewDraft) {
    return <ErrorMessage message={error} onRetry={loadDraft} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundApp }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.formCard} elevation={2}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            {isNewDraft ? 'Novo Rascunho' : 'Editar Rascunho'}
          </Text>

          <TextInput
            label="Descrição"
            value={conteudo}
            onChangeText={setConteudo}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          {!isNewDraft && draft && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Criado em: {formatDate(draft.createdAt)}
            </Text>
          )}
        </Surface>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Itens
        </Text>

        <Card style={styles.itemsCard} mode="elevated">
          {items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Nenhum item adicionado
              </Text>
            </View>
          ) : (
            items.map((item, index) => (
              <React.Fragment key={index}>
                <List.Item
                  title={item.name}
                  description={`${item.quantity} ${item.unit} x ${formatMoney(item.price)}`}
                  right={() => (
                    <View style={styles.itemActions}>
                      <Text variant="bodyMedium">{formatMoney(item.price * item.quantity)}</Text>
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => removeItem(index)}
                      />
                    </View>
                  )}
                />
                {index < items.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </Card>

        <Surface style={styles.addItemCard} elevation={2}>
          <Text variant="titleSmall" style={styles.cardTitle}>
            Adicionar Item
          </Text>
          
          <TextInput
            label="Nome"
            value={newItem.name}
            onChangeText={(text) => setNewItem({ ...newItem, name: text })}
            mode="outlined"
            style={styles.input}
          />

          <View style={styles.row}>
            <TextInput
              label="Qtd"
              value={newItem.quantity.toString()}
              onChangeText={(text) => setNewItem({ ...newItem, quantity: parseFloat(text) || 0 })}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
            <TextInput
              label="Unidade"
              value={newItem.unit}
              onChangeText={(text) => setNewItem({ ...newItem, unit: text })}
              mode="outlined"
              style={[styles.input, styles.smallInput]}
            />
            <TextInput
              label="Preço"
              value={newItem.price.toString()}
              onChangeText={(text) => setNewItem({ ...newItem, price: parseFloat(text) || 0 })}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
          </View>

          <Button mode="contained" onPress={addItem} icon="plus">
            Adicionar
          </Button>
        </Surface>

        <Surface style={styles.totalCard} elevation={2}>
          <Text variant="titleMedium">Total Estimado</Text>
          <Text variant="headlineMedium" style={{ color: colors.primary }}>
            {formatMoney(totalPrice)}
          </Text>
        </Surface>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
          >
            Salvar
          </Button>

          {!isNewDraft && (
            <Button
              mode="outlined"
              onPress={handleDelete}
              textColor={theme.colors.error}
              style={styles.deleteButton}
            >
              Excluir
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  scrollContent: {
    padding: 16,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  cardTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  emptyItems: {
    padding: 24,
    alignItems: 'center',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addItemCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  smallInput: {
    flex: 1,
  },
  totalCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  actions: {
    gap: 12,
  },
  saveButton: {
    paddingVertical: 4,
  },
  deleteButton: {
    borderColor: colors.danger,
  },
});
