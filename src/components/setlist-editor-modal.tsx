import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, ScrollView, FlatList, TextInput } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Song, Concert } from '@/types';
import { getSongs } from '@/services/firebaseService';

interface Props {
  visible: boolean;
  onClose: () => void;
  concert?: Concert;
  initialSetlist?: string[];
  onSaveSetlist: (setlistIds: string[]) => void;
}

export function SetlistEditorModal({ visible, onClose, concert, initialSetlist, onSaveSetlist }: Props) {
  const theme = useTheme();
  const { activeBand } = useAppStore();

  const [allSongs, setSongs] = useState<Song[]>([]);
  const [setlistIds, setSetlistIds] = useState<string[]>(initialSetlist || []);
  const [showAddSongPicker, setShowAddSongPicker] = useState(false);
  const [showGeneratorSettings, setShowGeneratorSettings] = useState(false);

  // Nastavení generátoru
  const [playTimeHours, setPlayTimeHours] = useState('2');
  const [setDurationMinutesStr, setSetDurationMinutesStr] = useState('45');

  useEffect(() => {
    if (visible && activeBand?.id) {
      getSongs(activeBand.id).then(fetchedSongs => {
        setSongs(fetchedSongs.filter(s => s.isLive !== false));
      }).catch(console.error);
      setSetlistIds(initialConcertSetlist());
    }
  }, [visible, activeBand?.id]);

  const initialConcertSetlist = () => {
    const raw = initialSetlist && initialSetlist.length > 0 ? initialSetlist : (concert?.setlist || []);
    const uniqueIds: string[] = [];
    raw.forEach(id => {
      if (id.startsWith('pauza_') || !uniqueIds.includes(id)) {
        uniqueIds.push(id);
      }
    });
    return uniqueIds;
  };

  const createPauseSong = (id: string): Song => ({
    id,
    bandId: '',
    title: '000.Pauza',
    artist: 'Přestávka (12 minut)',
    duration: '12:00',
    isLive: true,
  });

  // Pomocná funkce pro převod časového řetězce (3:30) na minuty
  const parseSongDuration = (durationStr?: string): number => {
    if (!durationStr) return 3.5;
    if (durationStr === '12:00') return 12;
    try {
      if (durationStr.includes(':')) {
        const parts = durationStr.split(':');
        const mins = parseFloat(parts[0]) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return mins + secs / 60;
      }
      const val = parseFloat(durationStr);
      return isNaN(val) ? 3.5 : val;
    } catch {
      return 3.5;
    }
  };

  // ALGORITMUS CHYTRÉHO GENERÁTORU
  const generateSmartSetlist = () => {
    if (allSongs.length === 0) {
      Alert.alert('Chyba', 'V repertoáru nemáte žádné aktivní skladby (Hrajeme = true).');
      return;
    }

    const totalHours = parseFloat(playTimeHours) || 2;
    const totalMinutesAvailable = totalHours * 60;
    const maxSetDuration = parseFloat(setDurationMinutesStr) || 45;
    const breakDuration = 12; // 12 minut pauza

    const selectedIds: string[] = [];
    const usedIds = new Set<string>();

    // Rozdělení skladeb do kategorií
    const firstCandidates = allSongs.filter(s => s.isFirst);
    const lastCandidates = allSongs.filter(s => s.isLast);
    const encoreCandidates = allSongs.filter(s => s.isEncore);
    const preferredCandidates = allSongs.filter(s => s.isPreferred && !s.isFirst && !s.isLast && !s.isEncore);
    const normalCandidates = allSongs.filter(s => !s.isFirst && !s.isLast && !s.isEncore && !s.isPreferred);

    let totalDuration = 0;
    let currentSetDuration = 0;
    let setIndex = 1;
    let lastSinger: string | undefined = undefined;
    let consecutiveSlow = 0;

    // Seznam skladeb pro plnění (nejprve preferované, potom ostatní)
    const priorityList = [...preferredCandidates, ...normalCandidates];

    // Pomocná funkce pro vložení pauzy 000.Pauza
    const insertBreakIfNeeded = () => {
      if (currentSetDuration >= maxSetDuration && totalDuration + breakDuration < totalMinutesAvailable - 5) {
        const pauseId = `pauza_${Date.now()}_${setIndex}`;
        selectedIds.push(pauseId);
        totalDuration += breakDuration;
        currentSetDuration = 0;
        setIndex++;
        return true;
      }
      return false;
    };

    // 1. OTVÍRÁK (První skladba)
    let opener = firstCandidates.find(s => !usedIds.has(s.id)) || preferredCandidates.find(s => !usedIds.has(s.id)) || allSongs.find(s => !usedIds.has(s.id));
    if (opener) {
      selectedIds.push(opener.id);
      usedIds.add(opener.id);
      const dur = parseSongDuration(opener.duration);
      totalDuration += dur;
      currentSetDuration += dur;
      lastSinger = opener.singers?.[0];
    }

    // 2. STŘEDNÍ ČÁST - Doplnění skladeb a vkládání pauz
    for (const song of priorityList) {
      if (usedIds.has(song.id)) continue;
      if (totalDuration >= totalMinutesAvailable - 10) break; // Necháme místo na finále a přídavek

      // Kontrola, zda nastal čas na vložení 000.Pauzy
      if (currentSetDuration >= maxSetDuration) {
        const breakInserted = insertBreakIfNeeded();
        if (breakInserted) {
          // Po pauze dáme otvírák nové série
          const nextOpener = firstCandidates.find(s => !usedIds.has(s.id)) || preferredCandidates.find(s => !usedIds.has(s.id));
          if (nextOpener) {
            selectedIds.push(nextOpener.id);
            usedIds.add(nextOpener.id);
            const dur = parseSongDuration(nextOpener.duration);
            totalDuration += dur;
            currentSetDuration += dur;
            lastSinger = nextOpener.singers?.[0];
            continue;
          }
        }
      }

      // Kontrola tempa
      const isSlow = song.tempo?.toLowerCase().includes('pomal') || song.tempo?.toLowerCase().includes('slow');
      if (isSlow && consecutiveSlow >= 2) {
        continue; // Přeskočit, abychom neměli 3 pomalé v řadě
      }

      // Kontrola střídání zpěváků (hlasová únava)
      const currentSinger = song.singers?.[0];
      if (currentSinger && lastSinger && currentSinger === lastSinger && priorityList.filter(s => !usedIds.has(s.id)).length > 3) {
        const alt = priorityList.find(s => !usedIds.has(s.id) && s.singers?.[0] && s.singers[0] !== lastSinger);
        if (alt) {
          selectedIds.push(alt.id);
          usedIds.add(alt.id);
          const dur = parseSongDuration(alt.duration);
          totalDuration += dur;
          currentSetDuration += dur;
          lastSinger = alt.singers?.[0];
          consecutiveSlow = alt.tempo?.toLowerCase().includes('pomal') ? consecutiveSlow + 1 : 0;
          continue;
        }
      }

      selectedIds.push(song.id);
      usedIds.add(song.id);
      const dur = parseSongDuration(song.duration);
      totalDuration += dur;
      currentSetDuration += dur;
      lastSinger = currentSinger || lastSinger;
      consecutiveSlow = isSlow ? consecutiveSlow + 1 : 0;
    }

    // 3. FINÁLE (Poslední skladba před přídavkem)
    let closer = lastCandidates.find(s => !usedIds.has(s.id)) || preferredCandidates.find(s => !usedIds.has(s.id));
    if (closer) {
      selectedIds.push(closer.id);
      usedIds.add(closer.id);
      totalDuration += parseSongDuration(closer.duration);
    }

    // 4. PŘÍDAVKY (Encores)
    const encores = encoreCandidates.filter(s => !usedIds.has(s.id));
    for (const enc of encores) {
      selectedIds.push(enc.id);
      usedIds.add(enc.id);
    }

    setSetlistIds(selectedIds);
    setShowGeneratorSettings(false);
    Alert.alert('Vygenerováno', `Setlist byl vygenerován (${selectedIds.length} položek včetně pauz, cca ${Math.round(totalDuration)} min).`);
  };

  // Posunutí skladby nahoru
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newSetlist = [...setlistIds];
    const temp = newSetlist[index];
    newSetlist[index] = newSetlist[index - 1];
    newSetlist[index - 1] = temp;
    setSetlistIds(newSetlist);
  };

  // Posunutí skladby dolů
  const moveDown = (index: number) => {
    if (index === setlistIds.length - 1) return;
    const newSetlist = [...setlistIds];
    const temp = newSetlist[index];
    newSetlist[index] = newSetlist[index + 1];
    newSetlist[index + 1] = temp;
    setSetlistIds(newSetlist);
  };

  // Odebrání skladby
  const removeSong = (index: number) => {
    const newSetlist = setlistIds.filter((_, i) => i !== index);
    setSetlistIds(newSetlist);
  };

  // Přidání konkrétní skladby do setlistu
  const addSongToSetlist = (songId: string) => {
    if (!setlistIds.includes(songId)) {
      setSetlistIds([...setlistIds, songId]);
    }
    setShowAddSongPicker(false);
  };

  // Výpočet celkové délky vybraného setlistu
  const currentSetlistDurationMinutes = setlistIds.reduce((sum, id) => {
    if (id.startsWith('pauza_') || id === '000.Pauza') {
      return sum + 12;
    }
    const s = allSongs.find(song => song.id === id);
    return sum + parseSongDuration(s?.duration);
  }, 0);

  const selectedSongObjects = setlistIds.map(id => {
    if (id.startsWith('pauza_') || id === '000.Pauza') {
      return createPauseSong(id);
    }
    return allSongs.find(s => s.id === id);
  }).filter(Boolean) as Song[];
  const availableSongsToPicker = allSongs.filter(s => !setlistIds.includes(s.id));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={{ padding: Spacing.two }}>
            <ThemedText type="smallBold" style={{ color: '#e91e63' }}>Zrušit</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={{ fontSize: 18 }}>Editor Setlistu</ThemedText>
          <Pressable
            onPress={() => {
              onSaveSetlist(setlistIds);
              onClose();
            }}
            style={{ padding: Spacing.two }}
          >
            <ThemedText type="smallBold" style={{ color: '#4caf50' }}>Uložit</ThemedText>
          </Pressable>
        </View>

        {/* Nástrojová lišta nad seznamem */}
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolBtn, { backgroundColor: '#ff9800' }]}
            onPress={() => setShowGeneratorSettings(true)}
          >
            <SymbolView name={{ ios: 'wand.and.stars', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor="#fff" />
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>Chytré generování</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.toolBtn, { backgroundColor: '#2196f3' }]}
            onPress={() => setShowAddSongPicker(true)}
          >
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>Přidat píseň</ThemedText>
          </Pressable>
        </View>

        {/* Souhrnné info o setlistu */}
        <View style={styles.infoBar}>
          <ThemedText type="smallBold">Počet skladeb: {selectedSongObjects.length}</ThemedText>
          <ThemedText type="smallBold" style={{ color: '#4caf50' }}>Cca {Math.round(currentSetlistDurationMinutes)} min hraní</ThemedText>
        </View>

        {/* Seznam skladeb v setlistu s možností posunu a mazání */}
        <FlatList
          data={selectedSongObjects}
          keyExtractor={(item, idx) => `${item.id}_${idx}`}
          contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
          renderItem={({ item, index }) => {
            const isPause = item.title === '000.Pauza' || item.id.startsWith('pauza_');

            return (
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.songRow,
                  isPause && { backgroundColor: 'rgba(255,152,0,0.15)', borderWidth: 1, borderColor: '#ff9800' }
                ]}
              >
                {/* Pořadové číslo */}
                <View style={[styles.indexCircle, isPause && { backgroundColor: 'rgba(255,152,0,0.3)' }]}>
                  <ThemedText type="smallBold" style={{ fontSize: 12, color: isPause ? '#ff9800' : theme.text }}>
                    {index + 1}.
                  </ThemedText>
                </View>

                {/* Název a detaily písně */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText type="default" style={{ fontWeight: 'bold', color: isPause ? '#ff9800' : theme.text }} numberOfLines={1}>
                      {isPause ? '☕ 000.Pauza' : item.title}
                    </ThemedText>
                    {!isPause && item.isPreferred && (
                      <SymbolView name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} size={12} tintColor="#ffc107" />
                    )}
                    {!isPause && item.isFirst && (
                      <View style={[styles.miniBadge, { backgroundColor: '#4caf50' }]}>
                        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 9 }}>Start</ThemedText>
                      </View>
                    )}
                    {!isPause && item.isLast && (
                      <View style={[styles.miniBadge, { backgroundColor: '#2196f3' }]}>
                        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 9 }}>Konec</ThemedText>
                      </View>
                    )}
                    {!isPause && item.isEncore && (
                      <View style={[styles.miniBadge, { backgroundColor: '#e91e63' }]}>
                        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 9 }}>Přídavek</ThemedText>
                      </View>
                    )}
                  </View>

                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 1 }}>
                    {isPause
                      ? 'Přestávka 12 minut'
                      : `${item.artist ? `${item.artist} • ` : ''}${item.singers?.length ? `🎤 ${item.singers.join(', ')} • ` : ''}${item.duration || '3:30'}`}
                  </ThemedText>
                </View>

                {/* Ovládací šipky nahoru / dolů / smazat */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable
                    style={[styles.actionIcon, { opacity: index === 0 ? 0.3 : 1 }]}
                    onPress={() => moveUp(index)}
                    disabled={index === 0}
                  >
                    <SymbolView name={{ ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' }} size={18} tintColor={theme.text} />
                  </Pressable>

                  <Pressable
                    style={[styles.actionIcon, { opacity: index === selectedSongObjects.length - 1 ? 0.3 : 1 }]}
                    onPress={() => moveDown(index)}
                    disabled={index === selectedSongObjects.length - 1}
                  >
                    <SymbolView name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }} size={18} tintColor={theme.text} />
                  </Pressable>

                  <Pressable style={styles.actionIcon} onPress={() => removeSong(index)}>
                    <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor="#e91e63" />
                  </Pressable>
                </View>
              </ThemedView>
            );
          }}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 30 }}>
              Setlist je prázdný. Vygenerujte ho automaticky nebo přidejte písně ručně.
            </ThemedText>
          }
        />

        {/* MODAL PRO NASTAVENÍ CHYTRÉHO GENERÁTORU */}
        <Modal visible={showGeneratorSettings} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowGeneratorSettings(false)}>
            <ThemedView type="backgroundElement" style={styles.generatorModal}>
              <ThemedText type="subtitle" style={{ fontSize: 18, textAlign: 'center', marginBottom: Spacing.three }}>
                Nastavení generátoru setlistu
              </ThemedText>

              <ThemedText type="smallBold">Celková délka koncertu (hodiny)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                value={playTimeHours}
                onChangeText={setPlayTimeHours}
                keyboardType="numeric"
                placeholder="Např. 2"
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>Doba jedné série (minuty)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                value={setDurationMinutesStr}
                onChangeText={setSetDurationMinutesStr}
                keyboardType="numeric"
                placeholder="Např. 45 nebo 50"
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                💡 Po dosažení délky série vkládá automaticky položku "000.Pauza" s délkou 12 minut.
              </ThemedText>

              <View style={styles.modalButtons}>
                <Pressable style={[styles.modalBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={() => setShowGeneratorSettings(false)}>
                  <ThemedText type="smallBold">Zrušit</ThemedText>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#ff9800' }]} onPress={generateSmartSetlist}>
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>Vygenerovat</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </Pressable>
        </Modal>

        {/* MODAL PRO VÝBĚR PÍSNĚ Z REPERTOÁRU */}
        <Modal visible={showAddSongPicker} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddSongPicker(false)}>
            <ThemedView type="backgroundElement" style={styles.pickerModal}>
              <ThemedText type="subtitle" style={{ fontSize: 18, textAlign: 'center', marginBottom: Spacing.three }}>
                Přidat píseň do setlistu
              </ThemedText>

              <ScrollView style={{ maxHeight: 350 }}>
                {/* Tlačítko pro ruční vložení pauzy */}
                <Pressable
                  style={[styles.pickerRow, { backgroundColor: 'rgba(255,152,0,0.15)', borderRadius: Spacing.two, marginBottom: Spacing.two, paddingHorizontal: 10 }]}
                  onPress={() => {
                    const pauseId = `pauza_${Date.now()}`;
                    setSetlistIds([...setlistIds, pauseId]);
                    setShowAddSongPicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="default" style={{ fontWeight: 'bold', color: '#ff9800' }}>☕ + Vložit 000.Pauza</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Přestávka 12 minut mezi sériemi</ThemedText>
                  </View>
                  <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={22} tintColor="#ff9800" />
                </Pressable>

                {availableSongsToPicker.map(s => (
                  <Pressable
                    key={s.id}
                    style={styles.pickerRow}
                    onPress={() => addSongToSetlist(s.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="default" style={{ fontWeight: 'bold' }}>{s.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{s.artist ? `${s.artist} • ` : ''}{s.duration || '3:30'}</ThemedText>
                    </View>
                    <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={22} tintColor="#2196f3" />
                  </Pressable>
                ))}
                {availableSongsToPicker.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginVertical: 20 }}>
                    Všechny hratelné písničky jsou již v setlistu.
                  </ThemedText>
                )}
              </ScrollView>

              <Pressable style={{ alignSelf: 'center', marginTop: Spacing.three }} onPress={() => setShowAddSongPicker(false)}>
                <ThemedText type="smallBold" style={{ color: '#e91e63' }}>Zavřít</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Spacing.two,
    gap: 6,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  indexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(150,150,150,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.two,
  },
  miniBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  actionIcon: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  generatorModal: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  pickerModal: {
    width: '100%',
    maxWidth: 400,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
});