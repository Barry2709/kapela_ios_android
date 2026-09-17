import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function TreasuryScreen() {
  const { activeRoleView, treasuryTab } = useAppStore();

  const titleMap = {
    prijem: 'Příjmy pokladny',
    vydej: 'Výdaje pokladny',
    doklady: 'Účetní doklady',
    kniha_jizd: 'Kniha jízd',
  };

  if (activeRoleView === 'fan') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <PageHeader title="Přístup odepřen" />
          <View style={styles.centered}>
             <ThemedText type="default" themeColor="textSecondary" style={{textAlign: 'center', marginTop: 10}}>
                Pokladna je dostupná pouze pro členy kapely.
             </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <PageHeader title={titleMap[treasuryTab] || 'Pokladna'} />

        <View style={styles.content}>
          <ThemedView type="backgroundElement" style={styles.balanceBox}>
             <ThemedText type="small">Aktuální stav pokladny:</ThemedText>
             <ThemedText type="title" style={{color: '#4caf50'}}>15 400 Kč</ThemedText>
          </ThemedView>

          {treasuryTab === 'prijem' && (
            <View style={{marginTop: 16}}>
              <ThemedText type="smallBold">Evidované příjmy:</ThemedText>
              <ThemedText type="default" style={{marginTop: 8}}>Zde bude přehled příjmů z koncertů, honorářů a sponzorských darů.</ThemedText>
            </View>
          )}

          {treasuryTab === 'vydej' && (
            <View style={{marginTop: 16}}>
              <ThemedText type="smallBold">Evidované výdaje:</ThemedText>
              <ThemedText type="default" style={{marginTop: 8}}>Zde bude přehled výdajů na zvukaře, techniku, zkušebnu a cestovné.</ThemedText>
            </View>
          )}

          {treasuryTab === 'doklady' && (
            <View style={{marginTop: 16}}>
              <ThemedText type="smallBold">Archiv dokladů a faktur:</ThemedText>
              <ThemedText type="default" style={{marginTop: 8}}>Zde budou uložené fotografie paragonů, faktur a příjmových dokladů.</ThemedText>
            </View>
          )}

          {treasuryTab === 'kniha_jizd' && (
            <View style={{marginTop: 16}}>
              <ThemedText type="smallBold">Kniha jízd a cestovní náhrady:</ThemedText>
              <ThemedText type="default" style={{marginTop: 8}}>Zde bude evidencia ujetých kilometrů na akce a výpočet cestovného.</ThemedText>
            </View>
          )}

          {activeRoleView === 'admin' && (
            <ThemedView type="backgroundElement" style={styles.adminBox}>
              <ThemedText type="smallBold">Akce administrátora:</ThemedText>
              <ThemedText type="small">+ Zadat nový záznam pro: {titleMap[treasuryTab]}</ThemedText>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  balanceBox: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  adminBox: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  }
});