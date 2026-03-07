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

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const BENEFITS = [
  'Controle seus gastos mensais',
  'Organize suas compras',
  'Emita relatórios personalizados',
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      if (__DEV__) {
        console.warn('Login error:', err);
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
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <MaterialCommunityIcons name="receipt" size={36} color={colors.primaryText} />
          </View>
        </View>

        <View style={styles.header}>
          <RNText style={styles.title}>MeuGasto</RNText>
          <RNText style={styles.subtitle}>
            Cadastre suas compras via nota fiscal
          </RNText>
        </View>

        <View style={styles.formCard}>
          <RNText style={styles.formTitle}>Entrar</RNText>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerBackground }]}> 
              <RNText style={{ color: colors.danger }}>{error}</RNText>
            </View>
          ) : null}

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

          <TouchableOpacity style={styles.forgotButton} onPress={() => navigation.navigate('ForgotPassword')}>
            <RNText style={styles.forgotText}>Esqueci minha senha</RNText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <RNText style={styles.loginButtonText}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </RNText>
          </TouchableOpacity>

          <View style={styles.dividerWithText}>
            <View style={styles.dividerLine} />
            <RNText style={styles.dividerText}>ou</RNText>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { opacity: 0.45 }]}
            disabled={true}
          >
            <RNText style={styles.googleButtonText}>Continuar com Google</RNText>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <RNText style={styles.footerText}>Ainda não tem conta?</RNText>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <RNText style={styles.registerLink}>Cadastre-se</RNText>
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
    paddingTop: 60,
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
    marginBottom: 26,
  },
  title: {
    fontSize: 28,
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
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  forgotText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 18,
  },
  loginButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerWithText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.mutedText,
    marginHorizontal: 12,
    fontSize: 14,
  },
  googleButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  googleButtonText: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: '500',
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
  registerLink: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
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
