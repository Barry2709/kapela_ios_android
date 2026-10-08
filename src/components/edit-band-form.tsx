import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Modal, Switch } from 'react-native';
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
import { Band, BandMember } from '@/types';
import { getBandMembers, addBandMember, updateBandMember } from '@/services/firebaseService';
import { AddMemberForm } from './add-member-form';
import { DraggableChips } from './draggable-chips';
import { StageplanModal } from './stageplan-modal';

interface Props {
  band: Band;
  onSave: (updates: Partial<Band>) => void;
  onCancel: () => void;
}

export function EditBandForm({ band, onSave, onCancel }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { manageBandTab, currentUser, activeRoleView, setActiveRoleView } = useAppStore();

  const activeTab = manageBandTab;
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  // Band form state
  const [name, setName] = useState(band.name);
  const [genre, setGenre] = useState(band.genre || '');
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
      Alert.alert('Chyba', 'Název kapely je povinný.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name,
        genre,
        web,
        facebook,
        instagram,
        bandzone,
        logoUri: logoUri || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (activeRoleView === 'fan') {
    return (
      <View style={styles.container}>
        <PageHeader title="O kapele" />

        <ScrollView contentContainerStyle={styles.content}>
          {/* Logo kapely */}
          {band.logoUri ? (
            <Image source={{ uri: band.logoUri }} style={styles.fanLogo} contentFit="contain" />
          ) : null}

          {/* Název a žánr */}
          <View style={{ alignItems: 'center', marginVertical: Spacing.two }}>
            <ThemedText type="title" style={{ fontSize: 26, textAlign: 'center' }}>
              {band.name}
            </ThemedText>
            {band.genre ? (
              <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: 4 }}>
                {band.genre}
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
            Členové kapely
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
                        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>Host</ThemedText>
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
                Zatím nebyly načteny informace o členech.
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
        activeTab === 'band' ? 'Upravit profil kapely' :
        activeTab === 'members' ? 'Správa členů kapely' :
        activeTab === 'tech' ? 'Technický rider kapely' : 'Nastavení aplikace'
      } />

      <ScrollView contentContainerStyle={styles.content} scrollEnabled={isScrollEnabled}>
        {activeTab === 'settings' ? (
          <View style={{ gap: Spacing.four }}>
            <ThemedText type="subtitle">Nastavení kapely & Aplikace</ThemedText>

            {/* 1. Nastavit technický rider */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                🎛️ Nastavit technický rider
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                Předvolby techniky a aparatury pro rychlé použití ve formulářích:
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
                  placeholder="Přidat položku techniky (např. D.I. box)"
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
                emptyText="Zatím nemáte přidané žádné položky technického rideru."
              />
            </ThemedView>

            {/* 2. Nastavit co vzít s sebou */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                🧳 Nastavit co vzít s sebou
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 10 }}>
                Seznam věcí a vybavení pro balení na akce a koncerty:
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
                  placeholder="Přidat věc ke zabalení (např. Stojany mikrofonní)"
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
                emptyText="Zatím nemáte přidané žádné položky ke zabalení."
              />
            </ThemedView>

            {/* Testování pohledu role */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                🎭 Přepnout pohled podle role
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 12 }}>
                Vyberte roli pro simulaci uživatelského rozhraní v aplikaci:
              </ThemedText>

              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                {[
                  { key: 'admin', label: 'Kapelník (Admin)', color: '#ff9800' },
                  { key: 'member', label: 'Člen kapely', color: '#4caf50' },
                  { key: 'fan', label: 'Fanoušek', color: '#2196f3' },
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
                🔑 Účet a automatické přihlášení
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Na tomto zařízení jste přihlášeni jako: <ThemedText type="smallBold">{currentUser?.displayName || 'Kapelník'}</ThemedText>
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                Aplikace si pamatuje ověřená zařízení pro okamžité přihlášení bez nutnosti opakovacího hesla.
              </ThemedText>
            </ThemedView>

            {/* Informace o systému */}
            <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
              <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                📱 Systémové informace
              </ThemedText>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">Aplikace:</ThemedText>
                <ThemedText type="small">Band Management App</ThemedText>
              </View>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">Verze:</ThemedText>
                <ThemedText type="small">1.0.0 (Expo & Firebase)</ThemedText>
              </View>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">Databáze Firestore:</ThemedText>
                <ThemedText type="small">kapela / {band.id}</ThemedText>
              </View>
              <View style={styles.techRow}>
                <ThemedText type="smallBold">Stav spojení:</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#4caf50' }}>Připojeno online</ThemedText>
              </View>
            </ThemedView>
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
                <ThemedText type="default" style={{ color: '#fff', fontWeight: 'bold' }}>Stageplan</ThemedText>
              </Pressable>

              {/* Souhrnná karta techniky na pódiu */}
              <ThemedView type="backgroundElement" style={styles.techSummaryCard}>
                <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                  📊 Požadavek na pódiu ({attendingMembers.length} z {members.length} členů)
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
                    Nemáte zatím nastavené žádné položky technického rideru.{'\n'}Přidat je můžete v Kapela → Nastavení → Nastavit technický rider.
                  </ThemedText>
                )}
              </ThemedView>

              {/* Rozpis podle jednotlivých členů s přepínačem účasti */}
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>Účast členů na akci</ThemedText>
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
                          {isPresent ? 'Na akci' : 'Neúčastní se'}
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
          <>
            {/* Změna loga kapely */}
            <ThemedText type="smallBold">Logo kapely</ThemedText>

            {logoUri && (
               <Image source={{ uri: logoUri }} style={styles.logoPreview} contentFit="contain" />
            )}

            <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four, marginTop: -20}}>
              <Pressable style={[styles.photoBtn, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]} onPress={pickImageFromGallery}>
                <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={14} tintColor={theme.text} />
                <ThemedText type="smallBold" style={{fontSize: 12}}>Z galerie</ThemedText>
              </Pressable>
              <Pressable style={[styles.photoBtn, { backgroundColor: 'rgba(200,200,200,0.15)', borderColor: 'rgba(200,200,200,0.25)' }]} onPress={pickImageFromFolder}>
                <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={14} tintColor={theme.text} />
                <ThemedText type="smallBold" style={{fontSize: 12}}>Ze složky</ThemedText>
              </Pressable>
            </View>

            <View style={{marginTop: -20}}>
              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16}}>Název kapely *</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={name} onChangeText={setName} placeholderTextColor={theme.textSecondary} />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16}}>Hudební žánr</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={genre} onChangeText={setGenre} placeholderTextColor={theme.textSecondary} />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16}}>Web kapely (URL)</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={web} onChangeText={setWeb} placeholder="www.mojekapela.cz" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16, marginTop: 8}}>Facebook kapely (URL)</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={facebook} onChangeText={setFacebook} placeholder="facebook.com/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16, marginTop: 8}}>Instagram kapely (URL)</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={instagram} onChangeText={setInstagram} placeholder="instagram.com/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16, marginTop: 8}}>Bandzone kapely (URL)</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]} value={bandzone} onChangeText={setBandzone} placeholder="bandzone.cz/mojekapela" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />
            </View>

            <View style={styles.buttons}>
              <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel} disabled={isSaving}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
              </Pressable>
              <Pressable style={[styles.button, { backgroundColor: '#4caf50', opacity: isSaving ? 0.7 : 1 }]} onPress={handleSave} disabled={isSaving}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  {isSaving ? 'Ukládám...' : 'Uložit změny'}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.membersHeader}>
               <ThemedText type="subtitle">Správa členů kapely</ThemedText>
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
                            <ThemedText type="smallBold" style={{color: '#fff', fontSize: 10}}>Host</ThemedText>
                          </View>
                        ) : (
                          <View style={[styles.badge, { backgroundColor: theme.textSecondary }]}>
                            <ThemedText type="smallBold" style={{color: theme.background, fontSize: 10}}>Člen</ThemedText>
                          </View>
                        )}
                        {member.isActive === false && (
                          <View style={[styles.badge, { backgroundColor: '#e91e63' }]}>
                            <ThemedText type="smallBold" style={{color: '#fff', fontSize: 10}}>Neaktivní</ThemedText>
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
         <ThemedView style={{flex: 1}}>
            <AddMemberForm initialMember={editingMember || undefined} onSave={handleSaveMember} onCancel={() => setShowAddMemberModal(false)} />
         </ThemedView>
      </Modal>

      {/* Modál pro Stageplan */}
      <StageplanModal
        visible={showStageplan}
        onClose={() => setShowStageplan(false)}
        band={band}
        members={members}
        onSave={(stageplanData) => onSave({ stageplan: stageplanData })}
      />
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
  }
});