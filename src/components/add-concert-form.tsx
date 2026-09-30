import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform, Switch } from 'react-native';
import { SymbolView } from 'expo-symbols';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Concert } from '@/types';
import { SetlistEditorModal } from './setlist-editor-modal';

interface Props {
  initialConcert?: Concert;
  onSave: (concert: Omit<Concert, 'id'>) => void;
  onCancel: () => void;
}

export function AddConcertForm({ initialConcert, onSave, onCancel }: Props) {
  const theme = useTheme();
  const { activeBand } = useAppStore();
  const whatToTakePresets = activeBand?.whatToTakePresets || [];

  const [selectedWhatToTake, setSelectedWhatToTake] = useState<string[]>(
    initialConcert?.whatToTake || []
  );

  const [setlist, setSetlist] = useState<string[]>(initialConcert?.setlist || []);
  const [showSetlistEditor, setShowSetlistEditor] = useState(false);

  const toggleWhatToTakeItem = (item: string) => {
    if (selectedWhatToTake.includes(item)) {
      setSelectedWhatToTake(selectedWhatToTake.filter(i => i !== item));
    } else {
      setSelectedWhatToTake([...selectedWhatToTake, item]);
    }
  };

  const parseInitialDate = () => {
    if (!initialConcert?.date) return new Date();
    try {
      let str = initialConcert.date;
      if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) {
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      }
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch (e) {
      return new Date();
    }
  };

  const parseTimeStr = (str?: string, defaultH = 20, defaultM = 0) => {
    const d = new Date();
    d.setHours(defaultH, defaultM, 0, 0);
    if (!str) return d;
    try {
      const parts = str.split(':');
      if (parts.length >= 2) {
        d.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
      }
    } catch (e) {}
    return d;
  };

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

  const [title, setTitle] = useState(initialConcert?.title || '');
  const [isPrivate, setIsPrivate] = useState(initialConcert?.isPrivate || false);
  const [isCancelled, setIsCancelled] = useState(initialConcert?.isCancelled || false);

  // Datum a časy jako objekty Date
  const [dateObj, setDateObj] = useState(parseInitialDate());
  const [startTimeObj, setStartTimeObj] = useState(parseTimeStr(initialConcert?.startTime, 20, 0));
  const [endTimeObj, setEndTimeObj] = useState(parseTimeStr(initialConcert?.endTime, 22, 0));

  // Místo, Cena a odjezd
  const [location, setLocation] = useState(initialConcert?.location || '');
  const [price, setPrice] = useState(initialConcert?.price || '');
  const [departureTimeObj, setDepartureTimeObj] = useState(parseTimeStr(initialConcert?.departureTime, 17, 0));
  const [departureLocation, setDepartureLocation] = useState(initialConcert?.departureLocation || 'Zkušebna');

  // Zvukovka
  const [soundCheckFromObj, setSoundCheckFromObj] = useState(parseTimeStr(initialConcert?.soundCheckFrom, 18, 30));
  const [soundCheckToObj, setSoundCheckToObj] = useState(parseTimeStr(initialConcert?.soundCheckTo, 19, 30));

  // Kontakty
  const [contacts, setContacts] = useState(initialConcert?.contacts || '');

  // Stav pro zobrazení aktivního Date/Time Pickera
  const [activePicker, setActivePicker] = useState<'date' | 'startTime' | 'endTime' | 'departureTime' | 'soundCheckFrom' | 'soundCheckTo' | null>(null);

  const handlePickerChange = (event: any, selectedDate?: Date) => {
    const currentPicker = activePicker;
    setActivePicker(Platform.OS === 'ios' ? currentPicker : null); // Zavřít na Androidu

    if (selectedDate && currentPicker) {
      switch (currentPicker) {
        case 'date': setDateObj(selectedDate); break;
        case 'startTime': setStartTimeObj(selectedDate); break;
        case 'endTime': setEndTimeObj(selectedDate); break;
        case 'departureTime': setDepartureTimeObj(selectedDate); break;
        case 'soundCheckFrom': setSoundCheckFromObj(selectedDate); break;
        case 'soundCheckTo': setSoundCheckToObj(selectedDate); break;
      }
    }
  };

  const getPickerDate = () => {
    switch (activePicker) {
      case 'date': return dateObj;
      case 'startTime': return startTimeObj;
      case 'endTime': return endTimeObj;
      case 'departureTime': return departureTimeObj;
      case 'soundCheckFrom': return soundCheckFromObj;
      case 'soundCheckTo': return soundCheckToObj;
      default: return new Date();
    }
  };

  const getPickerMode = () => {
    return activePicker === 'date' ? 'date' : 'time';
  };

  const handleSave = () => {
    if (!title || !location) {
      Alert.alert('Chyba', 'Vyplňte prosím název akce a místo konání.');
      return;
    }

    onSave({
      bandId: '',
      title,
      isPrivate,
      isCancelled,
      date: formatDateDDMMYYYY(dateObj),
      startTime: formatTime(startTimeObj),
      endTime: formatTime(endTimeObj),
      location,
      price,
      departureTime: formatTime(departureTimeObj),
      departureLocation,
      soundCheckFrom: formatTime(soundCheckFromObj),
      soundCheckTo: formatTime(soundCheckToObj),
      contacts,
      whatToTake: selectedWhatToTake,
      setlist,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>
        {initialConcert ? 'Upravit koncert' : 'Naplánovat koncert / akci'}
      </ThemedText>

      {/* Název akce */}
      <ThemedText type="smallBold">Název akce *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Např. Festival Klášterec, Městské slavnosti"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Tlačítka pod názvem: Soukromá akce & Zrušená akce */}
      <View style={styles.switchContainer}>
        <View style={styles.switchRow}>
          <ThemedText type="smallBold">Soukromá akce</ThemedText>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: 'rgba(200,200,200,0.2)', true: '#2196f3' }}
          />
        </View>

        <View style={styles.switchRow}>
          <ThemedText type="smallBold" style={{ color: isCancelled ? '#e91e63' : theme.text }}>
            Zrušená akce
          </ThemedText>
          <Switch
            value={isCancelled}
            onValueChange={setIsCancelled}
            trackColor={{ false: 'rgba(200,200,200,0.2)', true: '#e91e63' }}
          />
        </View>
      </View>

      {/* Datum akce - DatePicker */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Datum akce *</ThemedText>
      <Pressable
        style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        onPress={() => setActivePicker('date')}
      >
        <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={18} tintColor={theme.textSecondary} />
        <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
          {formatDateDDMMYYYY(dateObj)}
        </ThemedText>
      </Pressable>

      {/* Začátek a Konec akce přes TimePicker */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Začátek *</ThemedText>
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
          <ThemedText type="smallBold">Konec</ThemedText>
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

      {/* Místo konání */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Místo konání *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={location}
        onChangeText={setLocation}
        placeholder="Např. Náměstí Klášterec, Klub Baráčník"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Cena / Honorář */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Cena / Honorář</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={price}
        onChangeText={setPrice}
        placeholder="Např. 15 000 Kč, 20 000 Kč + doprava"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Odjezd: Čas přes TimePicker a Místo */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Čas odjezdu</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('departureTime')}
          >
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatTime(departureTimeObj)}
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Místo odjezdu</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            value={departureLocation}
            onChangeText={setDepartureLocation}
            placeholder="Zkušebna"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Zvukovka od - do přes TimePicker */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Zvukovka od</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('soundCheckFrom')}
          >
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatTime(soundCheckFromObj)}
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Zvukovka do</ThemedText>
          <Pressable
            style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => setActivePicker('soundCheckTo')}
          >
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ marginLeft: 6 }}>
              {formatTime(soundCheckToObj)}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Kontakty */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Kontakty na pořadatele</ThemedText>
      <TextInput
        style={[styles.input, styles.multilineInput, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={contacts}
        onChangeText={setContacts}
        placeholder="Jan Novák (pořadatel): +420 777 123 456, Zvukař Petr: +420 608..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={3}
      />

      {/* Co vzít s sebou na akci - Dynamické štítky z nastavení */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Co vzít s sebou na akci</ThemedText>
      {whatToTakePresets.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.one, marginBottom: Spacing.two }}>
          {whatToTakePresets.map(item => {
            const isSelected = selectedWhatToTake.includes(item);

            return (
              <Pressable
                key={item}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected ? '#4caf50' : 'rgba(200,200,200,0.18)',
                    borderColor: isSelected ? '#4caf50' : 'rgba(200,200,200,0.3)',
                  }
                ]}
                onPress={() => toggleWhatToTakeItem(item)}
              >
                <ThemedText
                  type="smallBold"
                  style={{ color: isSelected ? '#fff' : theme.text, fontSize: 12 }}
                >
                  {isSelected ? `✓ ${item}` : item}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one, marginBottom: Spacing.two }}>
          Položky ke zabalení nemáte zatím nastavené. Můžete je přidat v Kapela → Nastavení → Nastavit co vzít s sebou.
        </ThemedText>
      )}

      {/* Setlist Akce */}
      <View style={{ marginTop: Spacing.three, marginBottom: Spacing.three, padding: Spacing.three, borderRadius: Spacing.two, backgroundColor: 'rgba(200,200,200,0.1)' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.one }}>
          <ThemedText type="smallBold">Setlist koncertu</ThemedText>
          {setlist.length > 0 && (
            <View style={{ backgroundColor: '#4caf50', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>{setlist.length} skladeb</ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
          {setlist.length > 0
            ? `Setlist obsahuje ${setlist.length} skladeb. Kliknutím můžete pořadí upravit nebo přegenerovat.`
            : 'Setlist zatím není sestaven. Můžete jej vygenerovat automaticky nebo poskládat ručně.'}
        </ThemedText>

        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: Spacing.two,
            backgroundColor: '#ff9800',
            gap: 8,
          }}
          onPress={() => setShowSetlistEditor(true)}
        >
          <SymbolView name={{ ios: 'music.note.list', android: 'queue_music', web: 'queue_music' }} size={20} tintColor="#fff" />
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            {setlist.length > 0 ? 'Upravit / Přegenerovat setlist' : 'Sestavit / Generovat setlist'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Zobrazení DateTimePickeru */}
      {activePicker && (
        <DateTimePicker
          value={getPickerDate()}
          mode={getPickerMode()}
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handlePickerChange}
        />
      )}

      {/* IOS: tlačítko hotovo pro zavření pickeru */}
      {Platform.OS === 'ios' && activePicker && (
        <Pressable
          style={{ alignSelf: 'flex-end', padding: 8, marginTop: -8 }}
          onPress={() => setActivePicker(null)}
        >
          <ThemedText type="smallBold" style={{ color: '#2196f3' }}>Zavřít výběr</ThemedText>
        </Pressable>
      )}

      {/* Akční tlačítka v jedné řádce */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Uložit koncert
          </ThemedText>
        </Pressable>
      </View>

      {/* Editor a generátor setlistu */}
      <SetlistEditorModal
        visible={showSetlistEditor}
        onClose={() => setShowSetlistEditor(false)}
        concert={initialConcert}
        initialSetlist={setlist}
        onSaveSetlist={(updatedIds) => setSetlist(updatedIds)}
      />

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
    marginTop: Spacing.two,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  multilineInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.five,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});