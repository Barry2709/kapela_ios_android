import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

LogBox.ignoreLogs([
  'BloomFilter error',
  '@firebase/firestore',
  'BloomFilter',
]);
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/useAppStore';
import { liveSyncService } from '@/services/liveSyncService';
import { GlobalLiveLyricsModal } from '@/components/global-live-lyrics-modal';
import { AttendanceQueueModal } from '@/components/attendance-queue-modal';
import { registerForPushNotificationsAsync } from '@/services/notificationService';
import { getBandMembers, updateBandMember } from '@/services/firebaseService';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { currentUser, setCurrentUser, activeBand, setActiveBand, setActiveRoleView } = useAppStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Automatické spuštění Live Sync pro aktivní kapelu na pozadí
  useEffect(() => {
    if (activeBand?.id) {
      const unsubscribe = liveSyncService.startListening(activeBand.id);
      return () => {
        unsubscribe();
      };
    } else {
      liveSyncService.stopListening();
    }
  }, [activeBand?.id]);

  // Registrace Push Notifikací a uložení tokenu k členovi kapely
  useEffect(() => {
    if (!activeBand?.id || !currentUser) return;

    const setupPushNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        const members = await getBandMembers(activeBand.id);
        const member = members.find(m =>
          (currentUser.memberId && m.id === currentUser.memberId) ||
          (currentUser.id && m.id === currentUser.id) ||
          ((m as any).uid && currentUser.id && (m as any).uid === currentUser.id) ||
          (m.email && currentUser.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          (m.nickname && currentUser.displayName && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase()) ||
          (m.firstName && currentUser.displayName && m.firstName.toLowerCase() === currentUser.displayName.toLowerCase())
        );

        if (member) {
          const updates: Partial<any> = {};
          if (member.pushToken !== token) updates.pushToken = token;
          if (currentUser.role === 'admin' && !member.isAdmin) updates.isAdmin = true;

          if (Object.keys(updates).length > 0) {
            await updateBandMember(activeBand.id, member.id, updates);
          }
        }
      } catch (err) {
        console.log("Chyba při registraci push notifikací v _layout:", err);
      }
    };

    setupPushNotifications();
  }, [activeBand?.id, currentUser?.id, currentUser?.email]);

  // Hydratace uloženého sezení
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedUserStr = await AsyncStorage.getItem('savedUser');
        const savedBandStr = await AsyncStorage.getItem('savedBand');

        if (savedUserStr) {
          const user = JSON.parse(savedUserStr);
          setCurrentUser(user);
          setActiveRoleView(user.role);
          if (savedBandStr) {
            setActiveBand(JSON.parse(savedBandStr));
          }
        }
      } catch (e) {
        console.error("Chyba při načítání sezení:", e);
      } finally {
        setIsReady(true);
        SplashScreen.hideAsync();
      }
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    setTimeout(() => {
      if (!currentUser && !inAuthGroup) {
        router.replace('/(auth)/onboarding');
      } else if (currentUser && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }, 100);
  }, [currentUser, segments, isReady]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalLiveLyricsModal />
      <AttendanceQueueModal />
    </>
  );
}
