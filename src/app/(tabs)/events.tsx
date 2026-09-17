import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function EventsScreen() {
  const { activeRoleView, eventsTab } = useAppStore();

  const titleMap = {
    koncerty: 'Koncerty',
    zkousky: 'Zkoušky kapely',
    poptavky: 'Poptávky hraní',
    rezervace: 'Rezervace termínů',
    absence: 'Absence členů',
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <PageHeader title={titleMap[eventsTab] || 'Akce'} />

        <View style={styles.content}>
          {eventsTab === 'koncerty' && (
            <View>
              <ThemedText type="default">Zde bude přehled plánovaných koncertů a vystoupení.</ThemedText>
            </View>
          )}

          {eventsTab === 'zkousky' && (
            <View>
              <ThemedText type="default">Zde bude harmonogram kapelních zkoušek.</ThemedText>
            </View>
          )}

          {eventsTab === 'poptavky' && (
            <View>
              <ThemedText type="default">Zde bude seznam poptávek na vystoupení od pořadatelů.</ThemedText>
            </View>
          )}

          {eventsTab === 'rezervace' && (
            <View>
              <ThemedText type="default">Zde bude správa rezervací a blokovaných termínů.</ThemedText>
            </View>
          )}

          {eventsTab === 'absence' && (
            <View>
              <ThemedText type="default">Zde bude hlášení absencí a nedostupnosti členů kapely.</ThemedText>
            </View>
          )}

          {activeRoleView === 'admin' && (
            <ThemedView type="backgroundElement" style={styles.adminBox}>
              <ThemedText type="smallBold">Akce administrátora:</ThemedText>
              <ThemedText type="small">+ Přidat novou položku pro: {titleMap[eventsTab]}</ThemedText>
            </ThemedView>
          )}

          {activeRoleView === 'fan' && eventsTab === 'koncerty' && (
             <ThemedText type="small" themeColor="textSecondary" style={{marginTop: 20}}>
               Zobrazuji pouze veřejně přístupné koncerty.
             </ThemedText>
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