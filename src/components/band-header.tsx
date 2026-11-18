import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
  const { activeBand, setActiveBand, activeRoleView } = useAppStore();
  const { t, currentLang } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const displayBand = overrideBand || activeBand;

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (evt: any) => {
    if (activeRoleView !== 'fan') return;
    const x = evt.nativeEvent.touches?.[0]?.pageX ?? evt.nativeEvent.pageX;
    touchStartX.current = x;
  };

  const handleTouchEnd = async (evt: any) => {
    if (activeRoleView !== 'fan' || touchStartX.current === null) return;

    const endX = evt.nativeEvent.changedTouches?.[0]?.pageX ?? evt.nativeEvent.pageX;
    if (typeof endX !== 'number' || isNaN(endX)) {
      touchStartX.current = null;
      return;
    }

    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    // Pokud byl swipe delší než 25px
    if (Math.abs(deltaX) > 25) {
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

        // U fanoušků striktně rotujeme POUZE kapely, do kterých se přihlásil / které sleduje.
        // Fallback na všechny kapely je odstraněn.

        const availableBands = Array.from(availableBandsMap.values());
        if (availableBands.length <= 1) return;

        let currentIndex = availableBands.findIndex((b: any) => b.id === activeBand?.id);
        if (currentIndex === -1) currentIndex = 0;

        let nextIndex = 0;
        if (deltaX < 0) {
          // Swipe doleva -> Další kapela v kruhu
          nextIndex = (currentIndex + 1) % availableBands.length;
        } else {
          // Swipe doprava -> Předchozí kapela v kruhu
          nextIndex = (currentIndex - 1 + availableBands.length) % availableBands.length;
        }

        const nextBand = availableBands[nextIndex];
        if (nextBand && nextBand.id) {
          setActiveBand(nextBand);
          await AsyncStorage.setItem('lastActiveBandId', nextBand.id);
          console.log("Přepnuto na kapelu v kruhu:", nextBand.name);
        }
      } catch (err) {
        console.error("Chyba při gestu přepínání:", err);
      }
    }
  };

  const handleLogoPress = () => {
    if (activeRoleView === 'fan') return;
    if (displayBand?.web) {
      let url = displayBand.web;
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
      Linking.openURL(url).catch(err => console.error("Nelze otevřít URL:", err));
    }
  };

  const renderLogoContent = () => {
    if (displayBand?.logoUri) {
      return (
        <Image
          source={{ uri: displayBand.logoUri }}
          style={[styles.logo, aspectRatio ? { aspectRatio, height: undefined, width: '100%' } : { height: 120, width: '100%' }]}
          contentFit="cover"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width && height) setAspectRatio(width / height);
          }}
        />
      );
    }
    return (
      <View style={[styles.logo, { backgroundColor: theme.backgroundElement, justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText type="title" style={styles.titlePlaceholder}>{displayBand?.name || t('common.loading')}</ThemedText>
        {displayBand?.genre || displayBand?.country ? (
          <ThemedText type="subtitle" themeColor="textSecondary" style={styles.genrePlaceholder}>
            {[displayBand.genre, getCountryDisplayName(displayBand.country, currentLang)].filter(Boolean).join(' • ')}
          </ThemedText>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 3 }]}>
      <View
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ width: '100%', alignItems: 'center' }}
      >
        {activeRoleView === 'fan' ? (
          // pointerEvents="none" zakáže nativnímu obrázku na Androidu pohlcovat dotyky a vynutí přenos na rodičovský View!
          <View pointerEvents="none" style={{ width: '100%', alignItems: 'center' }}>
            {renderLogoContent()}
          </View>
        ) : (
          <Pressable onPress={handleLogoPress} style={{ width: '100%', alignItems: 'center' }}>
            {renderLogoContent()}
          </Pressable>
        )}
      </View>
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
