import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Switch, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { BandMember, TechSpecs } from '@/types';

interface Props {
  initialMember?: BandMember;
  onSave: (member: Omit<BandMember, 'id'>) => void;
  onCancel: () => void;
}

export function AddMemberForm({ initialMember, onSave, onCancel }: Props) {
  const theme = useTheme();
  const { activeBand } = useAppStore();
  const techRiderPresets = activeBand?.techRiderPresets || [];

  const parseBirthDate = (str?: string) => {
    if (!str) return new Date(1995, 0, 15);
    try {
      if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) {
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      }
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? new Date(1995, 0, 15) : parsed;
    } catch (e) {
      return new Date(1995, 0, 15);
    }
  };

  const formatDateDDMMYYYY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const [firstName, setFirstName] = useState(initialMember?.firstName || '');
  const [lastName, setLastName] = useState(initialMember?.lastName || '');
  const [nickname, setNickname] = useState(initialMember?.nickname || '');
  const [instrument, setInstrument] = useState(initialMember?.instrument || '');
  const [email, setEmail] = useState(initialMember?.email || '');
  const [phone, setPhone] = useState(initialMember?.phone || '');

  const [birthDateStr, setBirthDateStr] = useState(initialMember?.birthDate || '');
  const [birthDateObj, setBirthDateObj] = useState(parseBirthDate(initialMember?.birthDate));
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  const [password, setPassword] = useState(initialMember?.password || '');
  const [photoUri, setPhotoUri] = useState<string | null>(initialMember?.photoUri || null);

  // Šoupátka (Host, Aktivní, Admin)
  const [isGuest, setIsGuest] = useState(initialMember?.isGuest || false);
  const [isActive, setIsActive] = useState(initialMember?.isActive !== undefined ? initialMember.isActive : true);
  const [isAdmin, setIsAdmin] = useState(initialMember?.isAdmin || false);

  const [tech, setTech] = useState<TechSpecs>(initialMember?.tech || {
    mic: false,
    instrumentMic: false,
    xlr: false,
    comboXlr: false,
    jack: false,
    comboJack: false,
    monitor: false,
    wirelessMonitor: false,
    power230V: false,
    pedalboard: false,
    customTech: {},
  });

  const pickImageFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Oprávnění vyžadováno', 'Pro výběr fotky z galerie je potřeba povolit přístup k fotkám.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Chyba při výběru fotky z galerie:", e);
      Alert.alert("Chyba", "Nepodařilo se načíst fotku z galerie.");
    }
  };

  const pickImageFromFolder = async () => {
    try {
      let result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Chyba při výběru souboru:", e);
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
      birthDate: birthDateStr.trim(),
      password,
      photoUri: photoUri || null,
      isGuest,
      isActive,
      isAdmin,
      tech,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>
        {initialMember ? 'Upravit člena' : 'Přidat člena'}
      </ThemedText>

      {/* Profilová fotka */}
      {photoUri && (
        <View style={styles.imagePickerWrapper}>
          <Image source={photoUri} style={styles.imagePicker} contentFit="cover" />
        </View>
      )}

      <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four, marginTop: Spacing.two, alignSelf: 'center'}}>
        <Pressable style={[styles.photoBtn, { backgroundColor: '#2196f3', borderColor: '#1976d2' }]} onPress={pickImageFromGallery}>
          <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={16} tintColor="#fff" />
          <ThemedText type="smallBold" style={{fontSize: 12, color: '#fff'}}>Vybrat fotku z galerie</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="smallBold">Jméno *</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={firstName} onChangeText={setFirstName} placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Příjmení</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={lastName} onChangeText={setLastName} placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Přezdívka</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={nickname} onChangeText={setNickname} placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">Nástroj / Zpěv *</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={instrument} onChangeText={setInstrument} placeholder="Např. Kytara, zpěv" placeholderTextColor={theme.textSecondary} />

      <ThemedText type="smallBold">E-mail</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={email} onChangeText={setEmail} placeholder="jan.novak@email.cz" placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none" />

      <ThemedText type="smallBold">Telefon</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={phone} onChangeText={setPhone} placeholder="+420 777 123 456" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" />

      {/* Datum narození - Vpisovací text nebo Kalendář */}
      <ThemedText type="smallBold">Datum narození (DD.MM.YYYY)</ThemedText>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { flex: 1, color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
          value={birthDateStr}
          onChangeText={setBirthDateStr}
          placeholder="15.01.1995"
          placeholderTextColor={theme.textSecondary}
        />
        <Pressable
          style={[styles.pickerButton, { backgroundColor: '#2196f3', borderColor: '#1976d2', marginTop: 0, marginBottom: Spacing.three }]}
          onPress={() => setShowBirthDatePicker(true)}
        >
          <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={20} tintColor="#fff" />
        </Pressable>
      </View>

      {/* Kalendářový dialog na Android / iOS */}
      {showBirthDatePicker && (
        <DateTimePicker
          value={birthDateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowBirthDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setBirthDateObj(selectedDate);
              setBirthDateStr(formatDateDDMMYYYY(selectedDate));
            }
          }}
        />
      )}

      <ThemedText type="smallBold">Přihlašovací heslo člena *</ThemedText>
      <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={password} onChangeText={setPassword} secureTextEntry placeholder="Heslo pro přihlášení tohoto člena" placeholderTextColor={theme.textSecondary} />

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

      <ThemedText type="default" style={{marginTop: 10, marginBottom: 10, fontWeight: 'bold'}}>Technický setup člena:</ThemedText>
      <ThemedView type="backgroundElement" style={styles.techContainer}>
        {techRiderPresets.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {techRiderPresets.map(item => {
              const isActiveItem = !!tech.customTech?.[item];

              return (
                <Pressable
                  key={item}
                  style={[
                    styles.techChip,
                    {
                      backgroundColor: isActiveItem ? '#4caf50' : 'rgba(200,200,200,0.18)',
                      borderColor: isActiveItem ? '#4caf50' : 'rgba(200,200,200,0.3)',
                    }
                  ]}
                  onPress={() => {
                    setTech(prev => ({
                      ...prev,
                      customTech: {
                        ...prev.customTech,
                        [item]: !prev.customTech?.[item]
                      }
                    }));
                  }}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: isActiveItem ? '#fff' : theme.text, fontSize: 13 }}
                  >
                    {isActiveItem ? `✓ ${item}` : item}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: 8 }}>
            Položky technického rideru nemáte zatím nastavené.{'\n'}Můžete je přidat v Kapela → Nastavení → Nastavit technický rider.
          </ThemedText>
        )}
      </ThemedView>

      {/* Kompaktní akční tlačítka */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit člena</ThemedText>
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
  imagePicker: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  photoBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pickerButton: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  techChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  imagePickerWrapper: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: 'rgba(200,200,200,0.3)',
  }
});
