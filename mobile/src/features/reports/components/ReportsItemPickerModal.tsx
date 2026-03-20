import React from 'react';
import { Modal, View, FlatList, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { formatMoney } from '../../../utils';

interface ReportsItemPickerModalProps {
  visible: boolean;
  topItems: Array<{ name: string; quantity: number; total: number; percentage: number }>;
  selectedItem: string;
  onClose: () => void;
  onSelectItem: (itemName: string) => void;
}

export const ReportsItemPickerModal: React.FC<ReportsItemPickerModalProps> = ({
  visible,
  topItems,
  selectedItem,
  onClose,
  onSelectItem,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <RNText style={styles.modalTitle}>Selecionar item</RNText>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={topItems}
            keyExtractor={(item) => item.name}
            style={styles.pickerList}
            ListEmptyComponent={
              <View style={styles.emptyPickerContainer}>
                <RNText style={styles.emptyPickerText}>
                  Nenhum item com compras no periodo. Amplie o periodo ou ajuste o ano.
                </RNText>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, selectedItem === item.name && styles.pickerItemSelected]}
                onPress={() => onSelectItem(item.name)}
              >
                <RNText style={[styles.pickerItemName, selectedItem === item.name && styles.pickerItemNameSelected]}>
                  {item.name}
                </RNText>
                <RNText style={[styles.pickerItemTotal, selectedItem === item.name && styles.pickerItemTotalSelected]}>
                  {formatMoney(item.total)}
                </RNText>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  pickerList: {
    marginBottom: 20,
  },
  emptyPickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyPickerText: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary,
  },
  pickerItemName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  pickerItemNameSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  pickerItemTotal: {
    fontSize: 14,
    color: colors.mutedText,
  },
  pickerItemTotalSelected: {
    color: colors.primaryText,
  },
});
