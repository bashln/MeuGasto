import React from 'react';
import { View, StyleSheet, Text as RNText, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface HeaderProps {
  title: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, iconName, onBack, rightElement }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 12 }] }>
      <View style={styles.content}>
        <View style={styles.leftSection}>
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
          <RNText style={styles.title} numberOfLines={1}>{title}</RNText>
        </View>

        {rightElement && (
          <View style={styles.rightSection}>
            {rightElement}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rightSection: {
    marginLeft: 12,
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
