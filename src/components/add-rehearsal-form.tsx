import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Rehearsal } from '@/types';

interface Props {
  initialRehearsal?: Rehearsal;
  onSave: (rehearsal: Omit<Rehearsal, 'id'>) => void;
  onCancel: () => void;
}

export function AddRehearsalForm({ initialRehearsal, onSave, onCancel }: Props) {
  const theme = useTheme();

  const parseInitialDate = () => {
    if (!initialRehearsal?.date) return new Date();
    try {
      let str = initialRehearsal.date;
      if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) {
          str = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      if (initialRehearsal.time) {
        str += `T${initialRehearsal.time}:00`;
      }
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch (e) {
      return new Date();
    }
  };

  const [dateObj, setDateObj] = useState(parseInitialDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [location, setLocation] = useState(initialRehearsal?.location || 'Zkušebna');
  const [whatToPrepare, setWhatToPrepare] = useState(initialRehearsal?.whatToPrepare || '');
  const [isCancelled, setIsCancelled] = useState(initialRehearsal?.isCancelled || false);

  const formatDateDDMMYYYY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const formatDateCzech = (d: Date) => {
    return d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  const formatTime = (d: Date) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateObj(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateObj(selectedDate);
    }
  };

  const setPresetTime = (hours: number, minutes: number) => {
    const newDate = new Date(dateObj);
    newDate.setHours(hours, minutes);
    setDateObj(newDate);
  };

  const addPresetText = (text: string) => {
    if (!whatToPrepare) {
      setWhatToPrepare(text);
    } else if (!whatToPrepare.includes(text)) {
      setWhatToPrepare(`${whatToPrepare}, ${text}`);
    }
  };

  const handleSave = () => {
    if (!location) {
      Alert.alert('Chyba', 'Vyplňte prosím místo konání zkoušky.');
      return;
    }

    onSave({
      bandId: '',
      date: formatDateDDMMYYYY(dateObj),
      time: formatTime(dateObj),
      location,
      whatToPrepare,
      isCancelled,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>
        {initialRehearsal ? 'Upravit zkoušku' : 'Naplánovat zkoušku'}
      </ThemedText>

      {/* Rámce pro Datum a Čas vedle sebe */}
      <View style={styles.row}>
        {/* Výběr data */}
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Datum zkoušky *</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatDateCzech(dateObj)}
            </ThemedText>
          </Pressable>
        </View>

        {/* Výběr času */}
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Čas *</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setShowTimePicker(true)}
          >
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatTime(dateObj)}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Rychlé předvolby času */}
      <View style={styles.presetRow}>
        <ThemedText type="small" themeColor="textSecondary">Rychlý čas:</ThemedText>
        {[
          { label: '18:00', h: 18, m: 0 },
          { label: '18:30', h: 18, m: 30 },
          { label: '19:00', h: 19, m: 0 },
          { label: '19:30', h: 19, m: 30 },
        ].map(item => (
          <Pressable
            key={item.label}
            style={[styles.chip, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]}
            onPress={() => setPresetTime(item.h, item.m)}
          >
            <ThemedText type="small" style={{ fontSize: 11 }}>{item.label}</ThemedText>
          </Pressable>
        ))}
      </View>



      {/* Místo konání */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>Místo konání *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={location}
        onChangeText={setLocation}
        placeholder="Např. Zkušebna Klášterec"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Zobrazení DateTimePickeru pro datum (Android + iOS) */}
      {showDatePicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {Platform.OS === 'ios' && showDatePicker && (
        <Pressable style={{ alignSelf: 'flex-end', padding: 8 }} onPress={() => setShowDatePicker(false)}>
          <ThemedText type="smallBold" style={{ color: '#2196f3' }}>Zavřít kalendář</ThemedText>
        </Pressable>
      )}

      {/* Zobrazení DateTimePickeru pro čas (Android + iOS) */}
      {showTimePicker && (
        <DateTimePicker
          value={dateObj}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      {Platform.OS === 'ios' && showTimePicker && (
        <Pressable style={{ alignSelf: 'flex-end', padding: 8 }} onPress={() => setShowTimePicker(false)}>
          <ThemedText type="smallBold" style={{ color: '#2196f3' }}>Zavřít hodiny</ThemedText>
        </Pressable>
      )}

      {/* Rychlá tlačítka pro místo */}
      <View style={styles.presetRow}>
        <ThemedText type="small" themeColor="textSecondary">Častá místa:</ThemedText>
        {['Zkušebna', 'Klub', 'Sál'].map(place => (
          <Pressable
            key={place}
            style={[styles.chip, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]}
            onPress={() => setLocation(place)}
          >
            <ThemedText type="small" style={{ fontSize: 11 }}>{place}</ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Co připravit na zkoušku */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>Co připravit na zkoušku</ThemedText>
      <TextInput
        style={[styles.input, styles.multilineInput, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={whatToPrepare}
        onChangeText={setWhatToPrepare}
        placeholder="Např. Písničky 1-5, vyzkoušet vícehlasy v refrénu..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={3}
      />

      {/* Rychlé návrhy pro co připravit */}
      <View style={[styles.presetRow, { flexWrap: 'wrap' }]}>
        {['Nové písničky 1-5', 'Zpěvy v refrénu', 'Vzít si noty', 'Příprava na koncert'].map(tip => (
          <Pressable
            key={tip}
            style={[styles.chip, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]}
            onPress={() => addPresetText(tip)}
          >
            <ThemedText type="small" style={{ fontSize: 11 }}>+ {tip}</ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Stav zkoušky - Zrušeno */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.four, padding: Spacing.three, borderRadius: Spacing.two, backgroundColor: 'rgba(200,200,200,0.12)' }}>
        <View>
          <ThemedText type="smallBold">Stav zkoušky</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Označit zkoušku jako zrušenou</ThemedText>
        </View>
        <Pressable
          style={[
            styles.chip,
            {
              backgroundColor: isCancelled ? '#e91e63' : 'rgba(200,200,200,0.18)',
              borderColor: isCancelled ? '#e91e63' : 'rgba(200,200,200,0.3)',
              paddingVertical: 6,
              paddingHorizontal: 14,
            }
          ]}
          onPress={() => setIsCancelled(!isCancelled)}
        >
          <ThemedText type="smallBold" style={{ color: isCancelled ? '#fff' : theme.text }}>
            {isCancelled ? '🚫 Zrušeno' : '✅ Platí'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Tlačítka Zrušit formulář a Uložit zkoušku */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Zavřít</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            {initialRehearsal ? 'Uložit zkoušku' : 'Naplánovat zkoušku'}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
  },
  title: {
    marginBottom: Spacing.four,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 16,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});