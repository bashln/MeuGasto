import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider, PurchaseProvider, DraftProvider } from './src/context';
import { AppNavigator } from './src/navigation';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976d2',
    primaryContainer: '#bbdefb',
    secondary: '#388e3c',
    secondaryContainer: '#c8e6c9',
    tertiary: '#f57c00',
    tertiaryContainer: '#ffe0b2',
    error: '#d32f2f',
    errorContainer: '#ffcdd2',
    background: '#fafafa',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#0d47a1',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#1b5e20',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#e65100',
    onError: '#ffffff',
    onErrorContainer: '#b71c1c',
    onBackground: '#212121',
    onSurface: '#212121',
    onSurfaceVariant: '#757575',
    outline: '#bdbdbd',
    outlineVariant: '#e0e0e0',
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
