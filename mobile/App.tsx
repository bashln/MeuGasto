import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider, PurchaseProvider, DraftProvider } from './src/context';
import { AppNavigator } from './src/navigation';
import { colors } from './src/theme/colors';
import { useUpdateCheck } from './src/hooks';
import { UpdateDialog } from './src/components';

const SPLASH_HIDE_FALLBACK_MS = 12000;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore repeated preventAutoHide calls during fast refresh
});

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

const UpdateChecker: React.FC = () => {
  const { updateInfo, dismiss } = useUpdateCheck();
  if (!updateInfo) return null;
  return <UpdateDialog updateInfo={updateInfo} onDismiss={dismiss} />;
};

export default function App() {
  const hasHiddenSplashRef = useRef(false);
  const [fontsLoaded, fontError] = useFonts({
    'IBMPlexSerif-Regular': require('./assets/fonts/IBMPlexSerif-Regular.ttf'),
    'IBMPlexSerif-SemiBold': require('./assets/fonts/IBMPlexSerif-SemiBold.ttf'),
  });
  const isBrandFontReady = fontsLoaded || Boolean(fontError);

  const hideSplash = () => {
    if (hasHiddenSplashRef.current) {
      return;
    }

    hasHiddenSplashRef.current = true;
    void SplashScreen.hideAsync().catch(() => {
      // ignore if the native splash was already hidden by the fallback path
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(hideSplash, SPLASH_HIDE_FALLBACK_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  if (!isBrandFontReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.root} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <PaperProvider theme={theme}>
          <UpdateChecker />
          <AuthProvider>
            <PurchaseProvider>
              <DraftProvider>
                <StatusBar style="auto" />
                <AppNavigator onReady={hideSplash} />
              </DraftProvider>
            </PurchaseProvider>
          </AuthProvider>
        </PaperProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundAuth,
  },
});
