import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';

export function BandHeader() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { activeBand } = useAppStore();

  const handleLogoPress = () => {
    if (activeBand?.web) {
      let url = activeBand.web;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      Linking.openURL(url).catch(err => console.error("Nelze otevřít URL:", err));
    }
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 3 }]}>
      {activeBand?.logoUri ? (
         <Pressable onPress={handleLogoPress} style={{ width: '100%', alignItems: 'center' }}>
           <Image source={{ uri: activeBand.logoUri }} style={styles.logo} contentFit="cover" />
         </Pressable>
      ) : (
        <Pressable
          style={[styles.logo, { backgroundColor: theme.backgroundElement, justifyContent: 'center', alignItems: 'center' }]}
          onPress={handleLogoPress}
        >
          <ThemedText type="title" style={styles.titlePlaceholder}>
            {activeBand?.name || 'Načítání...'}
          </ThemedText>
          {activeBand?.genre ? (
            <ThemedText type="subtitle" themeColor="textSecondary" style={styles.genrePlaceholder}>
              {activeBand.genre}
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