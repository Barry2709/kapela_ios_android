import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Band, UserProfile, BandMember } from '@/types';
import { createBand, getBands, getBandMembers, verifyMemberPassword } from '@/services/firebaseService';

// Musíme ručně naimportovat getDoc a doc, pokud chceme verifikovat přímo zde,
// NEBO použít správnou importovanou funkci ze service
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function OnboardingScreen() {
  const theme = useTheme();
  const { setCurrentUser, setActiveBand, setActiveRoleView } = useAppStore();

  // Stavy průvodce
  const [step, setStep] = useState<'role_selection' | 'admin_auth_choice' | 'admin_create' | 'member_band' | 'member_person' | 'fan_setup'>('role_selection');

  // Admin formulář
  const [bandName, setBandName] = useState('');
  const [genre, setGenre] = useState('');
  const [web, setWeb] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // Společné
  const [availableBands, setAvailableBands] = useState<Band[]>([]);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);

  // Člen
  const [availableMembers, setAvailableMembers] = useState<BandMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<BandMember | null>(null);
  const [memberPassword, setMemberPassword] = useState('');

  // Fanoušek
  const [fanName, setFanName] = useState('');
  const [fanEmail, setFanEmail] = useState('');

  // Zůstat přihlášen
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // Paměť ověřených rolí/členů na tomto zařízení (pro přihlášení bez hesla)
  const [authHistory, setAuthHistory] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('authenticatedRoles').then(res => {
      if (res) setAuthHistory(JSON.parse(res));
    }).catch(console.error);
  }, []);

  const addAuthHistory = async (key: string) => {
    const updated = Array.from(new Set([...authHistory, key]));
    setAuthHistory(updated);
    await AsyncStorage.setItem('authenticatedRoles', JSON.stringify(updated));
  };

  // Načtení kapel při výběru
  useEffect(() => {
    if (step === 'admin_auth_choice' || step === 'member_band' || step === 'fan_setup') {
      getBands().then(setAvailableBands).catch(console.error);
    }
  }, [step]);

  // Načtení členů po výběru kapely
  useEffect(() => {
    if (step === 'member_person' && selectedBand) {
      getBandMembers(selectedBand.id).then(setAvailableMembers).catch(console.error);
    }
  }, [step, selectedBand]);

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const pickImageFromFolder = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLogoUri(result.assets[0].uri);
    }
  };

  // Uložení session, pokud je zaškrtnuto
  const saveSession = async (user: UserProfile, band: Band | null) => {
    if (keepLoggedIn) {
      await AsyncStorage.setItem('savedUser', JSON.stringify(user));
      if (band) {
        await AsyncStorage.setItem('savedBand', JSON.stringify(band));
      }
    }
  };

  // Checkbox komponenta
  const Checkbox = ({ label }: { label: string }) => (
    <Pressable style={styles.checkboxContainer} onPress={() => setKeepLoggedIn(!keepLoggedIn)}>
      <View style={styles.checkbox}>
        {keepLoggedIn && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={theme.text} />}
      </View>
      <ThemedText type="default">{label}</ThemedText>
    </Pressable>
  );

  // --- HANDLERS ---

  const handleCreateBand = async () => {
    if (!bandName || !adminPassword) {
      Alert.alert('Chyba', 'Název kapely a heslo jsou povinné údaje.');
      return;
    }

    try {
      const newBand = await createBand(bandName, genre, web, adminPassword, logoUri, facebook, instagram);
      const adminUser: UserProfile = {
        uid: 'admin-' + newBand.id,
        email: 'admin@' + newBand.id + '.cz',
        displayName: 'Kapelník',
        role: 'admin',
        bandId: newBand.id
      };

      await addAuthHistory('admin:' + newBand.id);
      setActiveBand(newBand);
      setActiveRoleView('admin');
      setCurrentUser(adminUser);
      await saveSession(adminUser, newBand);
    } catch (e) {
      Alert.alert('Chyba', 'Nepodařilo se vytvořit kapelu.');
    }
  };

  const handleSelectBandForAdmin = async (band: Band) => {
    setSelectedBand(band);
    setAdminPassword('');

    const authKey = `admin:${band.id}`;
    if (authHistory.includes(authKey)) {
      // Zapamatovaný Kapelník -> Přihlásit přímo bez vyžadování hesla
      const adminUser: UserProfile = {
        uid: 'admin-' + band.id,
        email: 'admin@' + band.id + '.cz',
        displayName: 'Kapelník',
        role: 'admin',
        bandId: band.id
      };

      setActiveBand(band);
      setActiveRoleView('admin');
      setCurrentUser(adminUser);
      await saveSession(adminUser, band);
    }
  };

  const handleAdminLogin = async () => {
    if (!selectedBand || !adminPassword) {
      Alert.alert('Chyba', 'Zadejte administrátorské heslo.');
      return;
    }

    try {
      const bandDoc = await getDoc(doc(db, 'kapela_ios_android', selectedBand.id));
      if (!bandDoc.exists()) {
        Alert.alert('Chyba', 'Kapela nebyla nalezena v databázi.');
        return;
      }

      const data = bandDoc.data();
      if (data.adminPassword !== adminPassword) {
        Alert.alert('Přístup odepřen', 'Nesprávné heslo administrátora.');
        return;
      }

      const adminUser: UserProfile = {
        uid: 'admin-' + selectedBand.id,
        email: 'admin@' + selectedBand.id + '.cz',
        displayName: 'Kapelník',
        role: 'admin',
        bandId: selectedBand.id
      };

      await addAuthHistory('admin:' + selectedBand.id);
      setActiveBand(selectedBand);
      setActiveRoleView('admin');
      setCurrentUser(adminUser);
      await saveSession(adminUser, selectedBand);
    } catch (e) {
      Alert.alert('Chyba', 'Nepodařilo se ověřit heslo.');
      console.error(e);
    }
  };

  const handleBandSelectForMember = (band: Band) => {
    setSelectedBand(band);
    setStep('member_person');
  };

  const handleSelectMember = async (member: BandMember) => {
    if (!selectedBand) return;

    const authKey = `member:${selectedBand.id}:${member.id}`;
    if (authHistory.includes(authKey)) {
      // Zapamatovaný Člen -> Přihlásit přímo bez hesla!
      const memberUser: UserProfile = {
        uid: 'member-' + member.id,
        email: member.nickname || member.firstName,
        displayName: member.nickname || member.firstName,
        role: member.isAdmin ? 'admin' : 'member',
        bandId: selectedBand.id,
        memberId: member.id,
        instrument: member.instrument
      };

      setActiveBand(selectedBand);
      setActiveRoleView(member.isAdmin ? 'admin' : 'member');
      setCurrentUser(memberUser);
      await saveSession(memberUser, selectedBand);
      return;
    }

    setSelectedMember(member);
    setMemberPassword('');
  };

  const handleMemberLogin = async () => {
    if (!selectedBand || !selectedMember || !memberPassword) return;

    const isValid = await verifyMemberPassword(selectedBand.id, selectedMember.id, memberPassword);

    if (!isValid) {
      Alert.alert('Přístup odepřen', 'Zadali jste nesprávné heslo pro tohoto člena.');
      return;
    }

    const authKey = `member:${selectedBand.id}:${selectedMember.id}`;
    await addAuthHistory(authKey);

    const memberUser: UserProfile = {
      uid: 'member-' + selectedMember.id,
      email: selectedMember.nickname || selectedMember.firstName,
      displayName: selectedMember.nickname || selectedMember.firstName,
      role: selectedMember.isAdmin ? 'admin' : 'member',
      bandId: selectedBand.id,
      memberId: selectedMember.id,
      instrument: selectedMember.instrument
    };

    setActiveBand(selectedBand);
    setActiveRoleView(selectedMember.isAdmin ? 'admin' : 'member');
    setCurrentUser(memberUser);
    await saveSession(memberUser, selectedBand);
  };

  const handleFanLogin = async () => {
    if (!fanName || !fanEmail || !selectedBand) {
      Alert.alert('Chyba', 'Vyplňte jméno, email a vyberte kapelu.');
      return;
    }
    const fanUser: UserProfile = {
      uid: 'local-fan',
      email: fanEmail,
      displayName: fanName,
      role: 'fan',
      bandId: selectedBand.id
    };

    setActiveBand(selectedBand);
    setActiveRoleView('fan');
    setCurrentUser(fanUser);
    await saveSession(fanUser, selectedBand);
  };


  // --- RENDER ---

  if (step === 'role_selection') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.mainTitle}>Vítejte v aplikaci!</ThemedText>
          <ThemedText type="default" style={styles.subTitle}>Vyberte svou funkci:</ThemedText>

          <View style={styles.roleContainer}>
            <Pressable style={[styles.roleCard, { backgroundColor: theme.backgroundElement }]} onPress={() => setStep('admin_auth_choice')}>
              <SymbolView name={{ ios: 'star.fill', android: 'star', web: 'star' }} size={40} tintColor={theme.text} />
              <ThemedText type="default" style={styles.roleText}>Kapelník (Správce)</ThemedText>
            </Pressable>

            <Pressable style={[styles.roleCard, { backgroundColor: theme.backgroundElement }]} onPress={() => setStep('member_band')}>
              <SymbolView name={{ ios: 'guitars.fill', android: 'music_note', web: 'music_note' }} size={40} tintColor={theme.text} />
              <ThemedText type="default" style={styles.roleText}>Člen kapely</ThemedText>
            </Pressable>

            <Pressable style={[styles.roleCard, { backgroundColor: theme.backgroundElement }]} onPress={() => setStep('fan_setup')}>
              <SymbolView name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} size={40} tintColor={theme.text} />
              <ThemedText type="default" style={styles.roleText}>Fanoušek</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (step === 'admin_auth_choice') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={() => setStep('role_selection')} style={styles.backButton}>
              <ThemedText type="linkPrimary">← Zpět na výběr role</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.mainTitle}>Kapelník (Správce)</ThemedText>

            <Pressable style={[styles.primaryButton, { backgroundColor: theme.text, marginBottom: Spacing.six }]} onPress={() => setStep('admin_create')}>
              <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>+ Založit novou kapelu</ThemedText>
            </Pressable>

            <ThemedText type="smallBold" style={{marginBottom: Spacing.two}}>Nebo se přihlásit k existující kapele:</ThemedText>

            <View style={styles.bandList}>
              {availableBands.map(band => (
                <View key={band.id}>
                  <Pressable
                    style={[styles.bandItem, selectedBand?.id === band.id && { borderColor: '#4caf50', borderWidth: 2 }]}
                    onPress={() => handleSelectBandForAdmin(band)}>
                    {band.logoUri && <Image source={{uri: band.logoUri}} style={{width: 40, height: 40, borderRadius: 20, marginRight: 10}} />}
                    <ThemedText type="default" style={{flex: 1}}>{band.name}</ThemedText>
                    {authHistory.includes(`admin:${band.id}`) && (
                      <ThemedText type="small" themeColor="linkPrimary" style={{fontWeight: 'bold'}}>Zapamatován 🔓</ThemedText>
                    )}
                  </Pressable>

                  {selectedBand?.id === band.id && (
                    <View style={{marginTop: Spacing.two, marginBottom: Spacing.four, paddingHorizontal: Spacing.two}}>
                      <ThemedText type="smallBold">Heslo kapelníka:</ThemedText>
                      <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement, marginBottom: Spacing.two }]}
                        value={adminPassword}
                        onChangeText={setAdminPassword}
                        secureTextEntry
                        placeholder="Zadejte heslo"
                        placeholderTextColor={theme.textSecondary}
                        autoFocus
                      />
                      <Checkbox label="Zůstat přihlášen" />
                      <Pressable style={[styles.primaryButton, { backgroundColor: '#4caf50', marginTop: 0 }]} onPress={handleAdminLogin}>
                        <ThemedText type="default" style={{ color: '#fff', fontWeight: 'bold' }}>Přihlásit se jako Kapelník</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
              {availableBands.length === 0 && <ThemedText type="small" themeColor="textSecondary">Zatím neexistují žádné kapely.</ThemedText>}
            </View>

          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (step === 'admin_create') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={() => setStep('admin_auth_choice')} style={styles.backButton}>
              <ThemedText type="linkPrimary">← Zpět na výběr kapely</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.mainTitle}>Založení kapely</ThemedText>

            <ThemedText type="smallBold">Název kapely</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={bandName} onChangeText={setBandName} placeholder="Např. Naplech" placeholderTextColor={theme.textSecondary} />

            <ThemedText type="smallBold">Hudební žánr</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={genre} onChangeText={setGenre} placeholder="Např. Country / Rock" placeholderTextColor={theme.textSecondary} />

            <ThemedText type="smallBold">Logo kapely (Hranaté na šířku z telefonu)</ThemedText>

            {logoUri && (
               <Image source={{ uri: logoUri }} style={styles.logoPreview} contentFit="cover" />
            )}

            <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four, marginTop: Spacing.two}}>
              <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromGallery}>
                <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={20} tintColor={theme.text} />
                <ThemedText type="small" style={{marginTop: 5}}>Z galerie</ThemedText>
              </Pressable>
              <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromFolder}>
                <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={20} tintColor={theme.text} />
                <ThemedText type="small" style={{marginTop: 5}}>Ze složky</ThemedText>
              </Pressable>
            </View>

            <ThemedText type="smallBold">Web kapely (URL) - nepovinné</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={web} onChangeText={setWeb} placeholder="Např. www.mojekapela.cz" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

            <ThemedText type="smallBold">Facebook kapely (URL) - nepovinné</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={facebook} onChangeText={setFacebook} placeholder="Např. facebook.com/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

            <ThemedText type="smallBold">Instagram kapely (URL) - nepovinné</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={instagram} onChangeText={setInstagram} placeholder="Např. instagram.com/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

            <ThemedText type="smallBold">Vaše Administrátorské heslo *</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholderTextColor={theme.textSecondary} />

            <Checkbox label="Zůstat přihlášen" />

            <Pressable style={[styles.primaryButton, { backgroundColor: theme.text }]} onPress={handleCreateBand}>
              <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>Vytvořit kapelu</ThemedText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (step === 'member_band') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={() => setStep('role_selection')} style={styles.backButton}>
              <ThemedText type="linkPrimary">← Zpět na výběr</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.mainTitle}>Výběr kapely</ThemedText>

            <View style={styles.bandList}>
              {availableBands.map(band => (
                <Pressable key={band.id} style={styles.bandItem} onPress={() => handleBandSelectForMember(band)}>
                  {band.logoUri && <Image source={{uri: band.logoUri}} style={{width: 40, height: 40, borderRadius: 20, marginRight: 10}} />}
                  <ThemedText type="default">{band.name}</ThemedText>
                </Pressable>
              ))}
              {availableBands.length === 0 && <ThemedText type="small" themeColor="textSecondary">Nebyly nalezeny žádné kapely.</ThemedText>}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (step === 'member_person') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={() => setStep('member_band')} style={styles.backButton}>
              <ThemedText type="linkPrimary">← Zpět na výběr kapely</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.mainTitle}>Kdo jste?</ThemedText>

            {!selectedMember ? (
              <View style={styles.bandList}>
                {availableMembers.map(member => (
                  <Pressable key={member.id} style={styles.bandItem} onPress={() => handleSelectMember(member)}>
                    {member.photoUri ? (
                      <Image source={{uri: member.photoUri}} style={{width: 40, height: 40, borderRadius: 20, marginRight: 10}} />
                    ) : (
                      <View style={{width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: theme.backgroundElement, justifyContent: 'center', alignItems: 'center'}}>
                         <SymbolView name={{ios: 'person.fill', android: 'person', web: 'person'}} size={20} tintColor={theme.text} />
                      </View>
                    )}
                    <View style={{flex: 1}}>
                      <ThemedText type="default" style={{fontWeight: 'bold'}}>{member.nickname || member.firstName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{member.instrument}</ThemedText>
                    </View>
                    {authHistory.includes(`member:${selectedBand?.id}:${member.id}`) && (
                      <ThemedText type="small" themeColor="linkPrimary" style={{fontWeight: 'bold'}}>Zapamatován 🔓</ThemedText>
                    )}
                  </Pressable>
                ))}
                {availableMembers.length === 0 && <ThemedText type="small" themeColor="textSecondary">Kapelník zatím nepřidal žádné členy.</ThemedText>}
              </View>
            ) : (
              <View style={{marginTop: 20}}>
                <ThemedText type="smallBold">Zadejte heslo pro: {selectedMember.nickname || selectedMember.firstName}</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
                  value={memberPassword}
                  onChangeText={setMemberPassword}
                  secureTextEntry
                  autoFocus
                />
                <Checkbox label="Zůstat přihlášen" />
                <View style={{flexDirection: 'row', gap: 10}}>
                   <Pressable style={[styles.primaryButton, { flex: 1, backgroundColor: theme.backgroundElement, marginTop: 0 }]} onPress={() => setSelectedMember(null)}>
                     <ThemedText type="default">Zpět</ThemedText>
                   </Pressable>
                   <Pressable style={[styles.primaryButton, { flex: 1, backgroundColor: theme.text, marginTop: 0 }]} onPress={handleMemberLogin}>
                     <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>Přihlásit se</ThemedText>
                   </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (step === 'fan_setup') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={() => setStep('role_selection')} style={styles.backButton}>
              <ThemedText type="linkPrimary">← Zpět na výběr</ThemedText>
            </Pressable>

            <ThemedText type="subtitle" style={styles.mainTitle}>Jsem fanoušek</ThemedText>

            <ThemedText type="smallBold">Vaše jméno / přezdívka</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={fanName} onChangeText={setFanName} />

            <ThemedText type="smallBold">Váš email (platný)</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={fanEmail} onChangeText={setFanEmail} keyboardType="email-address" />

            <ThemedText type="smallBold" style={{marginTop: 10}}>Vyberte kapelu:</ThemedText>
            <View style={styles.bandList}>
              {availableBands.map(band => (
                <Pressable
                  key={band.id}
                  style={[styles.bandItem, selectedBand?.id === band.id && { borderColor: '#4caf50', borderWidth: 2 }]}
                  onPress={() => setSelectedBand(band)}>
                  {band.logoUri && <Image source={{uri: band.logoUri}} style={{width: 30, height: 30, borderRadius: 15, marginRight: 10}} />}
                  <ThemedText type="default">{band.name}</ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={{marginTop: Spacing.four}}>
              <Checkbox label="Zůstat přihlášen" />
            </View>

            <Pressable style={[styles.primaryButton, { backgroundColor: theme.text }]} onPress={handleFanLogin}>
              <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>Získat přístup</ThemedText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four },
  mainTitle: { textAlign: 'center', marginBottom: Spacing.one, marginTop: Spacing.four },
  subTitle: { textAlign: 'center', marginBottom: Spacing.six },
  roleContainer: { paddingHorizontal: Spacing.four, gap: Spacing.four },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.four, borderRadius: Spacing.four, gap: Spacing.four },
  roleText: { fontSize: 18, fontWeight: 'bold' },
  backButton: { marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, marginTop: Spacing.one, marginBottom: Spacing.four, fontSize: 16 },
  logoPreview: { width: '100%', aspectRatio: 16/9, borderRadius: Spacing.two, marginTop: Spacing.two },
  primaryButton: { padding: Spacing.four, borderRadius: Spacing.six, alignItems: 'center', marginTop: Spacing.two },
  button: { flex: 1, padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  bandList: { gap: Spacing.two, marginTop: Spacing.one },
  bandItem: { padding: Spacing.three, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: Spacing.two, flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.four },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#aaa', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.two }
});
