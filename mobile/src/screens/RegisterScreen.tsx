import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Text as RNText } from 'react-native';
import {
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context';
import { colors } from '../theme/colors';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type RegisterScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

const BENEFITS = [
  'Organize suas notas fiscais',
  'Acompanhe seus gastos',
  'Tudo em um só lugar',
];

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (!/[0-9]|[^A-Za-z0-9]/.test(password)) {
      setError('A senha deve conter pelo menos 1 número ou caractere especial');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register(email.trim(), password, name.trim());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta';
      if (__DEV__) {
        console.warn('Register error:', err);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.backgroundAuth }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <MaterialCommunityIcons name="receipt" size={36} color={colors.primaryText} />
          </View>
        </View>

        <View style={styles.header}>
          <RNText style={styles.title}>Criar Conta</RNText>
          <RNText style={styles.subtitle}>
            Comece a organizar suas compras hoje
          </RNText>
        </View>

        <View style={styles.formCard}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerBackground }]}>
              <RNText style={{ color: colors.danger }}>{error}</RNText>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <RNText style={styles.label}>Nome</RNText>
            <TextInput
              value={name}
              onChangeText={setName}
              mode="outlined"
              autoCapitalize="words"
              style={styles.input}
              placeholder="Seu nome completo"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </View>

          <View style={styles.inputContainer}>
            <RNText style={styles.label}>Email</RNText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
              placeholder="seu@email.com"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </View>

          <View style={styles.inputContainer}>
            <RNText style={styles.label}>Senha</RNText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              placeholder="••••••••"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
          </View>

          <View style={styles.inputContainer}>
            <RNText style={styles.label}>Confirmar Senha</RNText>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              placeholder="••••••••"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <RNText style={styles.registerButtonText}>
              {isLoading ? 'Criando conta...' : 'Criar Conta'}
            </RNText>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <RNText style={styles.footerText}>Já tem uma conta?</RNText>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <RNText style={styles.loginLink}>Fazer login</RNText>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.benefitsContainer}>
          {BENEFITS.map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <View style={styles.checkIcon}>
                <MaterialCommunityIcons name="check" size={12} color={colors.primaryText} />
              </View>
              <RNText style={styles.benefitText}>{benefit}</RNText>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subtitleText,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 10,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputAltBackground,
    borderRadius: 12,
    height: 50,
    fontSize: 15,
  },
  registerButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  registerButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: colors.mutedText,
    fontSize: 14,
  },
  loginLink: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  benefitsContainer: {
    alignItems: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  benefitText: {
    color: colors.mutedText,
    fontSize: 14,
  },
});
