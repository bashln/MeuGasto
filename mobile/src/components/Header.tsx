import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../theme/colors';

interface HeaderProps {
  title: string;
  iconName: string;
}

export const Header: React.FC<HeaderProps> = ({ title, iconName }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Icon name={iconName} size={22} color={colors.primaryText} />
        <RNText style={styles.title}>{title}</RNText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
  },
});
