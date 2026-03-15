import React from 'react';
import { View, Text as RNText, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';

interface PeriodOption {
  label: string;
  value: '3months' | '6months' | '12months' | 'year';
}

interface PeriodFilterProps {
  selectedPeriod: '3months' | '6months' | '12months' | 'year';
  onPeriodChange: (period: '3months' | '6months' | '12months' | 'year') => void;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: '3M', value: '3months' },
  { label: '6M', value: '6months' },
  { label: '12M', value: '12months' },
  { label: 'Ano', value: 'year' },
];

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  selectedPeriod,
  onPeriodChange,
}) => {
  return (
    <View style={styles.container}>
      {PERIOD_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.button,
            selectedPeriod === option.value && styles.buttonSelected,
          ]}
          onPress={() => onPeriodChange(option.value)}
        >
          <RNText
            style={[
              styles.buttonText,
              selectedPeriod === option.value && styles.buttonTextSelected,
            ]}
          >
            {option.label}
          </RNText>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
  },
  buttonSelected: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  buttonTextSelected: {
    color: colors.primaryText,
  },
});
