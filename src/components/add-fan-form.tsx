import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/utils/i18n';
import { Fan } from '@/types';

interface Props {
  initialFan?: Fan;
  onSave: (fan: Omit<Fan, 'id' | 'joinedAt'>) => void;
  onCancel: () => void;
}

export function AddFanForm({ initialFan, onSave, onCancel }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [name, setName] = useState(initialFan?.name || '');
  const [email, setEmail] = useState(initialFan?.email || '');
  const [phone, setPhone] = useState(initialFan?.phone || '');
  const [note, setNote] = useState(initialFan?.note || '');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('home.attendance.errorTitle'), t('fans.errorReq'));
      return;
    }

    onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>
          {initialFan ? (t('fans.editTitle') || 'Upravit fanouška') : (t('fans.addTitle') || 'Přidat nového fanouška')}
        </ThemedText>
        <Pressable onPress={onCancel} style={styles.closeBtn}>
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Jméno */}
        <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
          {t('fans.form.name') || 'Jméno fanouška *'}
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
          value={name}
          onChangeText={setName}
          placeholder="Jan Novák"
          placeholderTextColor={theme.textSecondary}
        />

        {/* E-mail */}
        <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
          {t('fans.form.email')}
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
          value={email}
          onChangeText={setEmail}
          placeholder="jan.novak@email.cz"
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Telefon */}
        <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
          {t('fans.form.phone')}
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="+420 777 123 456"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
        />

        {/* Poznámka */}
        <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
          {t('fans.form.note') || 'Interní poznámka (volitelná)'}
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', height: 80 }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('fans.form.notePlaceholder') || 'např. VIP člen, potkali jsme na koncertě v Praze...'}
          placeholderTextColor={theme.textSecondary}
          multiline
        />

        {/* Akční tlačítka */}
        <View style={styles.actions}>
          <Pressable style={[styles.btn, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('home.misc.cancel')}</ThemedText>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('setlist.saveBtn')}</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingBottom: Spacing.six,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
