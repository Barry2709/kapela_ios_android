import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { useAudioRecorder, useAudioPlayer, AudioModule } from 'expo-audio';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { AudioRecord } from '@/types';
import { getAudioRecords, addAudioRecord, deleteAudioRecord, uploadAudioToStorage } from '@/services/firebaseService';

export function AudioRecorder() {
  const theme = useTheme();
  const { activeBand, activeRoleView } = useAppStore();

  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Zvuk přes nové expo-audio
  const audioRecorder = useAudioRecorder({
    sampleRate: 44100,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  const [playerUri, setPlayerUri] = useState<string | null>(null);
  const player = useAudioPlayer(playerUri);

  // Stav pro dočasnou nahrávku před uložením
  const [pendingRecordUri, setPendingRecordUri] = useState<string | null>(null);
  const [pendingRecordDuration, setPendingRecordDuration] = useState(0);
  const [recordTitle, setRecordTitle] = useState('');

  useEffect(() => {
    loadRecords();
  }, [activeBand?.id]);

  useEffect(() => {
    if (player && playingId) {
      if (player.status === 'playing') {
        // Player is playing
      } else if (player.status === 'idle') {
        // Did finish playing
        setPlayingId(null);
      }
    }
  }, [player, player?.status, playingId]);

  const loadRecords = async () => {
    if (!activeBand) return;
    const data = await getAudioRecords(activeBand.id);
    setRecords(data);
  };

  const formatDuration = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
  };

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (permission.status === 'granted') {
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
      audioRecorder.stop();

      const uri = audioRecorder.uri;
      if (!uri) return;

      const durationMillis = audioRecorder.currentTime * 1000 || 0;

      // Zobrazíme formulář pro zadání názvu
      setPendingRecordUri(uri);
      setPendingRecordDuration(durationMillis);
      setRecordTitle(`Záznam ze zkoušky ${formatDate(Date.now())}`);

    } catch (err) {
      console.error('Chyba při zastavení nahrávky', err);
      Alert.alert('Chyba', 'Nahrávku se nepodařilo dokončit.');
    }
  };

  const handleSavePendingRecord = async () => {
    if (!activeBand || !pendingRecordUri) return;
    setIsUploading(true);
    try {
      const fileName = `record_${Date.now()}.m4a`;
      // Nahrání do Storage
      const uploadResult = await uploadAudioToStorage(activeBand.id, pendingRecordUri, fileName);

      // Uložení záznamu do DB
      await addAudioRecord(activeBand.id, {
        bandId: activeBand.id,
        title: recordTitle.trim() || 'Nová nahrávka',
        durationMillis: pendingRecordDuration,
        downloadUrl: uploadResult.downloadUrl,
        storagePath: uploadResult.storagePath,
        createdAt: Date.now(),
      });

      setPendingRecordUri(null);
      setRecordTitle('');
      setIsUploading(false);
      loadRecords();
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

  const playRecord = async (record: AudioRecord) => {
    if (playingId === record.id && player) {
      // Pause
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    try {
      if (player) {
        player.pause();
      }

      setPlayerUri(record.downloadUrl);
      setPlayingId(record.id);

      // We use a small timeout to let the hook react to new URI and instantiate the player
      setTimeout(() => {
         player?.play();
      }, 100);
    } catch (e) {
      console.error("Nelze přehrát audio:", e);
      Alert.alert("Chyba", "Nepodařilo se přehrát záznam.");
      setPlayingId(null);
    }
  };

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
          loadRecords();
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.recordSection}>
        {isUploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#f44336" />
            <ThemedText style={{ marginTop: 12 }}>Ukládám nahrávku...</ThemedText>
          </View>
        ) : pendingRecordUri ? (
          <View style={styles.saveContainer}>
            <ThemedText type="smallBold" style={{ marginBottom: 12, textAlign: 'center', fontSize: 16 }}>
              Nahrávání dokončeno
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 6 }}>
              Pojmenovat nahrávku:
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
          <Pressable
            style={[styles.recordButton, audioRecorder.isRecording ? styles.recordingActive : styles.recordingInactive]}
            onPress={audioRecorder.isRecording ? stopRecording : startRecording}
          >
            <SymbolView
              name={audioRecorder.isRecording ? {ios: 'stop.fill', android: 'stop', web: 'stop'} : {ios: 'mic.fill', android: 'mic', web: 'mic'}}
              size={36}
              tintColor="#fff"
            />
          </Pressable>
        )}

        {audioRecorder.isRecording && (
          <View style={styles.recordingStatus}>
            <View style={styles.redDot} />
            <ThemedText type="subtitle" style={{ color: '#f44336' }}>Nahrávám... {formatDuration(audioRecorder.currentTime * 1000)}</ThemedText>
          </View>
        )}
        {!audioRecorder.isRecording && !isUploading && !pendingRecordUri && (
          <ThemedText style={{ marginTop: 12, color: theme.textSecondary }}>Stiskněte pro začátek nahrávání</ThemedText>
        )}
      </View>

      <ThemedText type="subtitle" style={styles.listHeader}>Kapela records ({records.length})</ThemedText>

      {records.length === 0 ? (
        <ThemedText style={{ textAlign: 'center', marginTop: 20, color: theme.textSecondary }}>Zatím nejsou žádné nahrávky.</ThemedText>
      ) : (
        <ScrollView style={styles.list}>
          {records.map(record => (
            <ThemedView key={record.id} type="backgroundElement" style={styles.recordCard}>
              <Pressable
                style={styles.playButton}
                onPress={() => playRecord(record)}
              >
                <SymbolView
                  name={playingId === record.id ? {ios: 'pause.fill', android: 'pause', web: 'pause'} : {ios: 'play.fill', android: 'play_arrow', web: 'play_arrow'}}
                  size={24}
                  tintColor="#2196f3"
                />
              </Pressable>

              <View style={styles.recordInfo}>
                <ThemedText type="default" style={{ fontWeight: 'bold' }}>{record.title}</ThemedText>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <ThemedText type="small" themeColor="textSecondary">{formatDate(record.createdAt)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatDuration(record.durationMillis || 0)}</ThemedText>
                </View>
              </View>

              {activeRoleView !== 'fan' && (
                <Pressable onPress={() => handleDelete(record)} style={styles.deleteButton}>
                  <SymbolView name={{ios: 'trash.fill', android: 'delete', web: 'delete'}} size={20} tintColor="#e91e63" />
                </Pressable>
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
    paddingVertical: 30,
    backgroundColor: 'rgba(200,200,200,0.1)',
    borderRadius: 16,
    marginBottom: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    marginTop: 16,
    gap: 8,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
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
  deleteButton: {
    padding: 8,
  }
});
