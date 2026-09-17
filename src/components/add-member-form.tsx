import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Switch, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing, Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BandMember, TechSpecs } from '@/types';

interface Props {
  initialMember?: BandMember;
  onSave: (member: Omit<BandMember, 'id'>) => void;
  onCancel: () => void;
}

export function AddMemberForm({ initialMember, onSave, onCancel }: Props) {
  const theme = useTheme();

  const [firstName, setFirstName] = useState(initialMember?.firstName || '');
  const [lastName, setLastName] = useState(initialMember?.lastName || '');
  const [nickname, setNickname] = useState(initialMember?.nickname || '');
  const [instrument, setInstrument] = useState(initialMember?.instrument || '');
  const [email, setEmail] = useState(initialMember?.email || '');
  const [phone, setPhone] = useState(initialMember?.phone || '');
  const [birthDate, setBirthDate] = useState(initialMember?.birthDate || '');
  const [password, setPassword] = useState(initialMember?.password || '');
  const [photoUri, setPhotoUri] = useState<string | null>(initialMember?.photoUri || null);

  // Šoupátka (Host, Aktivní, Admin)
  const [isGuest, setIsGuest] = useState(initialMember?.isGuest || false);
  const [isActive, setIsActive] = useState(initialMember?.isActive !== undefined ? initialMember.isActive : true);
  const [isAdmin, setIsAdmin] = useState(initialMember?.isAdmin || false);

  const [tech, setTech] = useState<TechSpecs>(initialMember?.tech || {
    mic: false,
    xlr: false,
    comboXlr: false,
    jack: false,
    comboJack: false,
    monitor: false,
    wirelessMonitor: false,
    power230V: false,
    pedalboard: false,
  });

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1], // Fotka člena čtvercová
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickImageFromFolder = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!firstName || !password || !instrument) {
      Alert.alert('Chyba', 'Jméno, Nástroj a Heslo jsou povinné údaje.');
      return;
    }

    onSave({
      firstName,
      lastName,
      nickname,
      instrument,
      email,
      phone,
      birthDate,
      password,
      photoUri: photoUri || null,
      isGuest,
      isActive,
      isAdmin,
      tech,
    });
  };

  const toggleTech = (key: keyof TechSpecs) => {
    setTech(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const TechSwitch = ({ label, field }: { label: string, field: keyof TechSpecs }) => (
    <View style={styles.switchRow}>
      <ThemedText type="small">{label}</ThemedText>
      <Switch
        value={tech[field]}
        onValueChange={() => toggleTech(field)}
        trackColor={{ false: theme.backgroundElement, true: '#4caf50' }}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>
        {initialMember ? 'Upravit člena' : 'Přidat člena'}
      </ThemedText>

      {/* Profilová fotka */}
      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.imagePicker} contentFit="cover" />
      )}

      <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four, marginTop: Spacing.two, alignSelf: 'center'}}>
        <Pressable style={[styles.photoBtn, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromGallery}>
          <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={20} tintColor={theme.text} />
          <ThemedText type="small" style={{marginTop: 5}}>Z galerie</ThemedText>
        </Pressable>
        <Pressable style={[styles.photoBtn, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromFolder}>
          <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={20} tintColor={theme.text} />
          <ThemedText type="small" style={{marginTop: 5}}>Ze složky</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="smallBold">Jméno *</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={firstName} onChangeText={setFirstName} placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Příjmení</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={lastName} onChangeText={setLastName} placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Přezdívka</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={nickname} onChangeText={setNickname} placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Nástroj / Zpěv *</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={instrument} onChangeText={setInstrument} placeholder="Např. Kytara, zpěv" placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">E-mail</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={email} onChangeText={setEmail} placeholder="jan.novak@email.cz" placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none" />

      <ThemedText type="smallBold">Telefon</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={phone} onChangeText={setPhone} placeholder="+420 777 123 456" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" />

      <ThemedText type="smallBold">Datum narození</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={birthDate} onChangeText={setBirthDate} placeholder="Např. 15.05.1990" placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Přihlašovací heslo člena *</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={password} onChangeText={setPassword} secureTextEntry placeholder="Heslo pro přihlášení tohoto člena" placeholderTextColor={theme.textSecondary} />

      <View style={{ marginBottom: Spacing.four, marginTop: Spacing.two, gap: Spacing.three }}>
        <View style={styles.switchRow}>
          <ThemedText type="default" style={{fontWeight: 'bold'}}>Aktivní člen (Aktivní / Neaktivní)</ThemedText>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: theme.backgroundElement, true: '#4caf50' }}
          />
        </View>
        <View style={styles.switchRow}>
          <ThemedText type="default" style={{fontWeight: 'bold'}}>Je to Host? (Místo stálého člena)</ThemedText>
          <Switch
            value={isGuest}
            onValueChange={setIsGuest}
            trackColor={{ false: theme.backgroundElement, true: '#2196f3' }}
          />
        </View>
        <View style={styles.switchRow}>
          <ThemedText type="default" style={{fontWeight: 'bold'}}>Udělit Admin práva (Správce)</ThemedText>
          <Switch
            value={isAdmin}
            onValueChange={setIsAdmin}
            trackColor={{ false: theme.backgroundElement, true: '#ff9800' }}
          />
        </View>
      </View>

      <ThemedText type="default" style={{marginTop: 10, marginBottom: 10, fontWeight: 'bold'}}>Technický setup:</ThemedText>
      <ThemedView type="backgroundElement" style={styles.techContainer}>
        <TechSwitch label="Zpěvový mikrofon (Mic)" field="mic" />
        <TechSwitch label="Vstup XLR" field="xlr" />
        <TechSwitch label="Vstup Jack" field="jack" />
        <TechSwitch label="Combo XLR" field="comboXlr" />
        <TechSwitch label="Combo Jack" field="comboJack" />
        <TechSwitch label="Osobní monitor" field="monitor" />
        <TechSwitch label="Bezdrátový monitor" field="wirelessMonitor" />
        <TechSwitch label="Napájení 230V" field="power230V" />
        <TechSwitch label="Pedalboard" field="pedalboard" />
      </ThemedView>

      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={onCancel}>
          <ThemedText type="default">Zrušit</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: theme.text }]} onPress={handleSave}>
          <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>Uložit člena</ThemedText>
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
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  photoBtn: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    width: 100,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
    fontSize: 16,
  },
  techContainer: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  button: {
    flex: 1,
    padding: Spacing.four,
    borderRadius: Spacing.six,
    alignItems: 'center',
  }
});
