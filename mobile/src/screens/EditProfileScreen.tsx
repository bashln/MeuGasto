import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text as RNText,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TextInput } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, MainTabParamList } from '../types';
import { useAuth } from '../context';
import { authService } from '../services';
import { colors } from '../theme/colors';

type EditProfileScreenProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Erro', 'O nome não pode ficar em branco');
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateProfile(name.trim());
      updateUser({ ...user, name: name.trim() });
      navigation.goBack();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar as alterações';
      Alert.alert('Erro', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <RNText style={styles.headerTitle}>Editar Perfil</RNText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          label="Nome"
          value={name}
          onChangeText={setName}
          mode="outlined"
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.input}
        />

        <TextInput
          label="E-mail"
          value={user?.email ?? ''}
          mode="outlined"
          disabled
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.input}
        />
        <RNText style={styles.helperText}>Não é possível alterar o e-mail</RNText>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <RNText style={styles.saveButtonText}>Salvar alterações</RNText>
          )}
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
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
  input: {
    backgroundColor: colors.inputBackground,
    marginBottom: 14,
  },
  helperText: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: -10,
    marginBottom: 20,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: colors.success,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
