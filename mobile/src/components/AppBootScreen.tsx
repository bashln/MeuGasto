import React from 'react';
import { ActivityIndicator, StyleSheet, Text as RNText, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export const AppBootScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.logoIcon}>
        <MaterialCommunityIcons name="receipt" size={36} color={colors.primaryText} />
      </View>
      <RNText style={styles.title}>MeuGasto</RNText>
      <RNText style={styles.subtitle}>Preparando seu acesso...</RNText>
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
    backgroundColor: colors.backgroundApp,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.mutedText,
  },
  spinner: {
    marginTop: 24,
  },
});
