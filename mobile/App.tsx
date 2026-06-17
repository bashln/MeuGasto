import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider, PurchaseProvider, DraftProvider } from './src/context';
import { AppNavigator } from './src/navigation';
import { colors } from './src/theme/colors';
import { useUpdateCheck } from './src/hooks';
import { UpdateDialog } from './src/components';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://4b1ab5dc065445ec86934a7c27917bc1@o4511272174157824.ingest.de.sentry.io/4511577484820560',

  // Privacy: no PII, no logs, no session replay
  sendDefaultPii: false,
  enableLogs: false,

  // Session replay fully disabled for privacy
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
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

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <UpdateChecker />
        <AuthProvider>
          <PurchaseProvider>
            <DraftProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </DraftProvider>
          </PurchaseProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
});
