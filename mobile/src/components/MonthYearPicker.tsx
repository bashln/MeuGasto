import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors } from '../theme/colors';

interface MonthYearPickerProps {
  value: { month: number; year: number };
  onChange: (value: { month: number; year: number }) => void;
  visible: boolean;
  onClose: () => void;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  onChange,
  visible,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = useState(value.year);
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const handleMonthSelect = (month: number) => {
    onChange({ month, year: selectedYear });
    onClose();
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Selecionar Mês/Ano</Text>
          </View>

          <View style={styles.yearSelector}>
            {years.map((year) => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.yearButton,
                  selectedYear === year && styles.yearButtonSelected,
                ]}
                onPress={() => handleYearSelect(year)}
              >
                <Text
                  style={[
                    styles.yearText,
                    selectedYear === year && styles.yearTextSelected,
                  ]}
                >
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.monthGrid}>
            {MONTHS.map((month, index) => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.monthButton,
                  value.month === index + 1 && selectedYear === value.year && styles.monthButtonSelected,
                ]}
                onPress={() => handleMonthSelect(index + 1)}
              >
                <Text
                  style={[
                    styles.monthText,
                    value.month === index + 1 && selectedYear === value.year && styles.monthTextSelected,
                  ]}
                >
                  {month}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 350,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  yearButtonSelected: {
    backgroundColor: colors.primary,
  },
  yearText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  yearTextSelected: {
    color: colors.primaryText,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  monthButton: {
    width: '30%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  monthButtonSelected: {
    backgroundColor: colors.primary,
  },
  monthText: {
    fontSize: 14,
    color: colors.text,
  },
  monthTextSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 12,
  },
  closeText: {
    fontSize: 16,
    color: colors.mutedText,
  },
});
