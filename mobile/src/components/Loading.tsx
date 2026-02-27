import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';

interface LoadingProps {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ size = 'large', fullScreen = false }) => {
  const theme = useTheme();

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size={size} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
