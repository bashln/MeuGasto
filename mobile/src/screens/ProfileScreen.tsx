import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, Alert } from 'react-native';
import {
  Text,
  Avatar,
} from 'react-native-paper';
import { useAuth } from '../context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { Header } from '../components';

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();

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
      <Header title="Perfil" iconName="account" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <RNText style={styles.heroSubtitle}>
            Gerencie suas informações pessoais e configurações de segurança
          </RNText>
        </View>

        {/* Card do Usuário */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
              <Avatar.Text
                size={120}
                label={user?.name ? getInitials(user.name) : 'U'}
                style={{ backgroundColor: colors.success }}
                labelStyle={{ fontSize: 32, fontWeight: '700' }}
              />
          </View>
          <RNText style={styles.userName}>{user?.name || 'Usuário'}</RNText>
          <RNText style={styles.userEmail}>{user?.email || ''}</RNText>
        </View>

        {/* Card Informações Pessoais */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <RNText style={styles.cardTitle}>Informações Pessoais</RNText>
            <TouchableOpacity style={styles.editButton}>
              <RNText style={styles.editButtonText}>✏️ Editar Perfil</RNText>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>Nome Completo</RNText>
            <View style={styles.inputField}>
              <RNText style={styles.inputText}>{user?.name || 'Não informado'}</RNText>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>E-mail</RNText>
            <View style={styles.inputField}>
              <RNText style={styles.inputText}>{user?.email || 'Não informado'}</RNText>
            </View>
          </View>
        </View>

        {/* Card Alterar Senha */}
        <View style={styles.infoCard}>
          <RNText style={styles.cardTitle}>Alterar Senha</RNText>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>Senha Atual</RNText>
            <View style={styles.inputField}>
              <RNText style={styles.inputPlaceholder}>••••••••</RNText>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>Nova Senha</RNText>
            <View style={styles.inputField}>
              <RNText style={styles.inputPlaceholder}>••••••••</RNText>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <RNText style={styles.inputLabel}>Confirmar nova senha</RNText>
            <View style={styles.inputField}>
              <RNText style={styles.inputPlaceholder}>••••••••</RNText>
            </View>
          </View>

          <TouchableOpacity style={styles.changePasswordButton}>
            <RNText style={styles.changePasswordButtonText}>Alterar Senha</RNText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <RNText style={styles.logoutButtonText}>Sair</RNText>
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
  scrollContent: {
    padding: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 14,
    color: colors.mutedText,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: colors.inputAltBackground,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 15,
    color: colors.text,
  },
  inputPlaceholder: {
    fontSize: 15,
    color: colors.mutedText,
  },
  changePasswordButton: {
    backgroundColor: colors.success,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  changePasswordButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: colors.danger,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
});
