import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, AudioModule, RecordingPresets } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { AudioRecord } from '@/types';
import {
  getAudioRecords,
  subscribeToAudioRecords,
  addAudioRecord,
  updateAudioRecord,
  deleteAudioRecord,
  uploadAudioToStorage
} from '@/services/firebaseService';

export function AudioRecorder() {
  const theme = useTheme();
  const { activeBand, currentUser, activeRoleView } = useAppStore();

  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const isAdmin = activeRoleView === 'admin' || currentUser?.role === 'admin';

  // Nahrávání audia z mikrofonu přes expo-audio
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const isRecording = recorderState.isRecording || audioRecorder.isRecording;

  const [playerUri, setPlayerUri] = useState<string | null>(null);
  const player = useAudioPlayer(playerUri);

  // Stav pro dočasnou nahrávku (z mikrofonu nebo z disku) před uložením
  const [pendingRecordUri, setPendingRecordUri] = useState<string | null>(null);
  const [pendingRecordDuration, setPendingRecordDuration] = useState(0);
  const [recordTitle, setRecordTitle] = useState('');

  // Živé naslouchání v reálném čase na učené nahrávky ve Firebase
  useEffect(() => {
    if (!activeBand?.id) return;

    const unsubscribe = subscribeToAudioRecords(activeBand.id, (freshRecords) => {
      setRecords(freshRecords);
    });

    return () => {
      unsubscribe();
    };
  }, [activeBand?.id]);

  useEffect(() => {
    if (player && playingId) {
      if (player.status === 'idle') {
        // Přehrávání skončilo
        setPlayingId(null);
      }
    }
  }, [player?.status, playingId]);

  // Automatické spuštění přehrávání po vytvoření hráče pro nové URI
  useEffect(() => {
    if (player && playingId && playerUri) {
      try {
        player.play();
      } catch (e) {
        console.log("Audio play error:", e);
      }
    }
  }, [playerUri]);

  const formatDuration = (millis: number) => {
    if (!millis) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
  };

  // 1. Spuštění a zastavení nahrávání z mikrofonu
  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (permission.status === 'granted') {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setPendingRecordUri(null);
      } else {
        Alert.alert('Chyba', 'Aplikace nemá přístup k mikrofonu.');
      }
    } catch (err) {
      console.error('Nepodařilo se spustit nahrávání', err);
      Alert.alert('Chyba', 'Nepodařilo se spustit nahrávání.');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;

      const durationMillis = recorderState.durationMillis || (audioRecorder.currentTime || 0) * 1000;

      setPendingRecordUri(uri);
      setPendingRecordDuration(durationMillis);
      setRecordTitle(`Záznam ze zkoušky ${formatDate(Date.now())}`);
    } catch (err) {
      console.error('Chyba při zastavení nahrávky', err);
      Alert.alert('Chyba', 'Nahrávku se nepodařilo dokončit.');
    }
  };

  // 2. Výběr audio souboru z disku / úložiště telefonu
  const handlePickDocumentAsync = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileAsset = result.assets[0];
        setPendingRecordUri(fileAsset.uri);
        setPendingRecordDuration(0);
        const cleanName = fileAsset.name.replace(/\.[^/.]+$/, "");
        setRecordTitle(cleanName || 'Importovaný záznam');
      }
    } catch (err) {
      console.error('Chyba při výběru souboru z disku', err);
      Alert.alert('Chyba', 'Nepodařilo se načíst audio soubor z disku.');
    }
  };

  // 3. Uložení nahrávky na Firebase Storage a do Firestore
  const handleSavePendingRecord = async () => {
    if (!activeBand || !pendingRecordUri) return;
    setIsUploading(true);
    try {
      const extension = pendingRecordUri.split('.').pop() || 'm4a';
      const fileName = `record_${Date.now()}.${extension}`;

      // Uložení do Storage složky: kapela_ios_android/"název kapely"/records/
      const uploadResult = await uploadAudioToStorage(
        activeBand.id,
        pendingRecordUri,
        fileName,
        activeBand.name
      );

      // Uložení záznamu do Firestore
      await addAudioRecord(activeBand.id, {
        bandId: activeBand.id,
        title: recordTitle.trim() || 'Nová nahrávka',
        durationMillis: pendingRecordDuration,
        downloadUrl: uploadResult.downloadUrl,
        storagePath: uploadResult.storagePath,
        createdAt: Date.now(),
        isPublic: false, // Výchozí stav: soukromá pro kapelu
      });

      setPendingRecordUri(null);
      setRecordTitle('');
      setIsUploading(false);
    } catch (err) {
      setIsUploading(false);
      console.error('Chyba při ukládání nahrávky', err);
      Alert.alert('Chyba', 'Nahrávku se nepodařilo uložit na server.');
    }
  };

  const handleCancelPending = () => {
    setPendingRecordUri(null);
    setRecordTitle('');
  };

  // 4. Přehrávání nahrávky
  const playRecord = (record: AudioRecord) => {
    if (playingId === record.id && player) {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    try {
      if (player && player.playing) {
        player.pause();
      }

      setPlayingId(record.id);
      setPlayerUri(record.downloadUrl);
    } catch (e) {
      console.error("Nelze přehrát audio:", e);
      Alert.alert("Chyba", "Nepodařilo se přehrát záznam.");
      setPlayingId(null);
    }
  };

  // 5. Zveřejnění / Skrytí pro fanoušky
  const handleTogglePublish = async (record: AudioRecord) => {
    if (!activeBand) return;
    try {
      const newStatus = !record.isPublic;
      await updateAudioRecord(activeBand.id, record.id, { isPublic: newStatus });
    } catch (e) {
      console.error("Chyba při změně viditelnosti:", e);
      Alert.alert("Chyba", "Nepodařilo se upravit viditelnost nahrávky.");
    }
  };

  // 6. Smazání nahrávky adminem
  const handleDelete = (record: AudioRecord) => {
    Alert.alert('Smazat záznam', `Opravdu smazat záznam ${record.title}?`, [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Smazat',
        style: 'destructive',
        onPress: async () => {
          if (!activeBand) return;
          await deleteAudioRecord(activeBand.id, record.id, record.storagePath);
          if (playingId === record.id && player) {
            player.pause();
            setPlayingId(null);
            setPlayerUri(null);
          }
        }
      }
    ]);
  };

  // Pro fanoušky zobrazujeme pouze nahrávky, které mají isPublic === true
  const visibleRecords = activeRoleView === 'fan'
    ? records.filter(r => r.isPublic === true)
    : records;

  return (
    <View style={styles.container}>
      {/* Sekce pro pořizování nahrávek (jen pro členy a adminy) */}
      {activeRoleView !== 'fan' && (
        <View style={styles.recordSection}>
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#f44336" />
              <ThemedText style={{ marginTop: 12 }}>Ukládám nahrávku do cloudu...</ThemedText>
            </View>
          ) : pendingRecordUri ? (
            <View style={styles.saveContainer}>
              <ThemedText type="smallBold" style={{ marginBottom: 12, textAlign: 'center', fontSize: 16 }}>
                Nahrávka připravena
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 6 }}>
                Zadejte název nahrávky:
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder="Název nahrávky..."
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />

              <View style={styles.saveActions}>
                <Pressable style={[styles.actionBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={handleCancelPending}>
                  <ThemedText type="smallBold" style={{ color: theme.text }}>Zahodit</ThemedText>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#4caf50' }]} onPress={handleSavePendingRecord}>
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit na server</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 16, width: '100%' }}>
              <Pressable
                style={[styles.recordButton, isRecording ? styles.recordingActive : styles.recordingInactive]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <SymbolView
                  name={isRecording ? { ios: 'stop.fill', android: 'stop', web: 'stop' } : { ios: 'mic.fill', android: 'mic', web: 'mic' }}
                  size={36}
                  tintColor="#fff"
                />
              </Pressable>

              {isRecording ? (
                <View style={styles.recordingStatus}>
                  <View style={styles.redDot} />
                  <ThemedText type="subtitle" style={{ color: '#f44336' }}>
                    Nahrávám... {formatDuration((recorderState.durationMillis || audioRecorder.currentTime * 1000) || 0)}
                  </ThemedText>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <ThemedText style={{ color: theme.textSecondary }}>Stiskněte mikrofón pro začátek nahrávání</ThemedText>

                  {/* Tlačítko pro nahrání souboru z disku */}
                  <Pressable style={styles.pickFileBtn} onPress={handlePickDocumentAsync}>
                    <SymbolView name={{ ios: 'doc.fill', android: 'folder', web: 'folder' }} size={16} tintColor="#2196f3" />
                    <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 13 }}>
                      Nahrát soubor z disku / telefonu
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Seznam nahrávek */}
      <ThemedText type="subtitle" style={styles.listHeader}>
        Záznamy kapely ({visibleRecords.length})
      </ThemedText>

      {visibleRecords.length === 0 ? (
        <ThemedText style={{ textAlign: 'center', marginTop: 20, color: theme.textSecondary }}>
          {activeRoleView === 'fan' ? 'Zatím nebyly zveřejněny žádné nahrávky pro fanoušky.' : 'Zatím nejsou uloženy žádné nahrávky.'}
        </ThemedText>
      ) : (
        <ScrollView style={styles.list}>
          {visibleRecords.map(record => (
            <ThemedView key={record.id} type="backgroundElement" style={styles.recordCard}>
              <Pressable
                style={styles.playButton}
                onPress={() => playRecord(record)}
              >
                <SymbolView
                  name={playingId === record.id ? { ios: 'pause.fill', android: 'pause', web: 'pause' } : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                  size={24}
                  tintColor="#2196f3"
                />
              </Pressable>

              <View style={styles.recordInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <ThemedText type="default" style={{ fontWeight: 'bold' }}>
                    {record.title}
                  </ThemedText>

                  {/* Odznak viditelnosti */}
                  {record.isPublic ? (
                    <View style={styles.publicBadge}>
                      <ThemedText type="smallBold" style={{ color: '#4caf50', fontSize: 10 }}>
                        🌐 Veřejná
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.privateBadge}>
                      <ThemedText type="smallBold" style={{ color: theme.textSecondary, fontSize: 10 }}>
                        🔒 Soukromá
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <ThemedText type="small" themeColor="textSecondary">{formatDate(record.createdAt)}</ThemedText>
                  {record.durationMillis ? (
                    <ThemedText type="small" themeColor="textSecondary">{formatDuration(record.durationMillis)}</ThemedText>
                  ) : null}
                </View>
              </View>

              {/* Tlačítka pro správa nahrávky (Zveřejnit / Smazat) */}
              {activeRoleView !== 'fan' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {/* Tlačítko Zveřejnit pro fanoušky */}
                  <Pressable onPress={() => handleTogglePublish(record)} style={styles.actionIconButton}>
                    <SymbolView
                      name={record.isPublic ? { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye.fill', android: 'visibility', web: 'visibility' }}
                      size={20}
                      tintColor={record.isPublic ? '#ff9800' : '#4caf50'}
                    />
                  </Pressable>

                  {/* Tlačítko Smazat */}
                  {(isAdmin || true) && (
                    <Pressable onPress={() => handleDelete(record)} style={styles.actionIconButton}>
                      <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={20} tintColor="#e91e63" />
                    </Pressable>
                  )}
                </View>
              )}
            </ThemedView>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  recordSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(200,200,200,0.1)',
    borderRadius: 16,
    marginBottom: 20,
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recordingInactive: {
    backgroundColor: '#f44336',
  },
  recordingActive: {
    backgroundColor: '#000',
  },
  uploadingContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
  },
  pickFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  saveContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(200,200,200,0.1)',
  },
  saveActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  listHeader: {
    fontSize: 18,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33,150,243,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordInfo: {
    flex: 1,
  },
  actionIconButton: {
    padding: 8,
  },
  publicBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  privateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
  },
});
