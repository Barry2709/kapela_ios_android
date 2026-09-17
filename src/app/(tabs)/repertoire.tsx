import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function RepertoireScreen() {
  const { activeRoleView, repertoireTab } = useAppStore();

  const titleMap = {
    nase_pisne: 'Naše písně',
    zpevnik_plus: 'Zpěvník +',
    audio_zapisnik: 'Audio zápisník',
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <PageHeader title={titleMap[repertoireTab] || 'Zpěvník'} />

        <View style={styles.content}>
          {repertoireTab === 'nase_pisne' && (
            <View>
              <ThemedText type="default">Zde bude seznam písní s akordy, texty a tóninami.</ThemedText>
            </View>
          )}

          {repertoireTab === 'zpevnik_plus' && (
            <View>
              <ThemedText type="default">Zde bude editor pro vkládání a úpravu nových skladeb.</ThemedText>
            </View>
          )}

          {repertoireTab === 'audio_zapisnik' && (
            <View>
              <ThemedText type="default">Zde bude hlasový a zvukový zápisník pro nahrávání ze zkoušek.</ThemedText>
            </View>
          )}

          {activeRoleView === 'admin' && (
            <ThemedView type="backgroundElement" style={styles.adminBox}>
              <ThemedText type="smallBold">Akce administrátora:</ThemedText>
              <ThemedText type="small">+ Správa položky: {titleMap[repertoireTab]}</ThemedText>
            </ThemedView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  adminBox: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  }
});