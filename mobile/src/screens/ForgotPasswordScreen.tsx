import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Text as RNText,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { authService } from "../services";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { colors } from "../theme/colors";

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ForgotPassword">;
};

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const safeEmail = email.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);

    if (!safeEmail) {
      setError("Informe seu e-mail");
      return;
    }

    if (!isValidEmail) {
      setError("Digite um e-mail valido");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await authService.forgotPassword(safeEmail);
      Alert.alert(
        "Sucesso",
        "Enviamos um link de recuperação para seu e-mail.",
      );
      navigation.goBack();
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number; code?: string; name?: string };
      if (__DEV__) {
        console.error("forgotPassword error:", {
          message: errorObj?.message,
          status: errorObj?.status,
          code: errorObj?.code,
          name: errorObj?.name,
          raw: err,
        });
      }

      if (errorObj?.code === "email_address_invalid") {
        setError(
          "Esse domínio não recebe e-mails de recuperação. Use um e-mail com domínio válido.",
        );
        return;
      }

      setError("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <RNText style={styles.headerTitle}>Recuperar Senha</RNText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Esqueci minha senha</Text>
        <Text style={styles.subtitle}>
          Informe seu e-mail para receber o link de recuperação.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <RNText style={styles.errorText}>{error}</RNText>
          </View>
        ) : null}

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

        <TouchableOpacity
          style={[
            styles.submitButton,
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={isLoading}
        >
          <RNText style={styles.submitButtonText}>
            {isLoading ? "Enviando..." : "Enviar link"}
          </RNText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundAuth,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginBottom: 20,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.dangerBackground,
    marginBottom: 12,
  },
  errorText: {
    color: colors.danger,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    height: 50,
    fontSize: 15,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: colors.success,
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
});
