import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text as RNText, View } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamilies, typography } from '../theme/typography';

interface AppBootScreenProps {
  onReady?: () => void;
}

export const AppBootScreen: React.FC<AppBootScreenProps> = ({ onReady }) => {
  return (
    <View style={styles.container} onLayout={onReady}>
      <View style={styles.brandBlock}>
        {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
        <Image source={require('../../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
        <RNText style={styles.title}>Meu Gasto</RNText>
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
  brandBlock: {
    alignItems: 'center',
  },
  logo: {
    width: 136,
    height: 136,
  },
  title: {
    marginTop: 20,
    fontSize: typography.hero,
    fontFamily: fontFamilies.brandSemiBold,
    color: colors.text,
    letterSpacing: 0.12,
  },
  spinner: {
    marginTop: 26,
  },
});
