import React from 'react';
import { View, StyleSheet, Text as RNText, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface HeaderProps {
  title: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, iconName, onBack }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 12 }] }>
      <View style={styles.content}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primaryText} />
          </TouchableOpacity>
        ) : (
          <MaterialCommunityIcons name={iconName} size={22} color={colors.primaryText} />
        )}
        <RNText style={styles.title}>{title}</RNText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    padding: 2,
  },
  title: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
  },
});
