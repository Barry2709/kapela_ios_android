import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  role: string;
}

export function HelpModal({ visible, onClose, role }: HelpModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SymbolView name={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }} size={24} tintColor={theme.text} />
              <ThemedText type="subtitle" style={{ marginLeft: 8 }}>
                Nápověda k aplikaci
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={24} tintColor={theme.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>

            {/* SEKCE PRO FANOUŠKY - Vidí všichni */}
            <View style={[styles.section, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
              <ThemedText type="subtitle" style={{ color: '#2196f3', marginBottom: 12 }}>🙋‍♂️ Režim: Fanoušek</ThemedText>

              <ThemedText type="smallBold" style={styles.h3}>🏠 Domů (Agregovaný přehled)</ThemedText>
              <ThemedText style={styles.p}>• <ThemedText type="smallBold">Všechny akce na jednom místě:</ThemedText> Sloučený přehled všech nadcházejících koncertů a veřejných akcí od všech kapel, které v aplikaci sledujete.</ThemedText>
              <ThemedText style={styles.p}>• <ThemedText type="smallBold">Přepínání kapel gestem:</ThemedText> Přejetím prstem (Swipe) vlevo/vpravo po horním logu bleskově přepnete aktivní kapelu.</ThemedText>
              <ThemedText style={styles.p}>• <ThemedText type="smallBold">Správa kapel:</ThemedText> Kapely lze přidávat nebo odebírat tlačítkem „Přidat / spravovat kapely“ v horní části.</ThemedText>

              <ThemedText type="smallBold" style={styles.h3}>🖼️ Fotogalerie</ThemedText>
              <ThemedText style={styles.p}>• Na jednom místě naleznete seřazená fotoalba ze všech koncertů vašich oblíbených kapel.</ThemedText>
              <ThemedText style={styles.p}>• <ThemedText type="smallBold">Prohlížení:</ThemedText> Fotky můžete přibližovat 2 prsty (Pinch-to-Zoom), posouvat 1 prstem a natáčet na šířku.</ThemedText>
              <ThemedText style={styles.p}>• <ThemedText type="smallBold">Nahrávání fotek:</ThemedText> Přes tlačítko „Fotky“ můžete kapele nahrát vlastní pořízené fotografie do alba z telefonu.</ThemedText>
              <ThemedText style={styles.p}>• <ThemedText type="smallBold">Mazání:</ThemedText> Můžete smazat pouze ta alba a fotky, které jste do aplikace nahráli vy sami.</ThemedText>

              <ThemedText type="smallBold" style={styles.h3}>✉️ Poptávky (Booking)</ThemedText>
              <ThemedText style={styles.p}>• Slouží k odeslání přímé žádosti kapelníkovi, aby kapela zahrála na vaší akci (např. svatba, oslava).</ThemedText>

              <ThemedText type="smallBold" style={styles.h3}>🎸 Kapela (Informace)</ThemedText>
              <ThemedText style={styles.p}>• Základní informace o aktivní kapele, její odkazy na weby a sítě a seznam členů kapely.</ThemedText>
            </View>

            {/* SEKCE PRO ČLENY A ADMINY - Vidí jen člen a admin */}
            {role !== 'fan' && (
              <View style={[styles.section, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                <ThemedText type="subtitle" style={{ color: '#4caf50', marginBottom: 12 }}>🎸 Režim: Člen kapely</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>🏠 Domů (Interní přehled)</ThemedText>
                <ThemedText style={styles.p}>• Zobrazuje nejbližší naplánovanou zkoušku a nadcházející koncerty vybrané kapely.</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Docházka:</ThemedText> U každé akce je vyžadováno vaše vyjádření. Klepnutím potvrďte účast (Ano/Ne/Nevím) včetně volitelné poznámky.</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>📅 Akce a Absence</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Osobní Absence:</ThemedText> Pokud jedete na dovolenou nebo do práce, zadejte si přes „+ Absence“ termín. Kapelník tak při plánování koncertu rovnou uvidí, že nemůžete hrát.</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>🎵 Zpěvník</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Texty a akordy:</ThemedText> Kompletní seznam skladeb s texty. U písně si můžete zamknout zhasínání displeje, zapnout metronom nebo invertovat barvy pro hraní ve tmě.</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Setlisty:</ThemedText> Sestavení playlistu na daný koncert. Pořadí měníte přetažením za pravý okraj řádku.</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Audio zápisník:</ThemedText> Rychlý interní diktafon pro nahrání hudebního nápadu nebo riffu rovnou na zkoušce.</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>💰 Pokladna a Kapela</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Kniha jízd:</ThemedText> Evidence výdajů za cestu. Vyberte kapelní auto, zadejte kilometry a systém automaticky rozpočítá náklady podle spotřeby.</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Technika (Stageplan):</ThemedText> Interaktivní mapa rozestavení na pódiu a Input list pro zvukaře, s exportem do PDF v menu Kapela.</ThemedText>
              </View>
            )}

            {/* SEKCE PRO ADMINY - Vidí jen admin */}
            {role === 'admin' && (
              <View style={[styles.section, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
                <ThemedText type="subtitle" style={{ color: '#ff9800', marginBottom: 12 }}>👑 Režim: Kapelník (Admin)</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>Správa Akcí a Kalendáře</ThemedText>
                <ThemedText style={styles.p}>• Jste jediný, kdo může <ThemedText type="smallBold">přidávat, upravovat a mazat</ThemedText> koncerty a zkoušky. Změna automaticky rozešle Notifikace do mobilu všech členů kapely.</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Propojení s Google / Apple kalendářem:</ThemedText> V nastavení si můžete zvolit sdílený kalendář ve vašem telefonu. Akce z aplikace se budou na 1 klik zapisovat přímo k vám a vaší rodině.</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>Administrace Fanklubu</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Správa fanoušků:</ThemedText> V záložce Kapela můžete prohlížet seznam věrných fanoušků, kteří se do aplikace zaregistrovali a odebírat je.</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Poptávky:</ThemedText> Nabídky hraní zaslané fanoušky můžete schválit (přemění se automaticky na nový Koncert v aplikaci) nebo zamítnout.</ThemedText>

                <ThemedText type="smallBold" style={styles.h3}>Testování Pohledů</ThemedText>
                <ThemedText style={styles.p}>• <ThemedText type="smallBold">Změna role:</ThemedText> V nastavení kapely máte tlačítko „Změnit roli pro testování“. Kliknutím si aplikaci okamžitě přepnete do pohledu Fanouška a můžete si ověřit, jak veřejnost aktuálně vidí vaše fotky, koncerty a profil.</ThemedText>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    padding: 16,
    borderRadius: 16,
  },
  h3: {
    fontSize: 15,
    marginTop: 8,
    marginBottom: 4,
  },
  p: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    opacity: 0.9,
  }
});
