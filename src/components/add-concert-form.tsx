import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform, Switch, Modal } from 'react-native';
import { SymbolView } from 'expo-symbols';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Concert, OrganizerContact } from '@/types';
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

  // Organizátoři / Kontakty na pořadatele
  const [organizers, setOrganizers] = useState<OrganizerContact[]>(
    initialConcert?.organizers || []
  );

  // Formular state pro nový/upravovaný kontakt na pořadatele
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgRole, setOrgRole] = useState<'Pořadatel' | 'Zvukař' | 'Kontakt'>('Pořadatel');
  const [showOrgModal, setShowOrgModal] = useState(false);

  const openAddOrganizer = () => {
    setEditingOrgId(null);
    setOrgName('');
    setOrgPhone('');
    setOrgEmail('');
    setOrgRole('Pořadatel');
    setShowOrgModal(true);
  };

  const openEditOrganizer = (contact: OrganizerContact) => {
    setEditingOrgId(contact.id);
    setOrgName(contact.name);
    setOrgPhone(contact.phone || '');
    setOrgEmail(contact.email || '');
    setOrgRole((contact.role as any) || 'Pořadatel');
    setShowOrgModal(true);
  };

  const handleSaveOrganizer = () => {
    if (!orgName.trim()) {
      Alert.alert('Chyba', 'Zadejte prosím jméno kontaktní osoby.');
      return;
    }

    if (editingOrgId) {
      setOrganizers(prev =>
        prev.map(c =>
          c.id === editingOrgId
            ? { ...c, name: orgName.trim(), phone: orgPhone.trim() || undefined, email: orgEmail.trim() || undefined, role: orgRole }
            : c
        )
      );
    } else {
      const newContact: OrganizerContact = {
        id: 'org_' + Date.now(),
        name: orgName.trim(),
        phone: orgPhone.trim() || undefined,
        email: orgEmail.trim() || undefined,
        role: orgRole,
      };
      setOrganizers(prev => [...prev, newContact]);
    }

    setShowOrgModal(false);
  };

  const handleDeleteOrganizer = (id: string) => {
    setOrganizers(prev => prev.filter(c => c.id !== id));
  };

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

  // Kontakty (starý textový řádek)
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
      organizers,
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

      {/* Přepínače Soukromá / Zrušená */}
      <View style={styles.switchContainer}>
        <View style={styles.switchRow}>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#767577', true: '#2196f3' }} />
          <ThemedText type="small">Soukromá akce</ThemedText>
        </View>

        <View style={styles.switchRow}>
          <Switch value={isCancelled} onValueChange={setIsCancelled} trackColor={{ false: '#767577', true: '#e91e63' }} />
          <ThemedText type="small" style={{ color: isCancelled ? '#e91e63' : theme.text }}>Zrušeno</ThemedText>
        </View>
      </View>

      {/* Datum konání */}
      <ThemedText type="smallBold">Datum akce *</ThemedText>
      <Pressable
        style={[styles.pickerButton, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        onPress={() => setActivePicker('date')}
      >
        <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={20} tintColor={theme.textSecondary} />
        <ThemedText type="smallBold" style={{ marginLeft: 8 }}>
          📅 {formatDateDDMMYYYY(dateObj)}
        </ThemedText>
      </Pressable>

      {/* Časy Od - Do */}
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
        placeholder="Např. Amfiteátr, Zámecký park Klášterec"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Cena / Honorář */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Honorář / Cena za vystoupení</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={price}
        onChangeText={setPrice}
        placeholder="Např. 15 000 Kč nebo Dle dohody"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Odjezd */}
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
            placeholder="Odkud se jede"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Zvukovka Od - Do */}
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

      {/* Kontakty na pořadatele / organizátory */}
      <View style={{ marginTop: Spacing.three, marginBottom: Spacing.two }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText type="smallBold">Kontakty na pořadatele / zvukaře ({organizers.length})</ThemedText>
          <Pressable
            style={styles.addOrgBtn}
            onPress={openAddOrganizer}
          >
            <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={16} tintColor="#2196f3" />
            <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 12 }}>Přidat kontakt</ThemedText>
          </Pressable>
        </View>

        {organizers.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic', marginBottom: 4 }}>
            Zatím nebyly zadány žádné kontakty. Kliknutím na "+ Přidat kontakt" přidejte pořadatele, zvukaře nebo kontaktní osobu.
          </ThemedText>
        ) : (
          <View style={{ gap: 8 }}>
            {organizers.map(org => (
              <View key={org.id} style={styles.orgContactCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.orgRoleBadge, { backgroundColor: org.role === 'Zvukař' ? 'rgba(255,152,0,0.2)' : (org.role === 'Pořadatel' ? 'rgba(76,175,80,0.2)' : 'rgba(33,150,243,0.2)') }]}>
                      <ThemedText type="smallBold" style={{ color: org.role === 'Zvukař' ? '#ff9800' : (org.role === 'Pořadatel' ? '#4caf50' : '#2196f3'), fontSize: 10 }}>
                        {org.role || 'Kontakt'}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ fontSize: 14 }}>{org.name}</ThemedText>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    {org.phone ? (
                      <ThemedText type="small" style={{ color: '#2196f3' }}>📞 {org.phone}</ThemedText>
                    ) : null}
                    {org.email ? (
                      <ThemedText type="small" style={{ color: '#2196f3' }}>✉️ {org.email}</ThemedText>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => openEditOrganizer(org)} style={{ padding: 4 }}>
                    <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={18} tintColor={theme.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteOrganizer(org.id)} style={{ padding: 4 }}>
                    <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={18} tintColor="#e91e63" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

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

      {/* Modal pro přidání / úpravu jednoho pořadatele/zvukaře */}
      <Modal visible={showOrgModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowOrgModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: theme.backgroundElement }]} onPress={e => e.stopPropagation()}>
            <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
              {editingOrgId ? 'Upravit kontakt' : 'Přidat kontakt pořadatele / zvukaře'}
            </ThemedText>

            {/* Rychlé volby role: Pořadatel, Zvukař, Kontakt */}
            <ThemedText type="smallBold" style={{ marginBottom: 6 }}>Role / Typ kontaktu</ThemedText>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['Pořadatel', 'Zvukař', 'Kontakt'] as const).map(roleOption => {
                const isSelected = orgRole === roleOption;
                return (
                  <Pressable
                    key={roleOption}
                    style={[
                      styles.roleChipBtn,
                      isSelected ? { backgroundColor: '#2196f3', borderColor: '#2196f3' } : styles.roleChipBtnInactive
                    ]}
                    onPress={() => setOrgRole(roleOption)}
                  >
                    <ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 12 }}>
                      {roleOption}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Jméno */}
            <ThemedText type="smallBold" style={{ marginBottom: 4 }}>Jméno a Příjmení *</ThemedText>
            <TextInput
              style={[styles.inputModal, { color: theme.text, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.1)', marginBottom: 10 }]}
              placeholder="Např. Jan Novák"
              placeholderTextColor={theme.textSecondary}
              value={orgName}
              onChangeText={setOrgName}
              autoFocus
            />

            {/* Telefon */}
            <ThemedText type="smallBold" style={{ marginBottom: 4 }}>Telefonní číslo</ThemedText>
            <TextInput
              style={[styles.inputModal, { color: theme.text, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.1)', marginBottom: 10 }]}
              placeholder="Např. +420 777 123 456"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              value={orgPhone}
              onChangeText={setOrgPhone}
            />

            {/* Email */}
            <ThemedText type="smallBold" style={{ marginBottom: 4 }}>E-mail</ThemedText>
            <TextInput
              style={[styles.inputModal, { color: theme.text, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.1)', marginBottom: 16 }]}
              placeholder="Např. novak@poradatel.cz"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={orgEmail}
              onChangeText={setOrgEmail}
            />

            {/* Tlačítka Uložit / Zrušit */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <Pressable onPress={() => setShowOrgModal(false)} style={styles.modalCancelBtn}>
                <ThemedText type="smallBold" themeColor="textSecondary">Zrušit</ThemedText>
              </Pressable>
              <Pressable onPress={handleSaveOrganizer} style={styles.modalSaveBtn}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit kontakt</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  inputModal: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
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
    marginTop: Spacing.four,
  },
  button: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  addOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(33,150,243,0.15)',
  },
  orgContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(200,200,200,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,200,200,0.25)',
  },
  orgRoleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleChipBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  roleChipBtnInactive: {
    backgroundColor: 'rgba(150,150,150,0.15)',
    borderColor: 'rgba(150,150,150,0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2196f3',
  },
});
