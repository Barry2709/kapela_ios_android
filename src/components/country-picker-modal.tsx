import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Modal, Pressable, FlatList, TextInput } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/utils/i18n';
import { getSortedCountries } from '@/constants/countries';

interface Props {
  visible: boolean;
  selectedCountryCode?: string;
  onSelect: (countryCode: string) => void;
  onClose: () => void;
}

export function CountryPickerModal({ visible, selectedCountryCode, onSelect, onClose }: Props) {
  const theme = useTheme();
  const { t, currentLang } = useTranslation();
  const [search, setSearch] = useState('');

  const allCountries = useMemo(() => {
    return getSortedCountries(currentLang);
  }, [currentLang]);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return allCountries;
    const term = search.toLowerCase().trim();
    return allCountries.filter(c => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term));
  }, [allCountries, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
          {/* Hlavička */}
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
              {t('band.country.modalTitle') || 'Vyberte zemi původu'}
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={22} tintColor={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Vyhledávací pole */}
          <View style={styles.searchBox}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t('band.country.searchPlaceholder') || 'Hledat zemi...'}
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <SymbolView name={{ ios: 'xmark.circle', android: 'clear', web: 'clear' }} size={16} tintColor={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Seznam zemí */}
          <FlatList
            data={filteredCountries}
            keyExtractor={item => item.code}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedCountryCode?.toUpperCase() === item.code.toUpperCase();
              return (
                <Pressable
                  style={[
                    styles.countryItem,
                    { borderBottomColor: 'rgba(150,150,150,0.15)' },
                    isSelected && { backgroundColor: 'rgba(33,150,243,0.15)' }
                  ]}
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                >
                  <ThemedText style={{ fontSize: 20, marginRight: 10 }}>{item.flag}</ThemedText>
                  <ThemedText
                    type="smallBold"
                    style={{ flex: 1, fontSize: 15, color: isSelected ? '#2196f3' : theme.text }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.name}
                  </ThemedText>
                  {isSelected && (
                    <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={18} tintColor="#2196f3" />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200,200,200,0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: Spacing.two,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    paddingBottom: Spacing.four,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
});
