import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Absence, BandMember } from '@/types';

interface Props {
  members: BandMember[];
  onCheckConflicts?: (from: string, to: string) => string[];
  onSave: (absence: Omit<Absence, 'id'>) => void;
  onCancel: () => void;
}

export function AddAbsenceForm({ members, onCheckConflicts, onSave, onCancel }: Props) {
  const theme = useTheme();
  const { currentUser, activeRoleView } = useAppStore();

  const [dateFromObj, setDateFromObj] = useState(new Date());
  const [dateToObj, setDateToObj] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const [activePicker, setActivePicker] = useState<'from' | 'to' | null>(null);

  const formatDateDDMMYYYY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Default selection to current user if found in members
  const matchedMember = members.find(m => m.email === currentUser?.email || m.id === currentUser?.uid || m.firstName === currentUser?.displayName);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(matchedMember ? matchedMember.id : '');

  const isAdmin = activeRoleView === 'admin';

  // Make the current user first in the list for admin picker
  const sortedMembers = [...members];
  if (isAdmin && matchedMember) {
    const idx = sortedMembers.findIndex(m => m.id === matchedMember.id);
    if (idx > 0) {
      sortedMembers.splice(idx, 1);
      sortedMembers.unshift(matchedMember);
    }
  }

  const handleSave = () => {
    if (!reason) {
      Alert.alert('Chyba', 'Vyplňte prosím důvod absence.');
      return;
    }

    let mId = selectedMemberId;
    let mName = currentUser?.displayName || 'Neznámý člen';

    if (isAdmin) {
      if (!mId) {
        Alert.alert('Chyba', 'Vyberte člena, kterého se absence týká.');
        return;
      }
      const m = members.find(x => x.id === mId);
      if (m) {
        mName = `${m.firstName} ${m.lastName}`.trim() || m.nickname || m.firstName;
      }
    } else {
      if (matchedMember) {
        mId = matchedMember.id;
        mName = `${matchedMember.firstName} ${matchedMember.lastName}`.trim() || matchedMember.nickname || matchedMember.firstName;
      } else {
        mId = currentUser?.uid || '';
      }
    }

    onSave({
      bandId: '',
      memberId: mId,
      memberName: mName,
      dateFrom: formatDateDDMMYYYY(dateFromObj),
      dateTo: formatDateDDMMYYYY(dateToObj),
      reason,
      note,
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setActivePicker(null);
    if (selectedDate && activePicker) {
      let newFrom = dateFromObj;
      let newTo = dateToObj;
      if (activePicker === 'from') {
        newFrom = selectedDate;
        newTo = new Date(selectedDate);
        setDateFromObj(newFrom);
        setDateToObj(newTo);
      } else {
        newTo = selectedDate;
        setDateToObj(newTo);
      }

      if (onCheckConflicts) {
        const fStr = formatDateDDMMYYYY(newFrom);
        const tStr = formatDateDDMMYYYY(newTo);
        const conflicts = onCheckConflicts(fStr, tStr);
        if (conflicts.length > 0) {
          Alert.alert(
            'Upozornění na událost během absence',
            `V tomto termínu (${fStr} - ${tStr}) se již koná:\n\n${conflicts.map(c => `• ${c}`).join('\n')}`
          );
        }
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>Přidat absenci</ThemedText>

      {isAdmin && (
        <>
          <ThemedText type="smallBold">Vyberte člena *</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {sortedMembers.map((m) => {
              const isSelected = selectedMemberId === m.id;
              const mName = `${m.firstName} ${m.lastName}`.trim() || m.nickname;
              return (
                <Pressable
                  key={m.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? '#4caf50' : 'rgba(200,200,200,0.18)',
                      borderColor: isSelected ? '#4caf50' : 'rgba(200,200,200,0.3)',
                    }
                  ]}
                  onPress={() => setSelectedMemberId(m.id)}
                >
                  <ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 13 }}>
                    {mName}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {!isAdmin && (
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.four, textAlign: 'center' }}>
          Zadáváte absenci pro člena: {currentUser?.displayName}
        </ThemedText>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Datum od *</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('from')}
          >
            <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatDateDDMMYYYY(dateFromObj)}
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Datum do *</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('to')}
          >
            <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatDateDDMMYYYY(dateToObj)}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>Důvod (např. dovolená, nemoc) *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={reason}
        onChangeText={setReason}
        placeholder="Např. Dovolená"
        placeholderTextColor={theme.textSecondary}
      />

      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>Poznámka</ThemedText>
      <TextInput
        style={[styles.input, styles.multilineInput, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={note}
        onChangeText={setNote}
        placeholder="Volitelná poznámka..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={3}
      />

      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Uložit absenci
          </ThemedText>
        </Pressable>
      </View>

      {activePicker && (
        <DateTimePicker
          value={activePicker === 'from' ? dateFromObj : dateToObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {Platform.OS === 'ios' && activePicker && (
        <Pressable style={{ alignSelf: 'flex-end', padding: 8, marginTop: 8 }} onPress={() => setActivePicker(null)}>
          <ThemedText type="smallBold" style={{ color: '#2196f3' }}>Zavřít kalendář</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six * 2 },
  title: { marginBottom: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three },
  chipScroll: { marginBottom: Spacing.four, marginTop: Spacing.one },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 16,
  },
  multilineInput: { height: 80, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
