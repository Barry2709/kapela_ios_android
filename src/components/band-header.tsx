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
  const { activeBand, setActiveBand, setCurrentUser, setActiveRoleView } = useAppStore();
  const { t, currentLang } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const displayBand = overrideBand || activeBand;

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (evt: any) => {
    touchStartX.current = evt.nativeEvent.pageX;
  };

  const handleTouchEnd = async (evt: any) => {
    if (touchStartX.current === null) return;
    const deltaX = evt.nativeEvent.pageX - touchStartX.current;
    touchStartX.current = null;

    // Pokud byl swipe alespoň 40px dlouhý
    if (Math.abs(deltaX) > 40) {
      try {
        const sessionsStr = await AsyncStorage.getItem('savedSessions');
        if (!sessionsStr) return;
        const sessions = JSON.parse(sessionsStr);
        if (sessions.length <= 1) return;

        let currentIndex = sessions.findIndex((s: any) => s.band?.id === activeBand?.id);
        if (currentIndex === -1) currentIndex = 0;

        let nextIndex = 0;
        if (deltaX < 0) {
          // Swipe vlevo -> Další kapela
          nextIndex = (currentIndex + 1) % sessions.length;
        } else {
          // Swipe vpravo -> Předchozí kapela
          nextIndex = (currentIndex - 1 + sessions.length) % sessions.length;
        }

        const nextSession = sessions[nextIndex];
        if (nextSession && nextSession.band) {
          setActiveBand(nextSession.band);
          if (nextSession.user) {
            setCurrentUser(nextSession.user);
            setActiveRoleView(nextSession.user.role || 'fan');
          }
          await AsyncStorage.setItem('lastActiveBandId', nextSession.band.id);
        }
      } catch (e) {
        console.error("Chyba při přepínání kapely gestem na logu:", e);
      }
    }
  };

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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
