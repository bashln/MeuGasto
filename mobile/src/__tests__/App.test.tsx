jest.mock('../context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  PurchaseProvider: ({ children }: { children: React.ReactNode }) => children,
  DraftProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../navigation', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    AppNavigator: ({ onReady }: { onReady?: () => void }) => (
      <View testID="app-navigator" onLayout={onReady} />
    ),
  };
});

jest.mock('../hooks', () => ({
  useUpdateCheck: () => ({
    updateInfo: null,
    dismiss: jest.fn(),
  }),
}));

jest.mock('../components', () => ({
  UpdateDialog: () => null,
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(true),
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('react-native-paper', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => children,
  MD3LightTheme: { colors: {} },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import App from '../../App';

describe('App bootstrap shell', () => {
  const mockHideAsync = SplashScreen.hideAsync as jest.Mock;
  const mockPreventAutoHideAsync = SplashScreen.preventAutoHideAsync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the root app container', async () => {
    let renderer: any = null;

    await act(async () => {
      renderer = TestRenderer.create(<App />);
    });

    const rootView = renderer!.root.findAllByType(View)[0];
    expect(rootView).toBeDefined();

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('hides the splash after the first app layout', async () => {
    let renderer: any;

    await act(async () => {
      renderer = TestRenderer.create(<App />);
    });

    const navigatorView = renderer!.root.findByProps({ testID: 'app-navigator' });

    await act(async () => {
      navigatorView.props.onLayout?.();
    });

    expect(mockHideAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('falls back to hiding the splash when layout does not fire', async () => {
    let renderer: any;

    await act(async () => {
      renderer = TestRenderer.create(<App />);
    });

    await act(async () => {
      jest.advanceTimersByTime(12000);
    });

    expect(mockHideAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.unmount();
    });
  });
});
