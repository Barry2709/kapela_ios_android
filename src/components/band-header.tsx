import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
  const { activeBand } = useAppStore();
  const { t, currentLang } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const displayBand = overrideBand || activeBand;

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
    <View style={[styles.header, { paddingTop: insets.top + 3 }]}>
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
