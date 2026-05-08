import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Avatar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context';
import { authService } from '../services';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { RootStackParamList, MainTabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import appConfig from '../../app.json';

type ProfileScreenProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'ProfileTab'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const appVersion = appConfig?.expo?.version || '0.3.0-alpha';

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      Alert.alert('Erro', 'Preencha a nova senha e a confirmação');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setIsChangingPassword(true);
    try {
      await authService.changePassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Sucesso', 'Senha alterada com sucesso');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar a senha';
      Alert.alert('Erro', message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
        <View style={styles.userCard}>
          <Avatar.Text
            size={96}
            label={user?.name ? getInitials(user.name) : 'U'}
            style={{ backgroundColor: colors.success }}
            labelStyle={{ fontSize: 28, fontWeight: '700' }}
          />
          <RNText style={styles.userName}>{user?.name || 'Usuário'}</RNText>
          <RNText style={styles.userEmail}>{user?.email || ''}</RNText>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <RNText style={styles.editProfileButtonText}>Editar perfil</RNText>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <RNText style={styles.cardTitle}>Alterar Senha</RNText>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>Nova Senha</RNText>
            <TextInput
              style={styles.inputField}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.mutedText}
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>Confirmar nova senha</RNText>
            <TextInput
              style={styles.inputField}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.mutedText}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleChangePassword}
            disabled={isChangingPassword}
          >
            {isChangingPassword
              ? <ActivityIndicator size="small" color={colors.primaryText} />
              : <RNText style={styles.saveButtonText}>Salvar senha</RNText>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <RNText style={styles.logoutButtonText}>Sair da conta</RNText>
        </TouchableOpacity>

        <RNText style={styles.versionText}>Versão {appVersion}</RNText>
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
    padding: 20,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.mutedText,
    marginBottom: 16,
  },
  editProfileButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  editProfileButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: colors.inputAltBackground,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  versionText: {
    color: colors.mutedText,
    fontSize: 12,
    textAlign: 'center',
  },
});
