import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Modal, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { PageHeader } from './page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import * as Clipboard from 'expo-clipboard';
import { Band, BandMember, Fan } from '@/types';
import { updateBand, getBandMembers, addBandMember, updateBandMember, getBandFans, addFanToBand, updateFanInBand, deleteFanFromBand } from '@/services/firebaseService';
import { AddMemberForm } from './add-member-form';
import { AddFanForm } from './add-fan-form';
import { DraggableChips } from './draggable-chips';
import { StageplanModal } from './stageplan-modal';
import { CountryPickerModal } from './country-picker-modal';
import { getCountryDisplayName } from '@/constants/countries';
import { useTranslation } from '@/utils/i18n';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
WebBrowser.maybeCompleteAuthSession();
import { getAvailableCalendars, getSyncCalendarId, setSyncCalendarId } from '@/services/calendarSyncService';
import * as Calendar from 'expo-calendar';
import { WebView } from 'react-native-webview';
import { getGoogleUserProfileAndCalendar, exchangeCodeForTokens, createGoogleCalendarEventOAuth, updateGoogleCalendarEventOAuth, deleteGoogleCalendarEventOAuth } from '@/services/googleCalendarService';


interface Props {
  band: Band;
  onSave: (updates: Partial<Band>) => void;
  onCancel: () => void;
}

export function EditBandForm({ band, onSave, onCancel }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { manageBandTab, currentUser, activeRoleView, setActiveRoleView, language, setLanguage } = useAppStore();
  const { t, currentLang } = useTranslation();

  const activeTab = manageBandTab;

      const handleGoogleOAuthLogin = () => {
    setShowGoogleAuthModal(true);
  };

      const handleWebViewUrl = async (url: string) => {
    if (!url) return;

    // A) VÝMĚNA AUTHORIZATION CODE ZA TRVALÝ REFRESH TOKEN (NEVYPRŠÍ)
    if (url.includes('code=')) {
      setShowGoogleAuthModal(false);
      const match = url.match(/code=([^&]+)/);
      if (match && match[1]) {
        const code = decodeURIComponent(match[1]);
        const redirectUri = 'https://auth.expo.io/@barry2709/kapela_ios_android';
        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (tokens && tokens.accessToken) {
            const profile = await getGoogleUserProfileAndCalendar(tokens.accessToken);
            if (profile) {
              const updates = {
                googleCalendarAccessToken: tokens.accessToken,
                googleCalendarRefreshToken: tokens.refreshToken || undefined,
                googleCalendarId: profile.calendarId,
                googleCalendarUserEmail: profile.email,
              };
              await updateBand(band.id, updates);
              onSave(updates);
              setGoogleCalendarId(profile.calendarId);
              Alert.alert(t('events.alert.success'), `Google Kalendář TRVALE připojen k účtu: ${profile.email}`);
            }
          }
        } catch (e) {
          console.error("Chyba při výměně kódu:", e);
        }
      }
    }
    // B) PŘÍMÝ ACCESS TOKEN (IMPLICIT FALLBACK)
    else if (url.includes('access_token=')) {
      setShowGoogleAuthModal(false);
      const match = url.match(/access_token=([^&]+)/);
      if (match && match[1]) {
        const token = match[1];
        try {
          const profile = await getGoogleUserProfileAndCalendar(token);
          if (profile) {
            const updates = {
              googleCalendarAccessToken: token,
              googleCalendarId: profile.calendarId,
              googleCalendarUserEmail: profile.email,
            };
            await updateBand(band.id, updates);
            onSave(updates);
            setGoogleCalendarId(profile.calendarId);
            Alert.alert(t('events.alert.success'), `Google Kalendář připojen k účtu: ${profile.email}`);
          }
        } catch (e) {
          console.error("Chyba při zpracování tokenu:", e);
        }
      }
    }
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    if (navState.url) {
      handleWebViewUrl(navState.url);
    }
  };


  


  useEffect(() => {
    if (activeTab === 'settings' || activeTab === ('fans' as any)) {
      getAvailableCalendars().then(setLocalCalendars).catch(console.error);
      getSyncCalendarId(band.id).then(id => setSelectedLocalCalId(id || '')).catch(console.error);
    }
  }, [activeTab, band.id]);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  // Band form state
  const [name, setName] = useState(band.name);
  const [genre, setGenre] = useState(band.genre || '');
  const [country, setCountry] = useState(band.country || 'CZ');
  const [googleCalendarId, setGoogleCalendarId] = useState(band.googleCalendarId || '');
  const [appleCalendarUrl, setAppleCalendarUrl] = useState(band.appleCalendarUrl || '');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [web, setWeb] = useState(band.web || '');
  const [facebook, setFacebook] = useState(band.facebook || '');
  const [instagram, setInstagram] = useState(band.instagram || '');
  const [bandzone, setBandzone] = useState(band.bandzone || '');
  const [logoUri, setLogoUri] = useState<string | null>(band.logoUri || null);
  const [isSaving, setIsSaving] = useState(false);
  const [showStageplan, setShowStageplan] = useState(false);

  // Settings presets state (při prvním startu zcela prázdné)
  const [techRiderPresets, setTechRiderPresets] = useState<string[]>(
    band.techRiderPresets || []
  );
  const [whatToTakePresets, setWhatToTakePresets] = useState<string[]>(
    band.whatToTakePresets || []
  );

  const [newTechRiderInput, setNewTechRiderInput] = useState('');
  const [newWhatToTakeInput, setNewWhatToTakeInput] = useState('');
  const [localCalendars, setLocalCalendars] = useState<any[]>([]);
  const [selectedLocalCalId, setSelectedLocalCalId] = useState('');
  const [showLocalCalDropdown, setShowLocalCalDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  const [isSocialsOpen, setIsSocialsOpen] = useState(false);
  const [isCalendarsOpen, setIsCalendarsOpen] = useState(false);

  const languageOptions = [
    { key: 'system', label: t('settings.language.system'), flag: '⚙️' },
    { key: 'cs', label: t('settings.language.cs'), flag: '🇨🇿' },
    { key: 'sk', label: t('settings.language.sk'), flag: '🇸🇰' },
    { key: 'en', label: t('settings.language.en'), flag: '🇬🇧' },
    { key: 'de', label: t('settings.language.de'), flag: '🇩🇪' },
    { key: 'pl', label: t('settings.language.pl'), flag: '🇵🇱' },
    { key: 'es', label: t('settings.language.es'), flag: '🇪🇸' },
    { key: 'fr', label: t('settings.language.fr'), flag: '🇫🇷' },
  ] as const;

  const currentLangObj = languageOptions.find(o => o.key === language) || languageOptions[0];

  const addTechRiderPreset = () => {
    if (!newTechRiderInput.trim()) return;
    const item = newTechRiderInput.trim();
    if (!techRiderPresets.includes(item)) {
      const updated = [...techRiderPresets, item];
      setTechRiderPresets(updated);
      onSave({ techRiderPresets: updated });
    }
    setNewTechRiderInput('');
  };

  const removeTechRiderPreset = (item: string) => {
    const updated = techRiderPresets.filter(i => i !== item);
    setTechRiderPresets(updated);
    onSave({ techRiderPresets: updated });
  };

  const addWhatToTakePreset = () => {
    if (!newWhatToTakeInput.trim()) return;
    const item = newWhatToTakeInput.trim();
    if (!whatToTakePresets.includes(item)) {
      const updated = [...whatToTakePresets, item];
      setWhatToTakePresets(updated);
      onSave({ whatToTakePresets: updated });
    }
    setNewWhatToTakeInput('');
  };

  const removeWhatToTakePreset = (item: string) => {
    const updated = whatToTakePresets.filter(i => i !== item);
    setWhatToTakePresets(updated);
    onSave({ whatToTakePresets: updated });
  };

  // Reorder state & helpers pro přesun štítků
  const [editingTechIndex, setEditingTechIndex] = useState<number | null>(null);
  const [editingWhatIndex, setEditingWhatIndex] = useState<number | null>(null);

  const moveTechRiderItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= techRiderPresets.length) return;
    const updated = [...techRiderPresets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setTechRiderPresets(updated);
    onSave({ techRiderPresets: updated });
    setEditingTechIndex(toIndex);
  };

  const moveWhatToTakeItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= whatToTakePresets.length) return;
    const updated = [...whatToTakePresets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setWhatToTakePresets(updated);
    onSave({ whatToTakePresets: updated });
    setEditingWhatIndex(toIndex);
  };

  // Members state
  const [members, setMembers] = useState<BandMember[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<BandMember | null>(null);

  // Stav účasti členů pro dynamický výpočet techniky
  const [attendingMemberIds, setAttendingMemberIds] = useState<Record<string, boolean>>({});

  const toggleMemberAttendance = (memberId: string) => {
    setAttendingMemberIds(prev => ({
      ...prev,
      [memberId]: prev[memberId] === undefined ? false : !prev[memberId]
    }));
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const data = await getBandMembers(band.id);
      setMembers(data);
    } catch (e) {
      console.error("Nepodařilo se načíst členy", e);
    }
  };

  // Fans state
  const [fans, setFans] = useState<Fan[]>([]);
  const [fanSearch, setFanSearch] = useState('');
  const [showAddFanModal, setShowAddFanModal] = useState(false);
  const [editingFan, setEditingFan] = useState<Fan | null>(null);

  useEffect(() => {
    if (activeTab === ('fans' as any)) {
      loadFans();
    }
  }, [activeTab]);

  const loadFans = async () => {
    try {
      const data = await getBandFans(band.id);
      setFans(data);
    } catch (e) {
      console.error("Nepodařilo se načíst fanoušky", e);
    }
  };

  const handleSaveFan = async (fanData: Omit<Fan, 'id' | 'joinedAt'>) => {
    try {
      if (editingFan) {
        await updateFanInBand(band.id, editingFan.id, fanData);
      } else {
        await addFanToBand(band.id, fanData);
      }
      setShowAddFanModal(false);
      setEditingFan(null);
      loadFans();
    } catch (e) {
      console.error("Chyba při ukládání fanouška:", e);
      Alert.alert(t('home.attendance.errorTitle'), t('fans.errorSave'));
    }
  };

  const handleDeleteFan = (fan: Fan) => {
    Alert.alert(
      t('fans.deleteTitle'),
      t('fans.deleteConfirm', { name: fan.name }),
      [
        { text: t('home.misc.cancel'), style: 'cancel' },
        {
          text: t('form.common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteFanFromBand(band.id, fan.id);
            loadFans();
          }
        }
      ]
    );
  };

  const copyFanEmails = () => {
    const emails = fans.map(f => f.email).filter(Boolean).join(', ');
    if (!emails) return;
    Clipboard.setStringAsync(emails);
    Alert.alert(t('stageplan.dl.success'), t('fans.copyEmailsSuccess'));
  };

  const handleSaveMember = async (memberData: Omit<BandMember, 'id'>) => {
    try {
      if (editingMember) {
        await updateBandMember(band.id, editingMember.id, memberData);
      } else {
        await addBandMember(band.id, memberData);
      }
      setShowAddMemberModal(false);
      setEditingMember(null);
      loadMembers();
    } catch (e) {
      console.error("Nepodařilo se uložit člena", e);
    }
  };

  const openAddMember = () => {
    setEditingMember(null);
    setShowAddMemberModal(true);
  };

  const openEditMember = (member: BandMember) => {
    setEditingMember(member);
    setShowAddMemberModal(true);
  };

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

  const handleSave = async () => {
    if (!name) {
      Alert.alert(t('home.attendance.errorTitle'), t('band.edit.errorName'));
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name,
        genre,
        country,
        web,
        facebook,
        instagram,
        bandzone,
        logoUri: logoUri || undefined,
        googleCalendarId: googleCalendarId.trim() || "",
        appleCalendarUrl: appleCalendarUrl.trim() || "",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (activeRoleView === 'fan') {
    return (
      <View style={styles.container}>
        <PageHeader title="O kapele" />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Logo kapely */}
          {band.logoUri ? (
            <Image source={{ uri: band.logoUri }} style={styles.fanLogo} contentFit="contain" />
          ) : null}

          {/* Název a žánr */}
          <View style={{ alignItems: 'center', marginVertical: Spacing.two }}>
            <ThemedText type="title" style={{ fontSize: 26, textAlign: 'center' }}>
              {band.name}
            </ThemedText>
            {band.genre || band.country ? (
              <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: 4 }}>
                {[band.genre, getCountryDisplayName(band.country, currentLang)].filter(Boolean).join(' • ')}
              </ThemedText>
            ) : null}
          </View>

          {/* Popis kapely */}
          {band.description ? (
            <ThemedView type="backgroundElement" style={styles.fanBox}>
              <ThemedText type="default">{band.description}</ThemedText>
            </ThemedView>
          ) : null}

          {/* Web a sociální sítě */}
          <View style={{ gap: 8, marginTop: Spacing.two - 4, marginBottom: Spacing.two }}>
            {band.web ? (
              <Pressable
                style={[styles.fanWebBtn, { backgroundColor: theme.backgroundElement }]}
                onPress={() => {
                  let url = band.web!;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                  }
                  Linking.openURL(url);
                }}
              >
                <SymbolView name={{ ios: 'globe', android: 'language', web: 'language' }} size={20} tintColor={theme.text} />
                <ThemedText type="smallBold" style={{ marginLeft: 8 }}>
                  {band.web}
                </ThemedText>
              </Pressable>
            ) : null}

            {band.facebook ? (
              <Pressable
                style={[
                  styles.fanWebBtn,
                  {
                    backgroundColor: 'rgba(24, 119, 242, 0.15)',
                    borderColor: 'rgba(24, 119, 242, 0.4)',
                    borderWidth: 1,
                    marginTop: -4,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }
                ]}
                onPress={() => {
                  let url = band.facebook!;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                  }
                  Linking.openURL(url);
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#1877f2', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                  <ThemedText style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold', lineHeight: 17 }}>f</ThemedText>
                </View>
                <ThemedText type="smallBold" style={{ color: '#1877f2', textAlign: 'center' }}>
                  Facebook: {band.facebook}
                </ThemedText>
              </Pressable>
            ) : null}

            {band.instagram ? (
              <Pressable
                style={[styles.fanWebBtn, { backgroundColor: 'rgba(225, 48, 108, 0.15)', borderColor: 'rgba(225, 48, 108, 0.4)', borderWidth: 1 }]}
                onPress={() => {
                  let url = band.instagram!;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                  }
                  Linking.openURL(url);
                }}
              >
                <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'camera' }} size={20} tintColor="#e1306c" />
                <ThemedText type="smallBold" style={{ marginLeft: 8, color: '#e1306c' }}>
                  Instagram: {band.instagram}
                </ThemedText>
              </Pressable>
            ) : null}

            {band.bandzone ? (
              <Pressable
                style={[styles.fanWebBtn, { backgroundColor: 'rgba(255, 87, 34, 0.15)', borderColor: 'rgba(255, 87, 34, 0.4)', borderWidth: 1 }]}
                onPress={() => {
                  let url = band.bandzone!;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                  }
                  Linking.openURL(url);
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#ff5722', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                  <ThemedText style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', lineHeight: 15 }}>BZ</ThemedText>
                </View>
                <ThemedText type="smallBold" style={{ color: '#ff5722', textAlign: 'center' }}>
                  Bandzone: {band.bandzone}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {/* Seznam členů kapely (Pouze Jméno, Příjmení a Nástroj/Zpěv) */}
          <ThemedText type="subtitle" style={{ marginTop: Spacing.four, marginBottom: Spacing.three }}>
            {t('band.edit.membersList')}
          </ThemedText>

          <View style={{ gap: Spacing.three }}>
            {members.map(member => (
              <ThemedView key={member.id} type="backgroundElement" style={styles.fanMemberCard}>
                {member.photoUri ? (
                  <Image source={{ uri: member.photoUri }} style={styles.fanMemberPhoto} />
                ) : (
                  <View style={[styles.fanMemberPhoto, { backgroundColor: 'rgba(150,150,150,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                    <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={24} tintColor={theme.textSecondary} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16 }}>
                      {member.firstName} {member.lastName}
                    </ThemedText>
                    {member.isGuest && (
                      <View style={[styles.badge, { backgroundColor: '#2196f3' }]}>
                        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>{t('band.edit.guest')}</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                    {member.instrument}
                  </ThemedText>
                </View>
              </ThemedView>
            ))}

            {members.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 10 }}>
                {t('band.edit.noMembers')}
              </ThemedText>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader title={
        activeTab === 'band' ? t('header.editBand') :
        activeTab === 'members' ? t('header.manageMembers') :
        activeTab === 'tech' ? t('header.techRider') : activeTab === ('fans' as any) ? t('nav.fans') : t('header.appSettings')
      } />

      <ScrollView contentContainerStyle={styles.content} scrollEnabled={isScrollEnabled} keyboardShouldPersistTaps="handled">
        {activeTab === 'settings' ? (
          <View style={{ gap: Spacing.four }}>
            <ThemedText type="subtitle">{t('settings.title')}</ThemedText>

            {/* 0. Volba jazyka jako rolovací menu (Dropdown) */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                🌐 {t('settings.language')}
              </ThemedText>

              <Pressable
                style={[
                  styles.dropdownSelectBtn,
                  { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }
                ]}
                onPress={() => setShowLanguageDropdown(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ThemedText style={{ fontSize: 18 }}>{currentLangObj.flag}</ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.text, fontSize: 14 }}>
                    {currentLangObj.label}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }}
                  size={20}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </ThemedView>

            {/* 1. Nastavit technický rider */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                {t('settings.techRider.title')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                {t('settings.techRider.desc')}
              </ThemedText>

              {/* Vstupní políčko s tlačítkem + */}
              <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 0 }
                  ]}
                  value={newTechRiderInput}
                  onChangeText={setNewTechRiderInput}
                  onSubmitEditing={addTechRiderPreset}
                  returnKeyType="done"
                  placeholder={t('settings.techRider.placeholder')}
                  placeholderTextColor={theme.textSecondary}
                />
                <Pressable
                  style={[styles.circleAddBtn, { backgroundColor: theme.text }]}
                  onPress={addTechRiderPreset}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={20} tintColor={theme.background} />
                </Pressable>
              </View>

              {/* Draggable Štítky s položkami (podržením a tažením se přesouvají) */}
              <DraggableChips
                items={techRiderPresets}
                onReorder={(newItems) => {
                  setTechRiderPresets(newItems);
                }}
                onRemove={removeTechRiderPreset}
                onDragStart={() => setIsScrollEnabled(false)}
                onDragEnd={(finalItems) => {
                  setIsScrollEnabled(true);
                  setTechRiderPresets(finalItems);
                  onSave({ techRiderPresets: finalItems });
                }}
                emptyText={t('settings.techRider.empty')}
              />
            </ThemedView>

            {/* 2. Nastavit co vzít s sebou */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                {t('settings.whatToTake.title')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                {t('settings.whatToTake.desc')}
              </ThemedText>

              {/* Vstupní políčko s tlačítkem + */}
              <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 0 }
                  ]}
                  value={newWhatToTakeInput}
                  onChangeText={setNewWhatToTakeInput}
                  onSubmitEditing={addWhatToTakePreset}
                  returnKeyType="done"
                  placeholder={t('settings.whatToTake.placeholder')}
                  placeholderTextColor={theme.textSecondary}
                />
                <Pressable
                  style={[styles.circleAddBtn, { backgroundColor: theme.text }]}
                  onPress={addWhatToTakePreset}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={20} tintColor={theme.background} />
                </Pressable>
              </View>

              {/* Draggable Štítky s položkami (podržením a tažením se přesouvají) */}
              <DraggableChips
                items={whatToTakePresets}
                onReorder={(newItems) => {
                  setWhatToTakePresets(newItems);
                }}
                onRemove={removeWhatToTakePreset}
                onDragStart={() => setIsScrollEnabled(false)}
                onDragEnd={(finalItems) => {
                  setIsScrollEnabled(true);
                  setWhatToTakePresets(finalItems);
                  onSave({ whatToTakePresets: finalItems });
                }}
                emptyText={t('settings.whatToTake.empty')}
              />
            </ThemedView>

            

            {/* 3. Synchronizace kalendářů */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                {t('settings.calendar.title')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                {t('settings.calendar.desc')}
              </ThemedText>

              <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>{t('settings.calendar.googleId')}</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: Spacing.two }]}
                value={googleCalendarId}
                onChangeText={(val) => {
                  setGoogleCalendarId(val);
                  onSave({ googleCalendarId: val.trim() || undefined });
                }}
                placeholder="kapela@gmail.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <ThemedText type="smallBold">{t('settings.calendar.appleUrl')}</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                value={appleCalendarUrl}
                onChangeText={(val) => {
                  setAppleCalendarUrl(val);
                  onSave({ appleCalendarUrl: val.trim() || undefined });
                }}
                placeholder="webcal://..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </ThemedView>

            
            {/* 4. Lokální kalendář (zápis do zařízení) */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                {t('settings.localCalendar.title')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                {t('settings.localCalendar.desc')}
              </ThemedText>

              <Pressable
                style={[styles.dropdownSelectBtn, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                onPress={() => setShowLocalCalDropdown(true)}
              >
                <ThemedText type="smallBold" style={{ color: theme.text, fontSize: 14 }}>
                  {selectedLocalCalId ? (localCalendars.find(c => c.id === selectedLocalCalId)?.title || selectedLocalCalId) : t('settings.localCalendar.none')}
                </ThemedText>
                <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} size={20} tintColor={theme.textSecondary} />
              </Pressable>
            </ThemedView>

            <Modal visible={showLocalCalDropdown} transparent animationType="fade" onRequestClose={() => setShowLocalCalDropdown(false)}>
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }} onPress={() => setShowLocalCalDropdown(false)}>
                <Pressable style={{ width: '100%', maxWidth: 350, backgroundColor: theme.backgroundElement, borderRadius: 12, padding: 16, maxHeight: 400 }} onPress={e => e.stopPropagation()}>
                  <ThemedText type="subtitle" style={{ marginBottom: 16, textAlign: 'center' }}>{t('settings.localCalendar.title')}</ThemedText>
                  <ScrollView style={{ gap: 8 }}>
                    <Pressable
                      style={[{ padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, !selectedLocalCalId ? { backgroundColor: 'rgba(33, 150, 243, 0.15)' } : { backgroundColor: 'rgba(150,150,150,0.05)' }]}
                      onPress={async () => {
                        setSelectedLocalCalId('');
                        await setSyncCalendarId(band.id, '');
                        setShowLocalCalDropdown(false);
                      }}
                    >
                      <ThemedText style={{ fontSize: 16, fontWeight: !selectedLocalCalId ? 'bold' : 'normal', color: !selectedLocalCalId ? '#2196f3' : theme.text }}>
                        {t('settings.localCalendar.none')}
                      </ThemedText>
                    </Pressable>
                    {localCalendars.map(cal => (
                      <Pressable
                        key={cal.id}
                        style={[{ padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, selectedLocalCalId === cal.id ? { backgroundColor: 'rgba(33, 150, 243, 0.15)' } : { backgroundColor: 'rgba(150,150,150,0.05)' }]}
                        onPress={async () => {
                          setSelectedLocalCalId(cal.id);
                          await setSyncCalendarId(band.id, cal.id);
                          setShowLocalCalDropdown(false);
                        }}
                      >
                        <ThemedText style={{ fontSize: 16, fontWeight: selectedLocalCalId === cal.id ? 'bold' : 'normal', color: selectedLocalCalId === cal.id ? '#2196f3' : theme.text }}>
                          {cal.title} {cal.source?.name ? `(${cal.source.name})` : ''}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>


            {/* Testování pohledu role */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                {t('band.edit.roleToggle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 12 }}>
                {t('band.edit.roleDesc')}
              </ThemedText>

              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                {[
                  { key: 'admin', label: t('band.edit.roleAdmin'), color: '#ff9800' },
                  { key: 'member', label: t('band.edit.roleMember'), color: '#4caf50' },
                  { key: 'fan', label: t('band.edit.roleFan'), color: '#2196f3' },
                ].map(r => (
                  <Pressable
                    key={r.key}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: activeRoleView === r.key ? r.color : 'rgba(150,150,150,0.15)',
                        borderColor: activeRoleView === r.key ? r.color : 'rgba(150,150,150,0.3)',
                      }
                    ]}
                    onPress={() => setActiveRoleView(r.key as any)}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{ color: activeRoleView === r.key ? '#fff' : theme.text, fontSize: 11 }}
                    >
                      {r.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ThemedView>

            {/* Přihlášení & Paměť */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                {t('band.edit.accountTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('band.edit.accountUser')} <ThemedText type="smallBold">{currentUser?.displayName || 'Kapelník'}</ThemedText>
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                {t('band.edit.accountDesc')}
              </ThemedText>
            </ThemedView>

            {/* Informace o systému */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                {t('band.edit.sysInfo')}
              </ThemedText>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">{t('band.edit.sysApp')}</ThemedText>
                <ThemedText type="small">Band Management App</ThemedText>
              </View>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">{t('band.edit.sysVer')}</ThemedText>
                <ThemedText type="small">1.0.0 (Expo & Firebase)</ThemedText>
              </View>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">{t('band.edit.sysDb')}</ThemedText>
                <ThemedText type="small">kapela / {band.id}</ThemedText>
              </View>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">{t('band.edit.sysStatus')}</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#4caf50' }}>{t('band.edit.connected')}</ThemedText>
              </View>
            </ThemedView>
          </View>
        ) : activeTab === ('fans' as any) ? (
          <View style={{ gap: Spacing.four }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {t('fans.title', { count: fans.length })}
                </ThemedText>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {fans.length > 0 && (
                  <Pressable
                    style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(33,150,243,0.15)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={copyFanEmails}
                  >
                    <SymbolView name={{ ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }} size={16} tintColor="#2196f3" />
                    <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 12 }}>
                      {t('fans.copyEmails')}
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#4caf50', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => {
                    setEditingFan(null);
                    setShowAddFanModal(true);
                  }}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                    {t('fans.addBtn')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {fans.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(200,200,200,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 8 }}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
                <TextInput
                  style={{ flex: 1, color: theme.text, fontSize: 14, padding: 0 }}
                  placeholder={t('fans.searchPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  value={fanSearch}
                  onChangeText={setFanSearch}
                />
              </View>
            )}

            {fans.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                {t('fans.empty')}
              </ThemedText>
            ) : (
              <View style={{ gap: 10 }}>
                {fans
                  .filter(f => !fanSearch.trim() || f.name.toLowerCase().includes(fanSearch.toLowerCase()) || f.email.toLowerCase().includes(fanSearch.toLowerCase()))
                  .map(fan => (
                    <ThemedView key={fan.id} type="backgroundElement" style={{ padding: Spacing.three, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(150,150,150,0.2)', gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <ThemedText type="smallBold" style={{ fontSize: 16 }}>{fan.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">{fan.email}</ThemedText>
                          {fan.phone ? (
                            <Pressable onPress={() => Linking.openURL(`tel:${fan.phone}`)}>
                              <ThemedText type="small" style={{ color: '#2196f3', marginTop: 2 }}>📞 {fan.phone}</ThemedText>
                            </Pressable>
                          ) : null}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable onPress={() => { setEditingFan(fan); setShowAddFanModal(true); }} style={{ padding: 4 }}>
                            <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={18} tintColor="#2196f3" />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteFan(fan)} style={{ padding: 4 }}>
                            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={18} tintColor="#e91e63" />
                          </Pressable>
                        </View>
                      </View>

                      {fan.note ? (
                        <View style={{ marginTop: 4, padding: 6, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 6 }}>
                          <ThemedText type="small" style={{ fontStyle: 'italic' }}>
                            💬 {fan.note}
                          </ThemedText>
                        </View>
                      ) : null}

                      {fan.joinedAt ? (
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 2 }}>
                          🗓 {t('fans.joinedAt')}: {new Date(fan.joinedAt).toLocaleDateString()}
                        </ThemedText>
                      ) : null}
                    </ThemedView>
                  ))}
              </View>
            )}
          </View>
        ) : activeTab === ('fans' as any) ? (
          <View style={{ gap: Spacing.four }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {t('fans.title', { count: fans.length })}
                </ThemedText>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {fans.length > 0 && (
                  <Pressable
                    style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(33,150,243,0.15)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={copyFanEmails}
                  >
                    <SymbolView name={{ ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }} size={16} tintColor="#2196f3" />
                    <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 12 }}>
                      {t('fans.copyEmails')}
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#4caf50', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => {
                    setEditingFan(null);
                    setShowAddFanModal(true);
                  }}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                    {t('fans.addBtn')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {fans.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(200,200,200,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 8 }}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
                <TextInput
                  style={{ flex: 1, color: theme.text, fontSize: 14, padding: 0 }}
                  placeholder={t('fans.searchPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  value={fanSearch}
                  onChangeText={setFanSearch}
                />
              </View>
            )}

            {fans.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                {t('fans.empty')}
              </ThemedText>
            ) : (
              <View style={{ gap: 10 }}>
                {fans
                  .filter(f => !fanSearch.trim() || f.name.toLowerCase().includes(fanSearch.toLowerCase()) || f.email.toLowerCase().includes(fanSearch.toLowerCase()))
                  .map(fan => (
                    <ThemedView key={fan.id} type="backgroundElement" style={{ padding: Spacing.three, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(150,150,150,0.2)', gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <ThemedText type="smallBold" style={{ fontSize: 16 }}>{fan.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">{fan.email}</ThemedText>
                          {fan.phone ? (
                            <Pressable onPress={() => Linking.openURL(`tel:${fan.phone}`)}>
                              <ThemedText type="small" style={{ color: '#2196f3', marginTop: 2 }}>📞 {fan.phone}</ThemedText>
                            </Pressable>
                          ) : null}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable onPress={() => { setEditingFan(fan); setShowAddFanModal(true); }} style={{ padding: 4 }}>
                            <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={18} tintColor="#2196f3" />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteFan(fan)} style={{ padding: 4 }}>
                            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={18} tintColor="#e91e63" />
                          </Pressable>
                        </View>
                      </View>

                      {fan.note ? (
                        <View style={{ marginTop: 4, padding: 6, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 6 }}>
                          <ThemedText type="small" style={{ fontStyle: 'italic' }}>
                            💬 {fan.note}
                          </ThemedText>
                        </View>
                      ) : null}

                      {fan.joinedAt ? (
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 2 }}>
                          🗓 {t('fans.joinedAt')}: {new Date(fan.joinedAt).toLocaleDateString()}
                        </ThemedText>
                      ) : null}
                    </ThemedView>
                  ))}
              </View>
            )}
          </View>
        ) : activeTab === 'tech' ? (() => {
          const attendingMembers = members.filter(m => attendingMemberIds[m.id] !== false);

          return (
            <View style={{ gap: Spacing.four }}>
              {/* Tlačítko Stageplan */}
              <Pressable
                style={{
                  backgroundColor: '#e91e63',
                  paddingVertical: 12,
                  borderRadius: Spacing.two,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={() => setShowStageplan(true)}
              >
                <SymbolView name={{ ios: 'map', android: 'map', web: 'map' }} size={20} tintColor="#fff" />
                <ThemedText type="default" style={{ color: '#fff', fontWeight: 'bold' }}>{t('band.edit.stageplanBtn')}</ThemedText>
              </Pressable>

              {/* Souhrnná karta techniky na pódiu */}
              <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
                <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                  {t('band.edit.techReqTitle').replace('{att}', attendingMembers.length.toString()).replace('{total}', members.length.toString())}
                </ThemedText>

                {techRiderPresets.length > 0 ? (
                  techRiderPresets.map(item => {
                    const count = attendingMembers.filter(m => m.tech?.customTech?.[item]).length;

                    return (
                      <View key={item} style={styles.techRow}>
                        <ThemedText type="smallBold">⚙️ {item}:</ThemedText>
                        <ThemedText type="smallBold" style={{ color: count > 0 ? '#4caf50' : theme.textSecondary, fontSize: 16 }}>
                          {count}×
                        </ThemedText>
                      </View>
                    );
                  })
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginVertical: 8 }}>
                    {t('band.edit.noTechReq')}
                  </ThemedText>
                )}
              </ThemedView>

              {/* Rozpis podle jednotlivých členů s přepínačem účasti */}
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>{t('band.edit.attendanceTitle')}</ThemedText>
              {members.map(m => {
                const isPresent = attendingMemberIds[m.id] !== false;

                return (
                  <ThemedView
                    key={m.id}
                    type="backgroundElement"
                    style={[
                      styles.memberTechCard,
                      !isPresent && { opacity: 0.45, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)' }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <ThemedText type="default" style={{ fontWeight: 'bold' }}>
                          {m.nickname || m.firstName} {m.lastName ? m.lastName : ''}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{m.instrument}</ThemedText>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText type="smallBold" style={{ color: isPresent ? '#4caf50' : theme.textSecondary, fontSize: 12 }}>
                          {isPresent ? t('band.edit.attendanceLabel') : t('band.edit.absenceLabel')}
                        </ThemedText>
                        <Switch
                          value={isPresent}
                          onValueChange={() => toggleMemberAttendance(m.id)}
                          trackColor={{ false: 'rgba(150,150,150,0.3)', true: '#4caf50' }}
                        />
                      </View>
                    </View>

                    {isPresent && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.15)' }}>
                        {m.tech?.customTech && Object.entries(m.tech.customTech).map(([key, val]) => (
                          val ? (
                            <View key={key} style={[styles.techBadge, { backgroundColor: '#4caf50' }]}>
                              <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 11 }}>✓ {key}</ThemedText>
                            </View>
                          ) : null
                        ))}
                      </View>
                    )}
                  </ThemedView>
                );
              })}
            </View>
          );
        })() : activeTab === 'band' ? (
          <View style={{ gap: Spacing.three }}>

            {/* AKORDEON: Základní údaje */}
            <ThemedView type="backgroundElement" style={styles.accordionCard}>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setIsBasicInfoOpen(!isBasicInfoOpen)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={18} tintColor={theme.textSecondary} />
                  <ThemedText type="default" style={{ fontWeight: 'bold' }}>Základní údaje</ThemedText>
                </View>
                <SymbolView name={{ ios: isBasicInfoOpen ? 'chevron.up' : 'chevron.down', android: isBasicInfoOpen ? 'expand_less' : 'expand_more', web: isBasicInfoOpen ? 'expand_less' : 'expand_more' }} size={20} tintColor={theme.textSecondary} />
              </Pressable>

              {isBasicInfoOpen && (
                <View style={styles.accordionBody}>
                  <ThemedText type="smallBold">{t('band.edit.logo')}</ThemedText>
                  {logoUri && (
                    <Image source={{ uri: logoUri }} style={styles.logoPreview} contentFit="contain" />
                  )}
                  <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four}}>
                    <Pressable style={[styles.photoBtn, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]} onPress={pickImageFromGallery}>
                      <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={14} tintColor={theme.text} />
                      <ThemedText type="smallBold" style={{fontSize: 12}}>{t('band.edit.fromGallery')}</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.photoBtn, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]} onPress={pickImageFromFolder}>
                      <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={14} tintColor={theme.text} />
                      <ThemedText type="smallBold" style={{fontSize: 12}}>{t('band.edit.fromFolder')}</ThemedText>
                    </Pressable>
                  </View>

                  <ThemedText type="smallBold">{t('band.edit.nameReq')}</ThemedText>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 12 }]} value={name} onChangeText={setName} placeholderTextColor={theme.textSecondary} />

                  <ThemedText type="smallBold">{t('band.edit.musicGenre')}</ThemedText>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 12 }]} value={genre} onChangeText={setGenre} placeholderTextColor={theme.textSecondary} />

                  <ThemedText type="smallBold">{t('band.country.label')}</ThemedText>
                  <Pressable
                    style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 12 }]}
                    onPress={() => setShowCountryModal(true)}
                  >
                    <ThemedText type="default" style={{ color: theme.text }}>
                      {getCountryDisplayName(country, currentLang)}
                    </ThemedText>
                    <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} size={20} tintColor={theme.textSecondary} />
                  </Pressable>
                </View>
              )}
            </ThemedView>

            {/* AKORDEON: Sociální Sítě a Web */}
            <ThemedView type="backgroundElement" style={styles.accordionCard}>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setIsSocialsOpen(!isSocialsOpen)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SymbolView name={{ ios: 'globe', android: 'public', web: 'public' }} size={18} tintColor={theme.textSecondary} />
                  <ThemedText type="default" style={{ fontWeight: 'bold' }}>Web & Odkazy</ThemedText>
                </View>
                <SymbolView name={{ ios: isSocialsOpen ? 'chevron.up' : 'chevron.down', android: isSocialsOpen ? 'expand_less' : 'expand_more', web: isSocialsOpen ? 'expand_less' : 'expand_more' }} size={20} tintColor={theme.textSecondary} />
              </Pressable>

              {isSocialsOpen && (
                <View style={styles.accordionBody}>
                  <ThemedText type="smallBold">{t('band.edit.webUrl')}</ThemedText>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 12 }]} value={web} onChangeText={setWeb} placeholder="www.mojekapela.cz" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

                  <ThemedText type="smallBold">{t('band.edit.fbUrl')}</ThemedText>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 12 }]} value={facebook} onChangeText={setFacebook} placeholder="facebook.com/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

                  <ThemedText type="smallBold">{t('band.edit.igUrl')}</ThemedText>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 12 }]} value={instagram} onChangeText={setInstagram} placeholder="instagram.com/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

                  <ThemedText type="smallBold">{t('band.edit.bzUrl')}</ThemedText>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 0 }]} value={bandzone} onChangeText={setBandzone} placeholder="bandzone.cz/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />
                </View>
              )}
            </ThemedView>

            {/* AKORDEON: Sdílené kalendáře */}
            <ThemedView type="backgroundElement" style={styles.accordionCard}>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setIsCalendarsOpen(!isCalendarsOpen)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} size={18} tintColor={theme.textSecondary} />
                  <ThemedText type="default" style={{ fontWeight: 'bold' }}>{t('settings.calendar.title')}</ThemedText>
                </View>
                <SymbolView name={{ ios: isCalendarsOpen ? 'chevron.up' : 'chevron.down', android: isCalendarsOpen ? 'expand_less' : 'expand_more', web: isCalendarsOpen ? 'expand_less' : 'expand_more' }} size={20} tintColor={theme.textSecondary} />
              </Pressable>

              {isCalendarsOpen && (
                <View style={styles.accordionBody}>
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                    {t('settings.calendar.desc') || 'Zadejte e-mail/ID vaší kapely na Google Kalendáři nebo veřejný iCloud odkaz:'}
                  </ThemedText>

                  
                                    <ThemedText type="smallBold" style={{ marginBottom: 6 }}>Google Kalendář</ThemedText>
                  {band.googleCalendarAccessToken && band.googleCalendarUserEmail ? (
                    <View style={{ padding: 12, backgroundColor: 'rgba(76, 175, 80, 0.12)', borderRadius: 8, borderWidth: 1, borderColor: '#4caf50', gap: 6, marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ThemedText type="smallBold" style={{ color: '#4caf50', fontSize: 14 }}>
                          ✓ Google Kalendář připojen
                        </ThemedText>
                        <Pressable
                          onPress={() => {
                            onSave({
                              googleCalendarAccessToken: '', googleCalendarRefreshToken: '', googleCalendarId: '', googleCalendarUserEmail: '',
                            });
                          }}
                          style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(233, 30, 99, 0.15)' }}
                        >
                          <ThemedText type="smallBold" style={{ color: '#e91e63', fontSize: 12 }}>Odpojit</ThemedText>
                        </Pressable>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        Účet: {band.googleCalendarUserEmail}
                      </ThemedText>
                    </View>
                  ) : (
                    <Pressable
                      style={{ padding: 12, backgroundColor: '#4285f4', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}
                      onPress={handleGoogleOAuthLogin}
                    >
                      <SymbolView name={{ ios: 'calendar.badge.plus', android: 'event_available', web: 'event_available' }} size={18} tintColor="#fff" />
                      <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 14 }}>
                        🔗 Připojit Google Kalendář 1-klikem
                      </ThemedText>
                    </Pressable>
                  )}

                                    




                  

                  <ThemedText type="smallBold">{t('settings.calendar.appleUrl') || 'Apple/iCloud veřejný odkaz'}</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginBottom: 0 }]}
                    value={appleCalendarUrl}
                    onChangeText={setAppleCalendarUrl}
                    placeholder="webcal://..."
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              )}
            </ThemedView>

            <View style={[styles.buttons, { marginTop: Spacing.four }]}>
              <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel} disabled={isSaving}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('home.misc.cancel')}</ThemedText>
              </Pressable>
              <Pressable style={[styles.button, { backgroundColor: '#4caf50', opacity: isSaving ? 0.7 : 1 }]} onPress={handleSave} disabled={isSaving}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  {isSaving ? t('band.edit.saving') : t('band.edit.saveChanges')}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.membersHeader}>
               <ThemedText type="subtitle">{t('band.edit.manageMembers')}</ThemedText>
               <Pressable style={[styles.addButton, { backgroundColor: theme.backgroundElement }]} onPress={openAddMember}>
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={20} tintColor={theme.text} />
               </Pressable>
            </View>

            <View style={styles.membersList}>
               {members.map(member => (
                 <ThemedView key={member.id} type="backgroundElement" style={styles.memberCard}>
                    {member.photoUri ? (
                       <Image source={{uri: member.photoUri}} style={styles.memberPhoto} />
                    ) : (
                       <View style={[styles.memberPhoto, { backgroundColor: 'rgba(150,150,150,0.2)', justifyContent: 'center', alignItems: 'center'}]}>
                          <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={24} tintColor={theme.textSecondary} />
                       </View>
                    )}
                    <View style={styles.memberInfo}>
                       <ThemedText type="default" style={{fontWeight: 'bold'}}>
                         {member.nickname || member.firstName}
                       </ThemedText>
                       <ThemedText type="small" themeColor="textSecondary">{member.instrument}</ThemedText>

                       {/* Samostatné řádky pro telefon, e-mail a narozeniny */}
                       {member.phone ? (
                         <ThemedText type="small" themeColor="textSecondary" style={{fontSize: 11, marginTop: 2}}>
                           📞 {member.phone}
                         </ThemedText>
                       ) : null}

                       {member.email ? (
                         <ThemedText type="small" themeColor="textSecondary" style={{fontSize: 11, marginTop: 1}}>
                           ✉️ {member.email}
                         </ThemedText>
                       ) : null}

                       {member.birthDate ? (
                         <ThemedText type="small" themeColor="textSecondary" style={{fontSize: 11, marginTop: 1}}>
                           🎂 {member.birthDate}
                         </ThemedText>
                       ) : null}

                       <ThemedText type="code" themeColor="textSecondary" style={{marginTop: 4}}>
                         {member.tech.mic && '🎙️ '}
                         {member.tech.monitor && '🎧 '}
                         {member.tech.pedalboard && '🎛️ '}
                         {member.tech.power230V && '⚡ '}
                       </ThemedText>
                    </View>

                    {/* Pravý horní roh karty pro štítky (Admin, Člen, Host, Neaktivní) a tužku */}
                    <View style={styles.cardRightColumn}>
                      <View style={styles.badgeRow}>
                        {member.isAdmin && (
                          <View style={[styles.badge, { backgroundColor: '#ff9800' }]}>
                            <ThemedText type="smallBold" style={{color: '#fff', fontSize: 10}}>Admin</ThemedText>
                          </View>
                        )}
                        {member.isGuest ? (
                          <View style={[styles.badge, { backgroundColor: '#2196f3' }]}>
                            <ThemedText type="smallBold" style={{color: '#fff', fontSize: 10}}>{t('band.edit.guest')}</ThemedText>
                          </View>
                        ) : (
                          <View style={[styles.badge, { backgroundColor: theme.textSecondary }]}>
                            <ThemedText type="smallBold" style={{color: theme.background, fontSize: 10}}>{t('band.edit.member')}</ThemedText>
                          </View>
                        )}
                        {member.isActive === false && (
                          <View style={[styles.badge, { backgroundColor: '#e91e63' }]}>
                            <ThemedText type="smallBold" style={{color: '#fff', fontSize: 10}}>{t('band.edit.inactive')}</ThemedText>
                          </View>
                        )}
                      </View>

                      <Pressable style={styles.editMemberBtn} onPress={() => openEditMember(member)}>
                          <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={20} tintColor={theme.textSecondary} />
                      </Pressable>
                    </View>
                 </ThemedView>
               ))}
               {members.length === 0 && (
                 <ThemedText type="small" themeColor="textSecondary" style={{textAlign: 'center', marginTop: 10}}>
                   Kapela zatím nemá přidané žádné členy.
                 </ThemedText>
               )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showAddMemberModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
         <ThemedView style={{flex: 1}}>
            <AddMemberForm initialMember={editingMember || undefined} onSave={handleSaveMember} onCancel={() => setShowAddMemberModal(false)} />
         </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAddFanModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ThemedView style={{flex: 1}}>
          <AddFanForm
            initialFan={editingFan || undefined}
            onSave={handleSaveFan}
            onCancel={() => {
              setShowAddFanModal(false);
              setEditingFan(null);
            }}
          />
        </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modál pro Stageplan */}
      <StageplanModal
        visible={showStageplan}
        onClose={() => setShowStageplan(false)}
        band={band}
        members={members}
        onSave={(stageplanData) => onSave({ stageplan: stageplanData })}
      />

      {/* Modál pro výběr země původu */}
      {showCountryModal && (
        <CountryPickerModal
          visible={showCountryModal}
          selectedCountryCode={country}
          onSelect={(cCode) => {
            setCountry(cCode);
            onSave({ country: cCode });
          }}
          onClose={() => setShowCountryModal(false)}
        />
      )}

      {/* Modal pro rolovací menu výběru jazyka */}
      <Modal visible={showLanguageDropdown} transparent animationType="fade" onRequestClose={() => setShowLanguageDropdown(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageDropdown(false)}>
          <ThemedView type="backgroundElement" style={styles.dropdownModalCard}>
            <ThemedText type="subtitle" style={{ fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
              🌐 {t('settings.language')}
            </ThemedText>

            <View style={{ gap: 8 }}>
              {languageOptions.map((opt) => {
                const isSelected = language === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.dropdownOptionRow,
                      {
                        backgroundColor: isSelected ? 'rgba(33,150,243,0.18)' : 'rgba(200,200,200,0.1)',
                        borderColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.2)',
                      }
                    ]}
                    onPress={() => {
                      setLanguage(opt.key as any);
                      setShowLanguageDropdown(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <ThemedText style={{ fontSize: 20 }}>{opt.flag}</ThemedText>
                      <ThemedText type="smallBold" style={{ color: isSelected ? '#2196f3' : theme.text, fontSize: 15 }}>
                        {opt.label}
                      </ThemedText>
                    </View>
                    {isSelected && (
                      <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={20} tintColor="#2196f3" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={{ alignSelf: 'center', marginTop: 16, paddingVertical: 8, paddingHorizontal: 16 }}
              onPress={() => setShowLanguageDropdown(false)}
            >
              <ThemedText type="smallBold" style={{ color: '#e91e63' }}>{t('setlist.pickerClose')}</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* MODAL PRO IN-APP GOOGLE OAUTH PŘIHLÁŠENÍ - UMÍSTĚNO GLOBÁLNĚ */}
      <Modal visible={showGoogleAuthModal} animationType="slide" onRequestClose={() => setShowGoogleAuthModal(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.2)' }}>
            <ThemedText type="subtitle" style={{ fontSize: 18 }}>Přihlášení ke Google Kalendáři</ThemedText>
            <Pressable onPress={() => setShowGoogleAuthModal(false)} style={{ padding: 6 }}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={22} tintColor={theme.text} />
            </Pressable>
          </View>
          <WebView
            source={{
              uri: `https://accounts.google.com/o/oauth2/v2/auth?client_id=69381036546-rbmf4cvdqomducmv11a3hoqk2o6frta2.apps.googleusercontent.com&response_type=code&access_type=offline&prompt=consent&redirect_uri=${encodeURIComponent('https://auth.expo.io/@barry2709/kapela_ios_android')}&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email')}`
            }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onShouldStartLoadWithRequest={(req) => {
              if (req.url && (req.url.includes('code=') || req.url.includes('access_token='))) {
                handleWebViewUrl(req.url);
                return false;
              }
              return true;
            }}
            injectedJavaScript="setInterval(function() { if (window.location.href.indexOf('code=') !== -1 || window.location.href.indexOf('access_token=') !== -1) { window.ReactNativeWebView.postMessage(window.location.href); } }, 300); true;"
            onMessage={(event) => {
              if (event.nativeEvent && event.nativeEvent.data) {
                handleWebViewUrl(event.nativeEvent.data);
              }
            }}
            style={{ flex: 1 }}
            userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  closeBtn: {
    padding: Spacing.one,
  },
  content: {
    padding: Spacing.four,
    paddingTop: 5,
    paddingBottom: Spacing.six * 2,
  },
  title: {
    marginBottom: Spacing.two,
  },
  logoPreview: {
    width: '100%',
    height: 180,
    borderRadius: Spacing.two,
    alignSelf: 'center',
    marginTop: -20,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
    fontSize: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  techSummaryCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  memberTechCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  techBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.15)',
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  fanLogo: {
    width: '100%',
    height: 180,
    borderRadius: Spacing.two,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  fanBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
  fanWebBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
  fanMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  fanMemberPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.three,
  },
  photoBtn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  addButton: { padding: Spacing.two, borderRadius: Spacing.six },
  membersList: { gap: Spacing.three, marginBottom: Spacing.four },
  memberCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'flex-start' },
  memberPhoto: { width: 50, height: 50, borderRadius: 25, marginRight: Spacing.three },
  memberInfo: { flex: 1 },
  cardRightColumn: { alignItems: 'flex-end', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  editMemberBtn: { padding: Spacing.one, marginTop: Spacing.two },

  dropdownSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalCard: {
    width: '85%',
    maxWidth: 360,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },

  bottomBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(150,150,150,0.05)'
  },
  accordionBody: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.1)'
  },

});