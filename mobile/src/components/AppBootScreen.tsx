import React from 'react';
import { ActivityIndicator, StyleSheet, Text as RNText, View } from 'react-native';
import { colors } from '../theme/colors';

interface AppBootScreenProps {
  onReady?: () => void;
}

export const AppBootScreen: React.FC<AppBootScreenProps> = ({ onReady }) => {
  return (
    <View style={styles.container} onLayout={onReady}>
      <View style={styles.titleBlock}>
        <RNText style={styles.title}>Meu Gasto</RNText>
        <RNText style={styles.subtitle}>Carregando...</RNText>
      </View>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.backgroundAuth,
  },
  titleBlock: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    color: colors.mutedText,
  },
  spinner: {
    marginTop: 28,
  },
});
