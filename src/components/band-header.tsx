import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/utils/i18n';
import { getCountryDisplayName } from '@/constants/countries';
import { getBands } from '@/services/firebaseService';

interface BandHeaderProps {
  overrideBand?: {
    name?: string;
    logoUri?: string | null;
    web?: string;
    genre?: string;
    country?: string;
  } | null;
}

export function BandHeader({ overrideBand }: BandHeaderProps = {}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { activeBand, setActiveBand, setCurrentUser, setActiveRoleView, activeRoleView } = useAppStore();
  const { t, currentLang } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const displayBand = overrideBand || activeBand;

  // PanResponder pro spolehlivé odchycení swipování přes logo kapely bez blokování Pressable
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Přepínání kapely gestem na logu je povolené VÝHRADNĚ pro pohled Fanouška
        if (activeRoleView !== 'fan') return false;
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: async (_, gestureState) => {
        const deltaX = gestureState.dx;
        if (Math.abs(deltaX) > 20) {
          try {
            let availableBandsMap = new Map<string, any>();

            // 1. Uložená sezení fanouška
            const sessionsStr = await AsyncStorage.getItem('savedSessions');
            if (sessionsStr) {
              const sessions = JSON.parse(sessionsStr);
              sessions.forEach((s: any) => {
                if (s.band && s.band.id) availableBandsMap.set(s.band.id, s.band);
              });
            }

            // 2. Pokud je méně než 2 kapely, načteme všechny z Firebase
            if (availableBandsMap.size <= 1) {
              const allFb = await getBands();
              allFb.forEach(b => availableBandsMap.set(b.id, b));
            }

            const availableBands = Array.from(availableBandsMap.values());
            if (availableBands.length <= 1) return;

            let currentIndex = availableBands.findIndex((b: any) => b.id === activeBand?.id);
            if (currentIndex === -1) currentIndex = 0;

            let nextIndex = 0;
            if (deltaX < 0) {
              // Swipe vlevo -> Další kapela
              nextIndex = (currentIndex + 1) % availableBands.length;
            } else {
              // Swipe vpravo -> Předchozí kapela
              nextIndex = (currentIndex - 1 + availableBands.length) % availableBands.length;
            }

            const nextBand = availableBands[nextIndex];
            if (nextBand && nextBand.id) {
              setActiveBand(nextBand);
              await AsyncStorage.setItem('lastActiveBandId', nextBand.id);
              console.log("Přepnuto na aktivní kapelu fanouška:", nextBand.name);
            }
          } catch (e) {
            console.error("Chyba při přepínání kapely gestem v hlavičce:", e);
          }
        }
      },
    })
  ).current;

  const handleLogoPress = () => {
    if (displayBand?.web) {
      let url = displayBand.web;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      Linking.openURL(url).catch(err => console.error("Nelze otevřít URL:", err));
    }
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.header, { paddingTop: insets.top + 3 }]}
    >
      {displayBand?.logoUri ? (
         <Pressable onPress={handleLogoPress} style={{ width: '100%', alignItems: 'center' }}>
           <Image
             source={{ uri: displayBand.logoUri }}
             style={[
               styles.logo,
               aspectRatio ? { aspectRatio, height: undefined, width: '100%' } : { height: 120, width: '100%' }
             ]}
             contentFit="cover"
             onLoad={(e) => {
               const { width, height } = e.source;
               if (width && height) {
                 setAspectRatio(width / height);
               }
             }}
           />
         </Pressable>
      ) : (
        <Pressable
          style={[styles.logo, { backgroundColor: theme.backgroundElement, justifyContent: 'center', alignItems: 'center' }]}
          onPress={handleLogoPress}
        >
          <ThemedText type="title" style={styles.titlePlaceholder}>
            {displayBand?.name || t('common.loading')}
          </ThemedText>
          {displayBand?.genre || displayBand?.country ? (
            <ThemedText type="subtitle" themeColor="textSecondary" style={styles.genrePlaceholder}>
              {[displayBand.genre, getCountryDisplayName(displayBand.country, currentLang)].filter(Boolean).join(' • ')}
            </ThemedText>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 0,
  },
  logo: {
    width: '100%',
    height: 120,
    marginBottom: 0,
  },
  titlePlaceholder: {
    textAlign: 'center',
    fontSize: 21,
  },
  genrePlaceholder: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
});
