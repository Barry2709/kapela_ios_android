import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/utils/i18n';
import { useAppStore } from '@/store/useAppStore';
import { Band, UserProfile, BandMember } from '@/types';
import { createBand, getBands, getBandMembers, verifyMemberPassword, addFanToBand } from '@/services/firebaseService';
import { CountryPickerModal } from '@/components/country-picker-modal';
import { getCountryDisplayName } from '@/constants/countries';

// Musíme ručně naimportovat getDoc a doc, pokud chceme verifikovat přímo zde,
// NEBO použít správnou importovanou funkci ze service
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function OnboardingScreen() {
  const theme = useTheme();
  const { t, currentLang } = useTranslation();
  const { setCurrentUser, setActiveBand, setActiveRoleView } = useAppStore();

  // Stavy průvodce
  const [step, setStep] = useState<'role_selection' | 'admin_auth_choice' | 'admin_create' | 'member_band' | 'member_person' | 'fan_setup'>('role_selection');

  // Admin formulář
  const [bandName, setBandName] = useState('');
  const [genre, setGenre] = useState('');
  const [country, setCountry] = useState('CZ');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [web, setWeb] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [bandzone, setBandzone] = useState('');
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [appleCalendarUrl, setAppleCalendarUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminInstrument, setAdminInstrument] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [adminCreateStep, setAdminCreateStep] = useState(1);

  // Společné
  const [availableBands, setAvailableBands] = useState<Band[]>([]);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedFanBands, setSelectedFanBands] = useState<Band[]>([]);

  // Člen
  const [availableMembers, setAvailableMembers] = useState<BandMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<BandMember | null>(null);
  const [memberPassword, setMemberPassword] = useState('');

  // Fanoušek
  const [fanName, setFanName] = useState('');
  const [fanEmail, setFanEmail] = useState('');
  const [fanPhone, setFanPhone] = useState('');

  // Zůstat přihlášen
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // Paměť ověřených rolí/členů na tomto zařízení (pro přihlášení bez hesla)
  const [authHistory, setAuthHistory] = useState<string[]>([]);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('savedFanName').then(val => { if (val) setFanName(val); }).catch(console.error);
    AsyncStorage.getItem('savedFanEmail').then(val => { if (val) setFanEmail(val); }).catch(console.error);
    AsyncStorage.getItem('savedFanPhone').then(val => { if (val) setFanPhone(val); }).catch(console.error);
  }, []);


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

  // Pre-fetch kapel při startu i změně kroku
  useEffect(() => {
    getBands().then(bands => {
      setAvailableBands(bands);
      if (bands.length > 0 && selectedFanBands.length === 0) {
        setSelectedFanBands([bands[0]]);
      }
    }).catch(console.error);
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

  // Uložení session s podporou pro více kapel na zařízení
  const saveSession = async (user: UserProfile, band: Band | null) => {
    if (keepLoggedIn && band) {
      try {
        const existingStr = await AsyncStorage.getItem('savedSessions');
        let sessions = existingStr ? JSON.parse(existingStr) : [];

        // Remove if already exists to avoid duplicates
        sessions = sessions.filter((s: any) => !(s.band.id === band.id && s.user.uid === user.uid));
        sessions.push({ user, band });

        await AsyncStorage.setItem('savedSessions', JSON.stringify(sessions));
        await AsyncStorage.setItem('lastActiveBandId', band.id);

        // Zpětná kompatibilita (nechat i staré klíče)
        await AsyncStorage.setItem('savedUser', JSON.stringify(user));
        await AsyncStorage.setItem('savedBand', JSON.stringify(band));
      } catch (e) {
        console.error("Chyba při ukládání multi-session:", e);
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
    if (!bandName || !adminPassword || !adminDisplayName.trim() || !adminInstrument.trim()) {
      Alert.alert(t('home.attendance.errorTitle'), t('form.member.errorFields') || 'Vyplňte název kapely, heslo, vaše jméno a nástroj.');
      return;
    }

    try {
      const newBand = await createBand(bandName, genre, web, adminPassword, logoUri, facebook, instagram, bandzone, country, googleCalendarId, appleCalendarUrl);

      // Vytvořit rovnou profil zakladatele (kapelníka) v nové kapele
      const { addBandMember } = require('@/services/firebaseService');
      const newMemberId = await addBandMember(newBand.id, {
        firstName: adminDisplayName.trim(),
        instrument: adminInstrument.trim(),
        role: 'Kapelník',
        password: adminPassword,
        isAdmin: true,
      });

      const adminUser: UserProfile = {
        uid: 'admin-' + newBand.id,
        email: 'admin@' + newBand.id + '.cz',
        displayName: adminDisplayName.trim(),
        role: 'admin',
        bandId: newBand.id,
        memberId: newMemberId,
      };

      await addAuthHistory('admin:' + newBand.id);
      setActiveBand(newBand);
      setActiveRoleView('admin');
      setCurrentUser(adminUser);
      await saveSession(adminUser, newBand);
    } catch (e) {
      Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorCreateFail'));
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
        displayName: 'Admin',
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
      Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorPass'));
      return;
    }

    try {
      const bandDoc = await getDoc(doc(db, 'kapela_ios_android', selectedBand.id));
      if (!bandDoc.exists()) {
        Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorNotFound'));
        return;
      }

      const data = bandDoc.data();
      if (data.adminPassword !== adminPassword) {
        Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorDenied'));
        return;
      }

      const adminUser: UserProfile = {
        uid: 'admin-' + selectedBand.id,
        email: 'admin@' + selectedBand.id + '.cz',
        displayName: 'Admin',
        role: 'admin',
        bandId: selectedBand.id
      };

      await addAuthHistory('admin:' + selectedBand.id);
      setActiveBand(selectedBand);
      setActiveRoleView('admin');
      setCurrentUser(adminUser);
      await saveSession(adminUser, selectedBand);
    } catch (e) {
      Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorVerifyPass'));
      console.error(e);
    }
  };

  const handleBandSelectForMember = (band: Band) => {
    setSelectedBand(band);
    setStep('member_person');
  };

  
  const toggleFanBand = (band: Band) => {
    setSelectedFanBands(prev => {
      const exists = prev.some(b => b.id === band.id);
      if (exists) {
        return prev.filter(b => b.id !== band.id);
      } else {
        return [...prev, band];
      }
    });
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
      Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorMemberDenied'));
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
      
    };

    setActiveBand(selectedBand);
    setActiveRoleView(selectedMember.isAdmin ? 'admin' : 'member');
    setCurrentUser(memberUser);
    await saveSession(memberUser, selectedBand);
  };

  const handleFanLogin = async () => {
    if (!fanName.trim() || selectedFanBands.length === 0) {
      Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorFan'));
      return;
    }
    try {
      await AsyncStorage.setItem('savedFanName', fanName.trim());
      if (fanEmail) await AsyncStorage.setItem('savedFanEmail', fanEmail.trim());
      if (fanPhone) await AsyncStorage.setItem('savedFanPhone', fanPhone.trim());

      let firstFanUser: UserProfile | null = null;
      let firstBand: Band | null = null;

      for (const band of selectedFanBands) {
        const createdFan = await addFanToBand(band.id, {
          name: fanName.trim(),
          email: fanEmail.trim() || '',
          phone: fanPhone.trim() || undefined,
        });

        const fanUser: UserProfile = {
          uid: createdFan.id,
          email: fanEmail.trim() || '',
          displayName: fanName.trim(),
          role: 'fan',
          bandId: band.id
        };

        const authKey = `fan:${band.id}:${createdFan.id}`;
        await addAuthHistory(authKey);
        await saveSession(fanUser, band);

        if (!firstFanUser) {
          firstFanUser = fanUser;
          firstBand = band;
        }
      }

      if (firstFanUser && firstBand) {
        setActiveBand(firstBand);
        setActiveRoleView('fan');
        setCurrentUser(firstFanUser);
      }
    } catch (e) {
      console.error("Chyba při registraci fanouška:", e);
      Alert.alert(t('home.attendance.errorTitle'), t('onboarding.errorFan'));
    }
  };


  // --- RENDER ---

    if (step === 'role_selection') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: Spacing.four, justifyContent: 'center' }} >
            <ThemedText type="subtitle" style={styles.mainTitle}>{t('onboarding.welcome')}</ThemedText>
            <ThemedText type="default" style={styles.subTitle}>{t('onboarding.selectRole')}</ThemedText>

            <View style={styles.roleContainer}>
              <Pressable style={[styles.roleCard, { backgroundColor: theme.backgroundElement }]} onPress={() => setStep('admin_create')}>
                <SymbolView name={{ ios: 'star.fill', android: 'star', web: 'star' }} size={40} tintColor={theme.text} />
                <ThemedText type="default" style={styles.roleText}>{t('onboarding.roleAdmin')}</ThemedText>
              </Pressable>

              <Pressable style={[styles.roleCard, { backgroundColor: theme.backgroundElement }]} onPress={() => setStep('member_band')}>
                <SymbolView name={{ ios: 'guitars.fill', android: 'music_note', web: 'music_note' }} size={40} tintColor={theme.text} />
                <ThemedText type="default" style={styles.roleText}>{t('onboarding.roleMember')}</ThemedText>
              </Pressable>

              <Pressable style={[styles.roleCard, { backgroundColor: theme.backgroundElement }]} onPress={() => setStep('fan_setup')}>
                <SymbolView name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} size={40} tintColor={theme.text} />
                <ThemedText type="default" style={styles.roleText}>{t('onboarding.roleFan')}</ThemedText>
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.langPickerContainer}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginRight: Spacing.two }}>{t('onboarding.language')}</ThemedText>

            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', borderRadius: 8 }}
              onPress={() => setShowLangDropdown(true)}
            >
              <ThemedText style={{ fontSize: 14, fontWeight: 'bold', marginRight: 8 }}>
                {{ cs: 'CZ', sk: 'SK', en: 'EN', de: 'DE', pl: 'PL', es: 'ES', fr: 'FR' }[currentLang === 'system' ? 'en' : currentLang] || 'EN'}
              </ThemedText>
              <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} size={16} tintColor={theme.textSecondary} />
            </Pressable>
          </View>

          <Modal visible={showLangDropdown} transparent animationType="fade" onRequestClose={() => setShowLangDropdown(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setShowLangDropdown(false)}>
              <Pressable style={[styles.modalBox, { backgroundColor: theme.backgroundElement, maxWidth: 300 }]} onPress={e => e.stopPropagation()}>
                <ThemedText type="subtitle" style={{ marginBottom: 16, textAlign: 'center' }}>{t('onboarding.language')}</ThemedText>
                <View style={{ gap: 8 }}>
                  {['cs', 'sk', 'en', 'de', 'pl', 'es', 'fr'].map((langKey) => {
                    const labelMap: Record<string, string> = { cs: 'Čeština (CZ)', sk: 'Slovenčina (SK)', en: 'English (EN)', de: 'Deutsch (DE)', pl: 'Polski (PL)', es: 'Español (ES)', fr: 'Français (FR)' };
                    const isSelected = currentLang === langKey || (currentLang === 'system' && langKey === 'en');
                    return (
                      <Pressable
                        key={langKey}
                        onPress={() => {
                          useAppStore.getState().setLanguage(langKey as any);
                          setShowLangDropdown(false);
                        }}
                        style={[
                          { padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                          isSelected ? { backgroundColor: 'rgba(33, 150, 243, 0.15)' } : { backgroundColor: 'rgba(150,150,150,0.05)' }
                        ]}
                      >
                        <ThemedText style={{ fontSize: 16, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#2196f3' : theme.text }}>
                          {labelMap[langKey]}
                        </ThemedText>
                        {isSelected && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={18} tintColor="#2196f3" />}
                      </Pressable>
                    );
                  })}
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </SafeAreaView>
      </ThemedView>
      </KeyboardAvoidingView>
    );
  }

      if (step === 'admin_create') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'space-between' }]}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={() => setStep('role_selection')} style={styles.backButton}>
              <ThemedText type="linkPrimary">{t('onboarding.backToRole') || '← Zpět na výběr role'}</ThemedText>
            </Pressable>

            <ThemedText type="subtitle" style={styles.mainTitle}>{t('onboarding.create.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: Spacing.four }}>Krok {adminCreateStep} ze 4</ThemedText>

            {adminCreateStep === 1 && (
              <View>
                <ThemedText type="smallBold">{t('onboarding.create.bandName')} *</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={bandName} onChangeText={setBandName} placeholder={t('onboarding.placeholder.bandName')} placeholderTextColor={theme.textSecondary} />

                <ThemedText type="smallBold">{t('onboarding.create.genre')}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={genre} onChangeText={setGenre} placeholder={t('onboarding.placeholder.genre')} placeholderTextColor={theme.textSecondary} />

                <ThemedText type="smallBold">{t('band.country.label')}</ThemedText>
                <Pressable
                  style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: theme.backgroundElement }]}
                  onPress={() => setShowCountryModal(true)}
                >
                  <ThemedText type="default" style={{ color: theme.text }}>
                    {getCountryDisplayName(country, currentLang)}
                  </ThemedText>
                  <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} size={20} tintColor={theme.textSecondary} />
                </Pressable>

                <ThemedText type="smallBold">{t('onboarding.logoLabel')}</ThemedText>
                {logoUri && <Image source={{ uri: logoUri }} style={styles.logoPreview} contentFit="cover" />}

                <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four, marginTop: Spacing.two}}>
                  <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromGallery}>
                    <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={20} tintColor={theme.text} />
                    <ThemedText type="small" style={{marginTop: 5}}>{t('band.edit.fromGallery')}</ThemedText>
                  </Pressable>
                  <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromFolder}>
                    <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={20} tintColor={theme.text} />
                    <ThemedText type="small" style={{marginTop: 5}}>{t('band.edit.fromFolder')}</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {adminCreateStep === 2 && (
              <View>
                <ThemedText type="smallBold">{t('onboarding.webLabel')}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={web} onChangeText={setWeb} placeholder={t('onboarding.placeholder.web')} placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

                <ThemedText type="smallBold">{t('onboarding.fbLabel')}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={facebook} onChangeText={setFacebook} placeholder={t('onboarding.placeholder.fb')} placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

                <ThemedText type="smallBold">{t('onboarding.igLabel')}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={instagram} onChangeText={setInstagram} placeholder={t('onboarding.placeholder.ig')} placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

                <ThemedText type="smallBold">{t('onboarding.bzLabel')}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={bandzone} onChangeText={setBandzone} placeholder={t('onboarding.placeholder.bz')} placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />
              </View>
            )}

            {adminCreateStep === 3 && (
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
                  {t('settings.calendar.desc') || 'Připojte sdílené kalendáře pro členy kapely.'}
                </ThemedText>

                <ThemedText type="smallBold">{t('settings.calendar.googleId') || 'Google Kalendář ID (E-mail)'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4, marginBottom: 6, fontSize: 11 }}>
                    {t('settings.calendar.googleBotHint') || 'Nasdílejte v Google Kalendáři váš kalendář s e-mailem:'}
                  </ThemedText>
                  <Pressable
                    style={{ padding: 8, backgroundColor: 'rgba(33, 150, 243, 0.12)', borderRadius: 6, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                    onPress={() => {
                      Clipboard.setStringAsync('kapela-calendar-bot@kapela-app.iam.gserviceaccount.com');
                      Alert.alert(t('stageplan.dl.success'), 'E-mail robota zkopírován do schránky.');
                    }}
                  >
                    <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 11, flex: 1, marginRight: 4 }}>
                      kapela-calendar-bot@kapela-app.iam.gserviceaccount.com
                    </ThemedText>
                    <SymbolView name={{ ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }} size={14} tintColor="#2196f3" />
                  </Pressable>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={googleCalendarId} onChangeText={setGoogleCalendarId} placeholder="kapela@gmail.com" placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none" />

                <ThemedText type="smallBold">{t('settings.calendar.appleUrl') || 'Apple/iCloud veřejný odkaz'}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={appleCalendarUrl} onChangeText={setAppleCalendarUrl} placeholder="webcal://..." placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />
              </View>
            )}

            {adminCreateStep === 4 && (
              <View>
                <ThemedText type="smallBold">{t('onboarding.adminName') || 'Vaše jméno (Kapelník) *'}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={adminDisplayName} onChangeText={setAdminDisplayName} placeholder={t('form.member.namePlaceholder') || 'Zadejte své jméno'} placeholderTextColor={theme.textSecondary} />

                <ThemedText type="smallBold">{t('onboarding.adminInstrument') || 'Váš nástroj / Role *'}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={adminInstrument} onChangeText={setAdminInstrument} placeholder={t('form.member.instrumentPlaceholder') || 'Např. Kytara, Zpěv'} placeholderTextColor={theme.textSecondary} />

                <ThemedText type="smallBold">{t('onboarding.adminPassReq')}</ThemedText>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholderTextColor={theme.textSecondary} />

                <Checkbox label={t('onboarding.stayLogged')} />
              </View>
            )}

            {showCountryModal && (
              <CountryPickerModal
                visible={showCountryModal}
                selectedCountryCode={country}
                onSelect={setCountry}
                onClose={() => setShowCountryModal(false)}
              />
            )}
          </ScrollView>

          {/* SDÍLENÁ DŮLEŽITÁ LIŠTA TLAČÍTEK PEVNĚ DOLE */}
          <View style={[styles.wizardBtnRow, { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three }]}>
            {adminCreateStep === 1 ? (
              <View />
            ) : (
              <Pressable style={[styles.wizardBtn, { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)' }]} onPress={() => setAdminCreateStep(adminCreateStep - 1)}>
                <ThemedText type="default" style={{ color: theme.text }}>← {t('onboarding.btn.prev') || 'Zpět'}</ThemedText>
              </Pressable>
            )}

            {adminCreateStep < 4 ? (
              <Pressable style={[styles.wizardBtn, { backgroundColor: theme.text }]} onPress={() => {
                if (adminCreateStep === 1 && !bandName.trim()) {
                  Alert.alert(t('home.attendance.errorTitle'), t('form.member.errorFields') || 'Vyplňte povinné údaje');
                  return;
                }
                setAdminCreateStep(adminCreateStep + 1);
              }}>
                <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>{t('onboarding.btn.next') || 'Další'} →</ThemedText>
              </Pressable>
            ) : (
              <Pressable style={[styles.wizardBtn, { backgroundColor: '#4caf50' }]} onPress={handleCreateBand}>
                <ThemedText type="default" style={{ color: '#fff', fontWeight: 'bold' }}>{t('onboarding.create.btn')}</ThemedText>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'member_band') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} >
            <Pressable onPress={() => setStep('role_selection')} style={styles.backButton}>
              <ThemedText type="linkPrimary">{t('onboarding.btn.back')}</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.mainTitle}>{t('onboarding.select.title')}</ThemedText>

            <View style={styles.bandList}>
              {availableBands.map(band => (
                <Pressable key={band.id} style={styles.bandItem} onPress={() => handleBandSelectForMember(band)}>
                  {band.logoUri ? (
                      <Image source={{uri: band.logoUri}} style={{width: 40, height: 40, borderRadius: 20, marginRight: 10}} />
                    ) : (
                      <View style={{width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center'}}>
                        <ThemedText style={{fontSize: 20, fontWeight: 'bold'}}>{band.name ? band.name.charAt(0).toUpperCase() : '?'}</ThemedText>
                      </View>
                    )}
                  <ThemedText type="default">{band.name}</ThemedText>
                </Pressable>
              ))}
              {availableBands.length === 0 && <ThemedText type="small" themeColor="textSecondary">{t('onboarding.noBands')}</ThemedText>}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'member_person') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} >
            <Pressable onPress={() => setStep('member_band')} style={styles.backButton}>
              <ThemedText type="linkPrimary">{t('onboarding.backToBand')}</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.mainTitle}>{t('onboarding.whoAreYou')}</ThemedText>

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
                      <ThemedText type="small"  style={{fontWeight: 'bold'}}>{t('onboarding.remembered')}</ThemedText>
                    )}
                  </Pressable>
                ))}
                {availableMembers.length === 0 && <ThemedText type="small" themeColor="textSecondary">{t('onboarding.noMembers')}</ThemedText>}
              </View>
            ) : (
              <View style={{marginTop: 20}}>
                <ThemedText type="smallBold">{t('onboarding.enterPassFor').replace('{name}', selectedMember.nickname || selectedMember.firstName)}</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
                  value={memberPassword}
                  onChangeText={setMemberPassword}
                  secureTextEntry
                  autoFocus
                />
                <Checkbox label={t('onboarding.stayLogged')} />
                <View style={{flexDirection: 'row', gap: 10}}>
                   <Pressable style={[styles.primaryButton, { flex: 1, backgroundColor: theme.backgroundElement, marginTop: 0 }]} onPress={() => setSelectedMember(null)}>
                     <ThemedText type="default">{t('onboarding.btn.back')}</ThemedText>
                   </Pressable>
                   <Pressable style={[styles.primaryButton, { flex: 1, backgroundColor: theme.text, marginTop: 0 }]} onPress={handleMemberLogin}>
                     <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>{t('onboarding.btn.login')}</ThemedText>
                   </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'fan_setup') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} >
            <Pressable onPress={() => setStep('role_selection')} style={styles.backButton}>
              <ThemedText type="linkPrimary">{t('onboarding.btn.back')}</ThemedText>
            </Pressable>

            <ThemedText type="subtitle" style={styles.mainTitle}>{t('onboarding.fan.title')}</ThemedText>

            <ThemedText type="smallBold">{t('onboarding.fanName')} *</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={fanName} onChangeText={setFanName} placeholder="Jan Novák" placeholderTextColor={theme.textSecondary} />

            <ThemedText type="smallBold">{t('onboarding.fanEmail')}</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={fanEmail} onChangeText={setFanEmail} keyboardType="email-address" placeholder="jan.novak@email.cz" placeholderTextColor={theme.textSecondary} autoCapitalize="none" />

            <ThemedText type="smallBold">{t('fans.form.phone') || 'Telefon (nepovinné)'}</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={fanPhone} onChangeText={setFanPhone} keyboardType="phone-pad" placeholder="+420 777 123 456" placeholderTextColor={theme.textSecondary} />

            <ThemedText type="smallBold" style={{marginTop: 10}}>{t('onboarding.fanSelectBand')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{marginBottom: 6}}>{t('onboarding.fanSelectMultiHint') || 'Můžete vybrat i více kapel současně (kliknutím):'}</ThemedText>
            <View style={styles.bandList}>
              {availableBands.map(band => {
                const isSelected = selectedFanBands.some(b => b.id === band.id);
                return (
                  <Pressable
                    key={band.id}
                    style={[
                      styles.bandItem,
                      isSelected && { borderColor: '#4caf50', borderWidth: 2, backgroundColor: 'rgba(76, 175, 80, 0.15)' }
                    ]}
                    onPress={() => toggleFanBand(band)}
                  >
                    {band.logoUri ? (
                      <Image source={{uri: band.logoUri}} style={{width: 32, height: 32, borderRadius: 16, marginRight: 10}} />
                    ) : (
                      <View style={{width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center'}}>
                        <ThemedText style={{fontSize: 16, fontWeight: 'bold'}}>{band.name ? band.name.charAt(0).toUpperCase() : '?'}</ThemedText>
                      </View>
                    )}
                    <ThemedText type="default" style={{ flex: 1, fontWeight: isSelected ? 'bold' : 'normal' }}>
                      {band.name}
                    </ThemedText>
                    {isSelected && (
                      <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={20} tintColor="#4caf50" />
                    )}
                  </Pressable>
                );
              })}
              {availableBands.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#2196f3" />
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 8 }}>
                    {t('onboarding.loadingBands') || 'Načítám dostupné kapely...'}
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={{marginTop: Spacing.four}}>
              <Checkbox label={t('onboarding.stayLogged')} />
            </View>

            <Pressable style={[styles.primaryButton, { backgroundColor: theme.text }]} onPress={handleFanLogin}>
              <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>{t('onboarding.fan.btn')}</ThemedText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
      </KeyboardAvoidingView>
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
  roleContainer: { gap: Spacing.four },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.four, borderRadius: Spacing.four, gap: Spacing.four },
  roleText: { fontSize: 18, fontWeight: 'bold' },

  langPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', marginRight: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
  },
  backButton: { marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, marginTop: Spacing.one, marginBottom: Spacing.four, fontSize: 16 },
  logoPreview: { width: '100%', aspectRatio: 16/9, borderRadius: Spacing.two, marginTop: Spacing.two },
  primaryButton: { padding: Spacing.four, borderRadius: Spacing.six, alignItems: 'center', marginTop: Spacing.two },
  button: { flex: 1, padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  bandList: { gap: Spacing.two, marginTop: Spacing.one },
  bandItem: { padding: Spacing.three, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: Spacing.two, flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.four },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#aaa', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.two },
  wizardBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)'
  },
  wizardBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },

});
