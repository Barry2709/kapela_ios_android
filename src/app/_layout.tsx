import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/useAppStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { currentUser, setCurrentUser, setActiveBand, setActiveRoleView } = useAppStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

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
    <Stack screenOptions={{ headerShown: false }} />
  );
}
