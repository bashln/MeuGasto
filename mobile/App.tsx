import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider, PurchaseProvider, DraftProvider } from './src/context';
import { AppNavigator } from './src/navigation';
import { colors } from './src/theme/colors';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: '#FFD5C2',
    secondary: colors.secondary,
    secondaryContainer: '#D9D3FF',
    tertiary: colors.warning,
    tertiaryContainer: '#FEF3C7',
    error: colors.danger,
    errorContainer: colors.dangerBackground,
    background: colors.backgroundApp,
    surface: colors.surface,
    surfaceVariant: colors.surfaceAlt,
    onPrimary: colors.primaryText,
    onPrimaryContainer: '#7C2900',
    onSecondary: colors.primaryText,
    onSecondaryContainer: '#2D005E',
    onTertiary: colors.primaryText,
    onTertiaryContainer: '#7C4000',
    onError: colors.primaryText,
    onErrorContainer: colors.danger,
    onBackground: colors.text,
    onSurface: colors.text,
    onSurfaceVariant: colors.mutedText,
    outline: colors.border,
    outlineVariant: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <PurchaseProvider>
            <DraftProvider>
              <StatusBar style="light" />
              <AppNavigator />
            </DraftProvider>
          </PurchaseProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
