import React from 'react';
import { StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedView } from '@/components/themed-view';
import { useAppStore } from '@/store/useAppStore';
import { updateBand } from '@/services/firebaseService';
import { EditBandForm } from '@/components/edit-band-form';
import { Band } from '@/types';

export default function ManageBandScreen() {
  const router = useRouter();
  const { activeBand, currentUser, setCurrentUser, setActiveBand } = useAppStore();

  const handleSaveBandUpdates = async (updates: Partial<Band>) => {
    if (!activeBand) return;
    try {
      const updatedBand = await updateBand(activeBand.id, updates);

      if (updatedBand.id !== activeBand.id && currentUser) {
         const updatedUser = { ...currentUser, bandId: updatedBand.id };
         setCurrentUser(updatedUser);
         await AsyncStorage.setItem('savedUser', JSON.stringify(updatedUser));
      }

      setActiveBand(updatedBand);
      await AsyncStorage.setItem('savedBand', JSON.stringify(updatedBand));
    } catch (e: any) {
      Alert.alert("Nelze upravit profil", e.message || "Nastala chyba při úpravě profilu kapely.");
      console.error("Nepodařilo se upravit profil kapely", e);
    }
  };

  const handleCancel = () => {
    router.replace('/(tabs)/');
  };

  if (!activeBand) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <EditBandForm
          band={activeBand}
          onSave={handleSaveBandUpdates}
          onCancel={handleCancel}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
});
