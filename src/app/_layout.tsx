import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { getBandMembers, updateBandMember, updateFanInBand, removeInvalidPushTokenFromBandMembers } from '@/services/firebaseService';
import { arrayUnion } from 'firebase/firestore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { currentUser, setCurrentUser, activeBand, setActiveBand, setActiveRoleView } = useAppStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Automatická kontrola a okamžitá instalace bezdrátových OTA aktualizací (EAS Update) při startu
  useEffect(() => {
    async function checkForOtaUpdates() {
      if (__DEV__) return;
      try {
        const Updates = require('expo-updates');
        if (Updates && typeof Updates.checkForUpdateAsync === 'function') {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch (e) {
        console.log("Kontrola OTA aktualizace:", e);
      }
    }
    checkForOtaUpdates();
  }, []);

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

        // Pokud je přihlášen fanoušek, OČISTIT jeho token ze všech členů kapely a uložit ho výhradně fanouškovi!
        if (currentUser.role === 'fan') {
          await removeInvalidPushTokenFromBandMembers(activeBand.id, token);
          if (currentUser.uid) {
            await updateFanInBand(activeBand.id, currentUser.uid, {
              pushToken: token,
              pushTokens: arrayUnion(token)
            } as any);
          }
          return;
        }

        const members = await getBandMembers(activeBand.id);
        const targetMember = members.find(m =>
          (currentUser.memberId && m.id === currentUser.memberId) ||
          (currentUser.uid && m.id === currentUser.uid) ||
          ((m as any).uid && currentUser.uid && (m as any).uid === currentUser.uid) ||
          (m.email && currentUser.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          (m.nickname && currentUser.displayName && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase()) ||
          (m.firstName && currentUser.displayName && m.firstName.toLowerCase() === currentUser.displayName.toLowerCase()) ||
          (m.nickname && currentUser.email && m.nickname.toLowerCase() === currentUser.email.split('@')[0].toLowerCase())
        );

        if (targetMember) {
          const updates: Partial<any> = {
            pushToken: token,
            pushTokens: arrayUnion(token),
          };
          if (currentUser.role === 'admin' && !targetMember.isAdmin) updates.isAdmin = true;

          await updateBandMember(activeBand.id, targetMember.id, updates);
        }
      } catch (err) {
        console.log("Chyba při registraci push notifikací v _layout:", err);
      }
    };

    setupPushNotifications();
  }, [activeBand?.id, currentUser?.uid, currentUser?.email]);

  // Hydratace uloženého sezení a podpora více kapel
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionsStr = await AsyncStorage.getItem('savedSessions');
        let sessions = sessionsStr ? JSON.parse(sessionsStr) : null;

        const legacyUserStr = await AsyncStorage.getItem('savedUser');
        const legacyBandStr = await AsyncStorage.getItem('savedBand');

        // Migrace starého způsobu ukládání
        if (!sessions && legacyUserStr && legacyBandStr) {
           sessions = [{ user: JSON.parse(legacyUserStr), band: JSON.parse(legacyBandStr) }];
           await AsyncStorage.setItem('savedSessions', JSON.stringify(sessions));
        }

        if (sessions && sessions.length > 0) {
          const lastActiveId = await AsyncStorage.getItem('lastActiveBandId');
          let activeSession = sessions.find((s: any) => s.band.id === lastActiveId) || sessions[0];

          setCurrentUser(activeSession.user);
          setActiveRoleView(activeSession.user.role);
          setActiveBand(activeSession.band);
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
