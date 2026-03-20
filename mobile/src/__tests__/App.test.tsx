jest.mock('../context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  PurchaseProvider: ({ children }: { children: React.ReactNode }) => children,
  DraftProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../navigation', () => ({
  AppNavigator: () => null,
}));

jest.mock('../hooks', () => ({
  useUpdateCheck: () => ({
    updateInfo: null,
    dismiss: jest.fn(),
  }),
}));

jest.mock('../components', () => ({
  UpdateDialog: () => null,
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
import App from '../../App';

describe('App bootstrap shell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
