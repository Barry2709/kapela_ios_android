import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Modal } from 'react-native';
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

interface Props {
  band: Band;
  onSave: (updates: Partial<Band>) => void;
  onCancel: () => void;
}

export function EditBandForm({ band, onSave, onCancel }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { manageBandTab } = useAppStore();

  const activeTab = manageBandTab;

  // Band form state
  const [name, setName] = useState(band.name);
  const [genre, setGenre] = useState(band.genre || '');
  const [web, setWeb] = useState(band.web || '');
  const [logoUri, setLogoUri] = useState<string | null>(band.logoUri || null);
  const [isSaving, setIsSaving] = useState(false);

  // Members state
  const [members, setMembers] = useState<BandMember[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<BandMember | null>(null);

  useEffect(() => {
    if (activeTab === 'members') {
      loadMembers();
    }
  }, [activeTab]);

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
    await onSave({
      name,
      genre,
      web,
      logoUri: logoUri || undefined,
    });
  };

  return (
    <View style={styles.container}>
      <PageHeader title={activeTab === 'band' ? 'Upravit profil kapely' : 'Správa členů kapely'} />

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'band' ? (
          <>
            {/* Změna loga kapely */}
            <ThemedText type="smallBold">Logo kapely</ThemedText>

            {logoUri && (
               <Image source={{ uri: logoUri }} style={styles.logoPreview} contentFit="contain" />
            )}

            <View style={{flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four, marginTop: -20}}>
              <Pressable style={[styles.photoBtn, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromGallery}>
                <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={14} tintColor={theme.text} />
                <ThemedText type="smallBold" style={{fontSize: 12}}>Z galerie</ThemedText>
              </Pressable>
              <Pressable style={[styles.photoBtn, { backgroundColor: theme.backgroundElement }]} onPress={pickImageFromFolder}>
                <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={14} tintColor={theme.text} />
                <ThemedText type="smallBold" style={{fontSize: 12}}>Ze složky</ThemedText>
              </Pressable>
            </View>

            <View style={{marginTop: -20}}>
              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16}}>Název kapely *</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={name} onChangeText={setName} placeholderTextColor={theme.textSecondary} />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16}}>Hudební žánr</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={genre} onChangeText={setGenre} placeholderTextColor={theme.textSecondary} />

              <ThemedText type="default" style={{fontWeight: 'bold', fontSize: 16}}>Web kapely (URL)</ThemedText>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]} value={web} onChangeText={setWeb} placeholder="www.mojekapela.cz" placeholderTextColor={theme.textSecondary} keyboardType="url" autoCapitalize="none" />
            </View>

            <View style={styles.buttons}>
              <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={onCancel} disabled={isSaving}>
                <ThemedText type="default">Zrušit</ThemedText>
              </Pressable>
              <Pressable style={[styles.button, { backgroundColor: theme.text, opacity: isSaving ? 0.7 : 1 }]} onPress={handleSave} disabled={isSaving}>
                <ThemedText type="default" style={{ color: theme.background, fontWeight: 'bold' }}>
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
    padding: Spacing.two,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
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