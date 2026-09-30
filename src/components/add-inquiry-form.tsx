import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Inquiry } from '@/types';

const EVENT_TYPES = [
  'Festival',
  'Zábava',
  'Country bál',
  'Městská akce',
  'Soukromá',
  'Jiné',
];

interface Props {
  existingEvents?: Array<{ date: string; title: string }>;
  onSave: (inquiry: Omit<Inquiry, 'id'>) => void;
  onCancel: () => void;
}

export function AddInquiryForm({ existingEvents = [], onSave, onCancel }: Props) {
  const theme = useTheme();
  const { currentUser } = useAppStore();

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('Festival');
  const [location, setLocation] = useState('');

  // Datum a časy
  const [dateObj, setDateObj] = useState(new Date());
  const [startTimeObj, setStartTimeObj] = useState(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [endTimeObj, setEndTimeObj] = useState(() => {
    const d = new Date();
    d.setHours(22, 0, 0, 0);
    return d;
  });

  const [activePicker, setActivePicker] = useState<'date' | 'startTime' | 'endTime' | null>(null);

  // Kontakty - e-mail se automaticky doplní z přihlášeného účtu
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Formátování data a času
  const formatDateDDMMYYYY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const formatTime = (d: Date) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handlePickerChange = () => {
    setActivePicker(null);
  };

  // Kontrola konfliktu na vybrané datum
  const formattedSelectedDate = formatDateDDMMYYYY(dateObj);
  const conflictingEvent = existingEvents.find(e => {
    if (!e.date) return false;
    let d = e.date;
    if (d.includes('-')) {
      const parts = d.split('-');
      if (parts.length === 3) d = `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
    }
    return d === formattedSelectedDate;
  });

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Chyba', 'Vyplňte prosím název akce.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Chyba', 'Vyplňte prosím místo konání.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      Alert.alert('Chyba', 'Zadejte prosím alespoň e-mail nebo telefonní číslo pro kontakt.');
      return;
    }

    onSave({
      bandId: '',
      title: title.trim(),
      eventType,
      location: location.trim(),
      date: formattedSelectedDate,
      startTime: formatTime(startTimeObj),
      endTime: formatTime(endTimeObj),
      phone: phone.trim(),
      email: email.trim(),
      offeredPrice: offeredPrice.trim(),
      notes: notes.trim(),
      createdByUid: currentUser?.uid,
      status: 'pending',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>Nová poptávka hraní</ThemedText>

      {/* Název akce (povinné) */}
      <ThemedText type="smallBold">Název akce *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Např. Firemní večírek, Svatba, Městské slavnosti"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Druh akce (štítky) */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Druh akce *</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.one, marginBottom: Spacing.two }}>
        {EVENT_TYPES.map(type => {
          const isSelected = eventType === type;

          return (
            <Pressable
              key={type}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? '#4caf50' : 'rgba(200,200,200,0.18)',
                  borderColor: isSelected ? '#4caf50' : 'rgba(200,200,200,0.3)',
                }
              ]}
              onPress={() => setEventType(type)}
            >
              <ThemedText
                type="smallBold"
                style={{ color: isSelected ? '#fff' : theme.text, fontSize: 12 }}
              >
                {isSelected ? `✓ ${type}` : type}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Místo konání (povinné) */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>Místo konání *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={location}
        onChangeText={setLocation}
        placeholder="Např. Hotel U Růže, Klášterec nad Ohří"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Datum (DatePicker - povinné) */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Datum akce *</ThemedText>
      <Pressable
        style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        onPress={() => setActivePicker('date')}
      >
        <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={18} tintColor={theme.textSecondary} />
        <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
          {formattedSelectedDate}
        </ThemedText>
      </Pressable>

      {/* Čas od a Čas do (TimePicker - povinné) */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Čas od *</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('startTime')}
          >
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatTime(startTimeObj)}
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Čas do *</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('endTime')}
          >
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatTime(endTimeObj)}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Kontakty: Telefon a E-mail (alespoň jeden povinný) */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Telefonní číslo *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={phone}
        onChangeText={setPhone}
        placeholder="+420 777 123 456"
        placeholderTextColor={theme.textSecondary}
        keyboardType="phone-pad"
      />

      <ThemedText type="smallBold">E-mail *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={email}
        onChangeText={setEmail}
        placeholder="poradatel@email.cz"
        placeholderTextColor={theme.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Nabízená cena */}
      <ThemedText type="smallBold">Nabízená cena / Rozpočet</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={offeredPrice}
        onChangeText={setOfferedPrice}
        placeholder="Např. 20 000 Kč"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Poznámka */}
      <ThemedText type="smallBold">Poznámka ke poptávce</ThemedText>
      <TextInput
        style={[styles.input, styles.multilineInput, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Upřesňující informace o akci, zvučení, pódiu..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={3}
      />

      {/* Upozornění na předcházející plánovanou akci v daný termín */}
      {conflictingEvent && (
        <View style={styles.warningBox}>
          <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={20} tintColor="#d84315" />
          <ThemedText type="small" style={{ color: '#d84315', flex: 1, marginLeft: 8 }}>
            Na tento termín ({formattedSelectedDate}) již máme naplánovanou jinou akci ({conflictingEvent.title}). Zadejte poptávku a my se vám ozveme, zda je možné časově stíhat.
          </ThemedText>
        </View>
      )}

      {/* Akční tlačítka */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Odeslat poptávku
          </ThemedText>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six * 2 },
  title: { marginBottom: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    fontSize: 16,
  },
  multilineInput: { height: 70, textAlignVertical: 'top' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffe0b2',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  buttons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});