import React from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text as RNText,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from '../navigation/types';
import { colors } from "../theme/colors";

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ForgotPassword">;
};

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
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
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="lock-reset" size={44} color={colors.primary} />
          </View>
          <Text style={styles.title}>Redefinição de Senha</Text>
          
          <RNText style={styles.infoText}>
            A recuperação automática de senha por e-mail não está ativa no aplicativo.
          </RNText>

          <RNText style={styles.instructions}>
            Se você esqueceu ou deseja alterar suas credenciais de acesso, entre em contato com o administrador do sistema.
          </RNText>

          <View style={styles.tipBox}>
            <MaterialCommunityIcons name="lightbulb-on" size={20} color={colors.primary} style={styles.tipIcon} />
            <RNText style={styles.tipText}>
              A senha pode ser redefinida rapidamente pelo administrador através do painel de controle do Supabase.
            </RNText>
          </View>
        </View>

        <TouchableOpacity
          style={styles.backButtonLarge}
          onPress={() => navigation.goBack()}
        >
          <RNText style={styles.backButtonLargeText}>
            Voltar para o Login
          </RNText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  header: {
    backgroundColor: colors.primary,
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
    flex: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 24,
  },
  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 12,
    lineHeight: 22,
  },
  instructions: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  tipBox: {
    flexDirection: "row",
    backgroundColor: colors.inputBackground,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  tipIcon: {
    marginRight: 10,
  },
  tipText: {
    fontSize: 12,
    color: colors.mutedText,
    flex: 1,
    lineHeight: 16,
  },
  backButtonLarge: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  backButtonLargeText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
});
