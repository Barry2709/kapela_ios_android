const fs = require('fs');

let file = 'src/components/band-header.tsx';
let c = fs.readFileSync(file, 'utf8');

const newComponentCode = `import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

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
  const { activeBand, setActiveBand, activeRoleView } = useAppStore();
  const { t, currentLang } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const displayBand = overrideBand || activeBand;

  // Nativní gesto pro swipe (Funguje 100% i přes Pressable)
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20]) // Aktivuje se až po posunutí o 20px vlevo/vpravo
    .onEnd(async (e) => {
      // Přepínání povoleno jen fanouškům
      if (activeRoleView !== 'fan') return;

      const deltaX = e.translationX;
      if (Math.abs(deltaX) > 20) {
        try {
          let availableBandsMap = new Map<string, any>();

          // Načtení z uložených sessions
          const sessionsStr = await AsyncStorage.getItem('savedSessions');
          if (sessionsStr) {
            const sessions = JSON.parse(sessionsStr);
            sessions.forEach((s: any) => {
              if (s.band && s.band.id) availableBandsMap.set(s.band.id, s.band);
            });
          }

          // Fallback, pokud má jen 1 nebo 0 kapel (načte všechny)
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
            // Swipe doleva -> Další
            nextIndex = (currentIndex + 1) % availableBands.length;
          } else {
            // Swipe doprava -> Předchozí
            nextIndex = (currentIndex - 1 + availableBands.length) % availableBands.length;
          }

          const nextBand = availableBands[nextIndex];
          if (nextBand && nextBand.id) {
            setActiveBand(nextBand);
            await AsyncStorage.setItem('lastActiveBandId', nextBand.id);
          }
        } catch (err) {
          console.error("Chyba při gestu přepínání:", err);
        }
      }
    });

  const handleLogoPress = () => {
    // Proklik na web funguje jen pro kapelníky/členy (fanouškům to vypneme, aby nerušilo swipe)
    if (activeRoleView === 'fan') return;

    if (displayBand?.web) {
      let url = displayBand.web;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      Linking.openURL(url).catch(err => console.error("Nelze otevřít URL:", err));
    }
  };

  return (
    <GestureHandlerRootView style={[styles.header, { paddingTop: insets.top + 3 }]}>
      <GestureDetector gesture={panGesture}>
        <View style={{ width: '100%', alignItems: 'center' }}>
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
      </GestureDetector>
    </GestureHandlerRootView>
  );
}`;

c = c.replace(/import React, \{ useState \} from 'react';[\s\S]*?\} \? \([\s\S]*?\}\n    <\/View>\n  \);\n\}/, newComponentCode);

fs.writeFileSync(file, newComponentCode + `

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
`);
console.log('Fixed fan swipe logic');
