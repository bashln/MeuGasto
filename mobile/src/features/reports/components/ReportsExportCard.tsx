import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

interface ReportsExportCardProps {
  onExportCSV: () => Promise<void>;
}

export const ReportsExportCard: React.FC<ReportsExportCardProps> = ({ onExportCSV }) => {
  return (
    <View style={styles.exportCard}>
      <RNText style={styles.exportTitle}>Exportar relatorio</RNText>
      <View style={styles.exportButtons}>
        <TouchableOpacity style={[styles.pdfButton, { opacity: 0.45 }]} disabled>
          <View style={styles.exportButtonContent}>
            <MaterialCommunityIcons
              name="file-pdf-box"
              size={18}
              color={colors.primaryText}
              style={styles.exportButtonIcon}
            />
            <RNText style={styles.exportButtonText}>PDF</RNText>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.excelButton} onPress={() => void onExportCSV()}>
          <View style={styles.exportButtonContent}>
            <MaterialCommunityIcons
              name="file-delimited"
              size={18}
              color={colors.primaryText}
              style={styles.exportButtonIcon}
            />
            <RNText style={styles.exportButtonText}>CSV</RNText>
          </View>
        </TouchableOpacity>
      </View>
      <RNText style={styles.disabledHint}>PDF em breve.</RNText>
    </View>
  );
};

const styles = StyleSheet.create({
  exportCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 100,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportButtonIcon: {
    marginRight: 6,
  },
  pdfButton: {
    flex: 1,
    backgroundColor: colors.info,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  excelButton: {
    flex: 1,
    backgroundColor: colors.success,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  disabledHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.mutedText,
  },
});
