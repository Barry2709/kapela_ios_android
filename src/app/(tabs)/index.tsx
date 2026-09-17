import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { BandMember, Band } from '@/types';
import { getBandMembers, addBandMember, updateBand, updateBandMember, getBandById } from '@/services/firebaseService';
import { BandHeader } from '@/components/band-header';
import { AddMemberForm } from '@/components/add-member-form';
import { EditBandForm } from '@/components/edit-band-form';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activeBand, currentUser, setCurrentUser, setActiveBand } = useAppStore();

  const [members, setMembers] = useState<BandMember[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditBandModal, setShowEditBandModal] = useState(false);
  const [editingMember, setEditingMember] = useState<BandMember | null>(null);

  // Načíst členy kapely a aktualizovat čerstvá data kapely z Firebase
  useEffect(() => {
    if (activeBand?.id) {
      loadMembers();
      getBandById(activeBand.id).then(freshBand => {
        if (freshBand) {
          setActiveBand(freshBand);
          AsyncStorage.setItem('savedBand', JSON.stringify(freshBand));
        }
      });
    }
  }, [activeBand?.id]);

  const loadMembers = async () => {
    if (!activeBand) return;
    try {
      const data = await getBandMembers(activeBand.id);
      setMembers(data);
    } catch (e) {
      console.error("Nepodařilo se načíst členy", e);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Odhlášení',
      'Opravdu se chcete odhlásit a vrátit na výběr rolí?',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Odhlásit se',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('savedUser');
            await AsyncStorage.removeItem('savedBand');

            setCurrentUser(null);
            setActiveBand(null);
            router.replace('/(auth)/onboarding');
          }
        }
      ]
    );
  };

  const handleSaveMember = async (memberData: Omit<BandMember, 'id'>) => {
    if (!activeBand) return;
    try {
      if (editingMember) {
        await updateBandMember(activeBand.id, editingMember.id, memberData);
      } else {
        await addBandMember(activeBand.id, memberData);
      }
      setShowAddMemberModal(false);
      setEditingMember(null);
      loadMembers(); // Znovunačíst seznam
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

  const handleSaveBandUpdates = async (updates: Partial<Band>) => {
    if (!activeBand) return;
    try {
      const updatedBand = await updateBand(activeBand.id, updates);

      // Pokud se změnou názvu změnilo i ID kapely, musíme aktualizovat sezení uživatele
      if (updatedBand.id !== activeBand.id && currentUser) {
         const updatedUser = { ...currentUser, bandId: updatedBand.id };
         setCurrentUser(updatedUser);
         await AsyncStorage.setItem('savedUser', JSON.stringify(updatedUser));
      }

      setActiveBand(updatedBand);
      await AsyncStorage.setItem('savedBand', JSON.stringify(updatedBand));

      setShowEditBandModal(false);
      Alert.alert("Úspěch", "Změny byly úspěšně uloženy.");
    } catch (e: any) {
      Alert.alert("Nelze upravit profil", e.message || "Nastala chyba při úpravě profilu kapely.");
      console.error("Nepodařilo se upravit profil kapely", e);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <BandHeader />

          <View style={[styles.contentPadding, { marginTop: 3 }]}>
            {/* Rychlý řádek s informací o přihlášení a viditelné tlačítko odhlášení */}
            <View style={styles.loggedInRow}>
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, marginRight: 8 }} numberOfLines={1}>
                Přihlášen: <ThemedText type="smallBold">{currentUser?.displayName}</ThemedText>
              </ThemedText>
              <Pressable onPress={handleLogout} style={styles.logoutBtnInline}>
                <ThemedText type="smallBold" style={{ color: theme.text }}>
                  Odhlásit se
                </ThemedText>
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* Modal pro přidání/úpravu člena (pouze pro kapelníka) */}
      <Modal visible={showAddMemberModal} animationType="slide" presentationStyle="pageSheet">
         <ThemedView style={{flex: 1}}>
            <AddMemberForm initialMember={editingMember || undefined} onSave={handleSaveMember} onCancel={() => setShowAddMemberModal(false)} />
         </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six },
  contentPadding: { paddingHorizontal: Spacing.four },
  loggedInRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.five, marginTop: 3 },
  logoutBtnInline: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(150,150,150,0.2)' },
  adminInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, backgroundColor: 'rgba(150,150,150,0.2)' },

  membersSection: { marginBottom: Spacing.six },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  addButton: { padding: Spacing.two, borderRadius: Spacing.six },
  membersList: { gap: Spacing.three },
  memberCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  memberPhoto: { width: 50, height: 50, borderRadius: 25, marginRight: Spacing.three },
  memberInfo: { flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginRight: Spacing.two },
  editMemberBtn: { padding: Spacing.two, marginLeft: Spacing.two },

  logoutContainer: { alignItems: 'center', marginTop: Spacing.four },
  logoutButton: { padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.six }
});
