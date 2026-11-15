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

export function BandHeader({ overrideBand }: any = {}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { activeBand, setActiveBand, activeRoleView } = useAppStore();
  const { t, currentLang } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const displayBand = overrideBand || activeBand;

  // 1. Zaručeně fungující syrový odchytávač prstu (žádný PanResponder, který ScrollView ukradne)
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (evt: any) => {
    if (activeRoleView !== 'fan') return;
    touchStartX.current = evt.nativeEvent.pageX;
  };

  const handleTouchEnd = async (evt: any) => {
    if (activeRoleView !== 'fan' || touchStartX.current === null) return;

    const deltaX = evt.nativeEvent.pageX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) > 30) {
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

        // Fallback, pokud má fanoušek v telefonu jen 1 uloženou kapelu
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
        style={{ width: '100%', alignItems: 'center' }}
      >
        {activeRoleView === 'fan' ? (
          // Fanouškům zakážeme klikací obálku (Pressable), aby swipe na dotyk (onTouch) fungoval na 100%
          renderLogoContent()
        ) : (
          // Členové a kapelník mají obálku pro klik na web
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
