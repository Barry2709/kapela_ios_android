import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Modal, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Song, BandMember, LiveSessionPayload } from '@/types';
import { liveSyncService } from '@/services/liveSyncService';
import { getSongs, addSong, updateSong, deleteSong, deleteAllSongs, getBandMembers, subscribeToSongs, getSongsPlus, addSongPlus, updateSongPlus, deleteSongPlus, deleteAllSongsPlus, uploadSongPlusTextToStorage } from '@/services/firebaseService';
import { AddSongForm } from '@/components/add-song-form';
import { SongLyricsViewer } from '@/components/song-lyrics-viewer';
import { AudioRecorder } from '@/components/audio-recorder';
import { fixCzechDiacritics, decodeBytesToCzechText, base64ToUint8Array, capitalizeFirstLetter, hasVocalsInProfile, getMemberDisplayName } from '@/utils/diacritics';

export default function RepertoireScreen() {
  const theme = useTheme();
  const { activeBand, activeRoleView, repertoireTab, currentUser } = useAppStore();

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsPlus, setSongsPlus] = useState<Song[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [showSourcePickerModal, setShowSourcePickerModal] = useState(false);

  // Live Režim stav
  const [isLiveSyncActive, setIsLiveSyncActive] = useState(false);
  const [livePayload, setLivePayload] = useState<LiveSessionPayload | null>(null);

  useEffect(() => {
    if (!activeBand?.id) return;
    const unsubscribe = liveSyncService.startListening(activeBand.id, (payload) => {
      setLivePayload(payload);
      if (payload?.isActive && payload?.activeSongId) {
        setIsLiveSyncActive(true);
        const songIdx = songs.findIndex(s => s.id === payload.activeSongId);

        let isSelfAdmin = false;
        if (payload.deviceId) {
          isSelfAdmin = payload.deviceId === liveSyncService.deviceId;
        } else {
          isSelfAdmin = !!(payload.adminUid && payload.adminUid === currentUser?.uid && activeRoleView === 'admin');
        }

        if (songIdx !== -1 && !isSelfAdmin) {
          setSelectedLyricsIndex(songIdx);
          setShowLyricsViewerModal(true);
        }
      } else {
        setIsLiveSyncActive(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeBand?.id, songs, activeRoleView]);

  const handleToggleLiveMode = async () => {
    if (!activeBand?.id) return;
    if (isLiveSyncActive) {
      await liveSyncService.endLiveSession(activeBand.id);
      setIsLiveSyncActive(false);
    } else {
      setIsLiveSyncActive(true);
      // Živý režim je aktivován – píseň se vyšle členům až po kliknutí na konkrétní skladbu
    }
  };

  // Vyhledávání a filtry
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState<number>(0); // 0 = Vše, 1 = Hrajeme, 2 = Nehrajeme

  // Full-screen prohlížeč textu a akordů
  const [showLyricsViewerModal, setShowLyricsViewerModal] = useState(false);
  const [selectedLyricsIndex, setSelectedLyricsIndex] = useState(0);

  // Stav pro hromadné nahrávání skladeb
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [showEditSongModal, setShowEditSongModal] = useState(false);

  useEffect(() => {
    if (!activeBand?.id) return;

    if (bandMembers.length === 0) {
      getBandMembers(activeBand.id).then(m => setBandMembers(m)).catch(() => {});
    }

    if (repertoireTab === 'nase_pisne') {
      loadSongs();
      const unsubscribe = subscribeToSongs(activeBand.id, (freshSongs) => {
        const cleanedData = freshSongs.map(song => ({
          ...song,
          title: capitalizeFirstLetter(fixCzechDiacritics(song.title || '')),
        }));
        cleanedData.sort((a, b) => a.title.localeCompare(b.title));
        setSongs(cleanedData);
      });
      return () => unsubscribe();
    } else if (repertoireTab === 'zpevnik_plus') {
      loadSongsPlus();
    }
  }, [activeBand?.id, repertoireTab]);

  // Pouze členové kapely, kteří mají u sebe v profilu zadaný zpěv/vokál
  const vocalMembers = bandMembers.filter(hasVocalsInProfile);
  const singerMembers = vocalMembers.length > 0 ? vocalMembers : bandMembers;

  const loadSongs = async () => {
    if (!activeBand) return;
    try {
      const data = await getSongs(activeBand.id);
      const cleanedData = data.map(song => ({
        ...song,
        title: capitalizeFirstLetter(fixCzechDiacritics(song.title || ''))
      }));
      cleanedData.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(cleanedData);
    } catch (e) {
      console.error("Nepodařilo se načíst písně:", e);
    }
  };

  const loadSongsPlus = async () => {
    if (!activeBand) return;
    try {
      const data = await getSongsPlus(activeBand.id);
      const cleanedData = data.map(song => ({
        ...song,
        title: capitalizeFirstLetter(fixCzechDiacritics(song.title || ''))
      }));
      cleanedData.sort((a, b) => a.title.localeCompare(b.title));
      setSongsPlus(cleanedData);
    } catch (e) {
      console.error("Nepodařilo se načíst Zpěvník+:", e);
    }
  };

  // Rychlé přepnutí "Hrajeme / Nehrajeme" v rychlém editačním módu (Modrá hvězdička)
  const handleToggleLiveQuick = async (song: Song) => {
    if (!activeBand) return;
    const newLive = song.isLive === false ? true : false;

    if (repertoireTab === 'zpevnik_plus') {
      setSongsPlus(prev => prev.map(s => s.id === song.id ? { ...s, isLive: newLive } : s));
      try {
        await updateSongPlus(activeBand.id, song.id, { isLive: newLive });
      } catch (e) {
        console.error("Chyba při rychlé úpravě stavu Hrajeme ve Zpěvníku+:", e);
      }
    } else {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, isLive: newLive } : s));
      try {
        await updateSong(activeBand.id, song.id, { isLive: newLive });
      } catch (e) {
        console.error("Chyba při rychlé úpravě stavu Hrajeme:", e);
      }
    }
  };

  // Rychlé přepnutí "Preferované" v rychlém editačním módu (Žluté srdíčko)
  const handleTogglePreferredQuick = async (song: Song) => {
    if (!activeBand) return;
    const newPref = !song.isPreferred;

    if (repertoireTab === 'zpevnik_plus') {
      setSongsPlus(prev => prev.map(s => s.id === song.id ? { ...s, isPreferred: newPref } : s));
      try {
        await updateSongPlus(activeBand.id, song.id, { isPreferred: newPref });
      } catch (e) {
        console.error("Chyba při rychlé úpravě preferencí ve Zpěvníku+:", e);
      }
    } else {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, isPreferred: newPref } : s));
      try {
        await updateSong(activeBand.id, song.id, { isPreferred: newPref });
      } catch (e) {
        console.error("Chyba při rychlé úpravě preferencí:", e);
      }
    }
  };

  // Rychlé přepnutí zpěváka u písničky
  const handleToggleSingerQuick = async (song: Song, memberObj: BandMember) => {
    if (!activeBand) return;
    const displayName = capitalizeFirstLetter(getMemberDisplayName(memberObj));
    const currentSingers = song.singers || [];
    const exists = currentSingers.some(s =>
      s === displayName ||
      s === memberObj.id ||
      s === memberObj.nickname ||
      s === memberObj.firstName
    );

    const newSingers = exists
      ? currentSingers.filter(s =>
          s !== displayName &&
          s !== memberObj.id &&
          s !== memberObj.nickname &&
          s !== memberObj.firstName
        )
      : [...currentSingers, displayName];

    if (repertoireTab === 'zpevnik_plus') {
      setSongsPlus(prev => prev.map(s => s.id === song.id ? { ...s, singers: newSingers } : s));
      try {
        await updateSongPlus(activeBand.id, song.id, { singers: newSingers });
      } catch (e) {
        console.error("Chyba při rychlé úpravě zpěváků ve Zpěvníku+:", e);
      }
    } else {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, singers: newSingers } : s));
      try {
        await updateSong(activeBand.id, song.id, { singers: newSingers });
      } catch (e) {
        console.error("Chyba při rychlé úpravě zpěváků:", e);
      }
    }
  };

  // Oříznutí pouze POSLEDNÍ přípony souboru (např. "015.něco.txt" -> "015.něco")
  const extractTitleFromFileName = (fileName: string) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      return fileName.substring(0, lastDotIndex);
    }
    return fileName;
  };

  const readTextFromAsset = async (asset: any): Promise<string> => {
    try {
      let bytes: Uint8Array | null = null;

      // Metoda A: Web asset.file.arrayBuffer()
      if (asset.file && typeof asset.file.arrayBuffer === 'function') {
        try {
          const buf = await asset.file.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            bytes = new Uint8Array(buf);
          }
        } catch (e) {}
      }

      // Metoda B: Univerzální Blob -> FileReader.readAsDataURL -> Base64 -> Uint8Array (Android / iOS / Web)
      // Získává 100% čisté neporušené binární bajty z jakéhokoliv souboru bez chyb v React Native
      if ((!bytes || bytes.length === 0) && asset.uri) {
        try {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          if (blob) {
            const dataUrl = await new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(null);
              try {
                reader.readAsDataURL(blob);
              } catch (e) {
                resolve(null);
              }
            });

            if (dataUrl && dataUrl.includes(',')) {
              const base64Str = dataUrl.split(',')[1];
              if (base64Str) {
                bytes = base64ToUint8Array(base64Str);
              }
            }
          }
        } catch (e) {}
      }

      // Metoda C: Záložní čtení přes FileSystem (pokud je dostupné)
      if ((!bytes || bytes.length === 0) && asset.uri && Platform.OS !== 'web') {
        try {
          const base64Str = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (base64Str) {
            bytes = base64ToUint8Array(base64Str);
          }
        } catch (e) {}
      }

      if (bytes && bytes.length > 0) {
        return decodeBytesToCzechText(bytes);
      }

      return '';
    } catch (e) {
      console.error("Chyba při dekódování souboru:", e);
      return '';
    }
  };

  const handleImportFileDirectly = async (source: 'local' | 'gdrive' | 'icloud') => {
    setShowSourcePickerModal(false);
    if (!activeBand) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsImportingBatch(true);
        setImportProgress({ current: 0, total: result.assets.length });

        // KROK 1: OKAMŽITĚ v milisekundách paralelně načteme texty VŠECH souborů do paměti
        const preparedItems = await Promise.all(
          result.assets.map(async (asset) => {
            const rawTitle = extractTitleFromFileName(asset.name);
            const songTitle = fixCzechDiacritics(rawTitle);
            const rawLyrics = await readTextFromAsset(asset);
            const extractedLyrics = fixCzechDiacritics(rawLyrics);
            const lowerName = asset.name.toLowerCase();
            const isTextFile = lowerName.endsWith('.txt') || lowerName.endsWith('.chordpro') || lowerName.endsWith('.pro') || lowerName.endsWith('.mss') || extractedLyrics.length > 0;

            let finalTitle = songTitle;
            let finalArtist = "";

            // ChordPro parsing
            if (extractedLyrics) {
              const lines = extractedLyrics.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                   const directive = trimmed.slice(1, -1).trim();
                   if (directive.toLowerCase().startsWith('title:') || directive.toLowerCase().startsWith('t:')) {
                      finalTitle = fixCzechDiacritics(directive.substring(directive.indexOf(':') + 1).trim());
                   } else if (directive.toLowerCase().startsWith('artist:') || directive.toLowerCase().startsWith('a:')) {
                      finalArtist = fixCzechDiacritics(directive.substring(directive.indexOf(':') + 1).trim());
                   }
                }
              }
            }

            return {
              title: finalTitle,
              artist: finalArtist || undefined,
              fileName: asset.name,
              fileUri: isTextFile ? undefined : asset.uri,
              fileSource: source,
              lyrics: extractedLyrics || '',
            };
          })
        );

        // KROK 2: Postupně uložíme kompletní načtená data z paměti na Firebase
        for (let i = 0; i < preparedItems.length; i++) {
          setImportProgress({ current: i + 1, total: preparedItems.length });
          const item = preparedItems[i];

          const newSongData = {
            bandId: activeBand.id,
            title: item.title,
            artist: item.artist,
            fileUri: item.fileUri,
            fileName: item.fileName,
            fileSource: item.fileSource,
            lyrics: item.lyrics,
            isLive: true,
            isPreferred: false,
          };

          let newSongId: string;
          if (repertoireTab === 'zpevnik_plus') {
            newSongId = await addSongPlus(activeBand.id, newSongData);
            if (item.lyrics) {
              uploadSongPlusTextToStorage(activeBand.id, item.title, item.lyrics, item.fileName)
                .then(res => updateSongPlus(activeBand.id, newSongId, { lyrics: res.storageUrl }))
                .catch(e => console.log(e));
            }
          } else {
            newSongId = await addSong(activeBand.id, newSongData);
          }
        }

        setIsImportingBatch(false);
        if (repertoireTab === 'zpevnik_plus') {
          loadSongsPlus();
        } else {
          loadSongs();
        }
      }
    } catch (e) {
      setIsImportingBatch(false);
      console.error("Nepodařilo se nahrát soubory:", e);
    }
  };

  const openEditSong = (song: Song) => {
    setEditingSong(song);
    setShowEditSongModal(true);
  };

  const openLyricsViewer = (index: number) => {
    setSelectedLyricsIndex(index);
    setShowLyricsViewerModal(true);

    const targetSong = filteredSongs[index];
    if (activeRoleView === 'admin' && isLiveSyncActive && targetSong && activeBand?.id) {
      liveSyncService.broadcastSongChange(
        activeBand.id,
        currentUser?.uid || 'admin',
        currentUser?.displayName || 'Kapelník',
        targetSong.id
      );
    }
  };

  const handleSaveSongUpdate = async (songData: Omit<Song, 'id'>) => {
    if (!activeBand) return;
    try {
      if (editingSong) {
        if (repertoireTab === 'zpevnik_plus') {
          await updateSongPlus(activeBand.id, editingSong.id, songData);
        } else {
          await updateSong(activeBand.id, editingSong.id, songData);
        }
      } else {
        if (repertoireTab === 'zpevnik_plus') {
          await addSongPlus(activeBand.id, {
            ...songData,
            bandId: activeBand.id,
          });
        } else {
          await addSong(activeBand.id, {
            ...songData,
            bandId: activeBand.id,
          });
        }
      }
      setShowEditSongModal(false);
      setEditingSong(null);
      if (repertoireTab === 'zpevnik_plus') {
        loadSongsPlus();
      } else {
        loadSongs();
      }
    } catch (e) {
      Alert.alert("Chyba", "Nepodařilo se uložit píseň.");
    }
  };

  const handleDeleteSong = (songId: string) => {
    Alert.alert("Smazat píseň", "Opravdu chcete smazat tuto píseň?", [
      { text: "Zrušit", style: "cancel" },
      {
        text: "Smazat",
        style: "destructive",
        onPress: async () => {
          if (!activeBand) return;
          if (repertoireTab === 'zpevnik_plus') {
            await deleteSongPlus(activeBand.id, songId);
            loadSongsPlus();
          } else {
            await deleteSong(activeBand.id, songId);
            loadSongs();
          }
          setShowEditSongModal(false);
          setEditingSong(null);
        }
      }
    ]);
  };

  const handleClearAllSongs = () => {
    const isPlus = repertoireTab === 'zpevnik_plus';
    Alert.alert(
      isPlus ? "Smazat Zpěvník +" : "Smazat VŠECHNY písně",
      isPlus ? "Opravdu chcete smazat VŠECHNY písně ze Zpěvníku +?" : "Opravdu chcete smazat VŠECHNY písně z repertoáru?",
      [
      { text: "Zrušit", style: "cancel" },
      {
        text: "Smazat vše",
        style: "destructive",
        onPress: async () => {
          if (!activeBand) return;
          if (isPlus) {
            await deleteAllSongsPlus(activeBand.id);
            loadSongsPlus();
          } else {
            await deleteAllSongs(activeBand.id);
            loadSongs();
          }
        }
      }
    ]);
  };

  // Vyhledávání bez diakritiky
  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const processSongsForView = (songList: Song[]) => {
    return songList.filter(song => {
      if (repertoireTab === 'zpevnik_plus') {
        if (filterMode === 1 && song.isPreferred !== true) return false; // Oblíbené (pouze s isPreferred: true)
        if (filterMode === 2 && song.isPreferred === true) return false; // Ostatní
      } else {
        if (filterMode === 1 && song.isLive === false) return false; // Hrajeme
        if (filterMode === 2 && song.isLive !== false) return false; // Nehrajeme
      }

      if (!searchText.trim()) return true;
      const rawQuery = searchText.trim();
      const query = removeAccents(fixCzechDiacritics(rawQuery));

      const songTitleClean = fixCzechDiacritics(song.title);
      const songArtistClean = fixCzechDiacritics(song.artist || '');

      const matchTitle = removeAccents(songTitleClean).includes(query);
      const matchArtist = removeAccents(songArtistClean).includes(query);

      return matchTitle || matchArtist;
    });
  };

  const activeSongList = repertoireTab === 'zpevnik_plus' ? songsPlus : songs;
  const filteredSongs = processSongsForView(activeSongList);

  const liveCount = repertoireTab === 'zpevnik_plus'
    ? activeSongList.filter(s => s.isPreferred === true).length
    : activeSongList.filter(s => s.isLive !== false).length;

  const notLiveCount = activeSongList.length - liveCount;

  const titleMap = {
    nase_pisne: 'Naše písně',
    zpevnik_plus: 'Zpěvník +',
    audio_zapisnik: 'Audio zápisník',
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <PageHeader title={titleMap[repertoireTab] || 'Zpěvník'} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* SEKCE NAŠE PÍSNĚ A ZPĚVNÍK + */}
          {(repertoireTab === 'nase_pisne' || repertoireTab === 'zpevnik_plus') && (
            <View style={styles.sectionContainer}>
              {/* Hlavička s tlačítky pro Obnovení, Rychlou editaci, Smazání všech a Přidání */}
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={{ fontSize: 18 }}>
                  {repertoireTab === 'zpevnik_plus' ? 'Zpěvník +' : 'Repertoár'} ({filteredSongs.length})
                </ThemedText>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  {/* Tlačítko Znovunačtení z Firebase */}
                  <Pressable
                    style={[styles.circleAddBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]}
                    onPress={() => {
                      if (repertoireTab === 'zpevnik_plus') {
                        loadSongsPlus();
                      } else {
                        loadSongs();
                      }
                    }}
                  >
                    <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={18} tintColor={theme.text} />
                  </Pressable>

                  {/* Tlačítko Rychlá editace (Tužka) - Žlutě pokud aktivní, bíle/standardně pokud neaktivní */}
                  {activeRoleView !== 'fan' && (
                    <Pressable
                      style={[
                        styles.circleAddBtn,
                        {
                          backgroundColor: isQuickEditMode ? '#ffc107' : 'rgba(150,150,150,0.2)',
                          borderColor: isQuickEditMode ? '#ffc107' : 'transparent',
                          borderWidth: isQuickEditMode ? 1 : 0,
                        }
                      ]}
                      onPress={() => setIsQuickEditMode(!isQuickEditMode)}
                    >
                      <SymbolView
                        name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                        size={18}
                        tintColor={isQuickEditMode ? '#000' : theme.text}
                      />
                    </Pressable>
                  )}

                  {/* Tlačítko Smazat vše (s vyžadováním potvrzení) */}
                  {activeRoleView !== 'fan' && activeSongList.length > 0 && (
                    <Pressable
                      style={[styles.circleAddBtn, { backgroundColor: 'rgba(233,30,99,0.15)' }]}
                      onPress={handleClearAllSongs}
                    >
                      <SymbolView name={{ ios: 'trash.fill', android: 'delete_forever', web: 'delete_forever' }} size={18} tintColor="#e91e63" />
                    </Pressable>
                  )}

                  {/* Tlačítko Přidat novou píseň */}
                  {activeRoleView !== 'fan' && (
                    <Pressable
                      style={[styles.circleAddBtn, { backgroundColor: theme.text }]}
                      onPress={() => setShowSourcePickerModal(true)}
                    >
                      <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={18} tintColor={theme.background} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Vyhledávací lišta */}
              <View style={[styles.searchBar, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Hledat skladbu nebo autora..."
                  placeholderTextColor={theme.textSecondary}
                />
                {searchText !== '' && (
                  <Pressable onPress={() => setSearchText('')}>
                    <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} tintColor={theme.textSecondary} />
                  </Pressable>
                )}
              </View>

              {/* Filtrovací štítky: Vše / Hrajeme / Nehrajeme nebo Oblíbené */}
              <View style={styles.filterRow}>
                {repertoireTab === 'zpevnik_plus' ? [
                  { mode: 0, label: `Vše (${activeSongList.length})` },
                  { mode: 1, label: `Oblíbené (${liveCount})` },
                ].map(item => {
                  const isActive = filterMode === item.mode;
                  return (
                    <Pressable
                      key={item.mode}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isActive ? '#e91e63' : 'rgba(200,200,200,0.18)',
                          borderColor: isActive ? '#e91e63' : 'rgba(200,200,200,0.3)',
                        }
                      ]}
                      onPress={() => setFilterMode(item.mode)}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: isActive ? '#fff' : theme.text, fontSize: 11 }}
                      >
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                }) : [
                  { mode: 0, label: `Vše (${activeSongList.length})` },
                  { mode: 1, label: `Hrajeme (${liveCount})` },
                  { mode: 2, label: `Nehrajeme (${notLiveCount})` },
                ].map(item => {
                  const isActive = filterMode === item.mode;
                  return (
                    <Pressable
                      key={item.mode}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isActive ? '#4caf50' : 'rgba(200,200,200,0.18)',
                          borderColor: isActive ? '#4caf50' : 'rgba(200,200,200,0.3)',
                        }
                      ]}
                      onPress={() => setFilterMode(item.mode)}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: isActive ? '#fff' : theme.text, fontSize: 11 }}
                      >
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Seznam skladeb s Rychlou editací */}
              <View style={styles.list}>
                {filteredSongs.map((song, index) => (
                  <Pressable key={song.id} onPress={() => openLyricsViewer(index)}>
                    <ThemedView type="backgroundElement" style={styles.songRowCard}>
                      {/* Pro Naše Písně v rychlé editaci: Modrá hvězdička a Žluté srdíčko */}
                      {repertoireTab === 'nase_pisne' && isQuickEditMode && (
                        <>
                          <Pressable
                            style={{ paddingRight: 6, paddingVertical: 4 }}
                            hitSlop={8}
                            onPress={() => handleToggleLiveQuick(song)}
                          >
                            <SymbolView
                              name={{
                                ios: song.isLive !== false ? 'star.fill' : 'star',
                                android: song.isLive !== false ? 'star' : 'star_outline',
                                web: song.isLive !== false ? 'star' : 'star_outline'
                              }}
                              size={20}
                              tintColor={song.isLive !== false ? '#2196f3' : 'rgba(150,150,150,0.4)'}
                            />
                          </Pressable>
                          <Pressable
                            style={{ paddingRight: 8, paddingVertical: 4 }}
                            hitSlop={8}
                            onPress={() => handleTogglePreferredQuick(song)}
                          >
                            <SymbolView
                              name={{
                                ios: song.isPreferred ? 'heart.fill' : 'heart',
                                android: song.isPreferred ? 'favorite' : 'favorite_border',
                                web: song.isPreferred ? 'favorite' : 'favorite_border'
                              }}
                              size={20}
                              tintColor={song.isPreferred ? '#ffc107' : 'rgba(150,150,150,0.4)'}
                            />
                          </Pressable>
                        </>
                      )}

                      {/* Pro Zpěvník+ VŽDY zobrazujeme Červené srdíčko (Oblíbené) pro rychlé přepnutí */}
                      {repertoireTab === 'zpevnik_plus' && (
                        <Pressable
                          style={{ paddingRight: 10, paddingVertical: 4 }}
                          hitSlop={12}
                          onPress={() => handleTogglePreferredQuick(song)}
                        >
                          <SymbolView
                            name={{
                              ios: song.isPreferred ? 'heart.fill' : 'heart',
                              android: song.isPreferred ? 'favorite' : 'favorite',
                              web: song.isPreferred ? 'favorite' : 'favorite'
                            }}
                            size={24}
                            tintColor={song.isPreferred ? '#e91e63' : 'rgba(150,150,150,0.3)'}
                          />
                        </Pressable>
                      )}

                      {/* Název písničky a autor */}
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText
                            type="default"
                            style={{
                              fontWeight: 'bold',
                              fontSize: 16,
                              color: (repertoireTab === 'nase_pisne' && song.isLive === false) ? theme.textSecondary : theme.text,
                              opacity: (repertoireTab === 'nase_pisne' && song.isLive === false) ? 0.6 : 1.0,
                              textDecorationLine: 'none',
                            }}
                            numberOfLines={1}
                          >
                            {capitalizeFirstLetter(song.title)}
                          </ThemedText>

                          {/* Mimo rychlou editaci pro Naše Písně: Malé žluté srdíčko pro preferované */}
                          {repertoireTab === 'nase_pisne' && !isQuickEditMode && song.isPreferred && (
                            <SymbolView name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} size={14} tintColor="#ffc107" />
                          )}
                        </View>

                        {song.artist ? (
                          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, marginTop: 1 }}>
                            {fixCzechDiacritics(song.artist)}
                          </ThemedText>
                        ) : null}

                        {/* Dynamicky rozšiřované štítky členů kapely se zpěvem */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' }}>
                          {singerMembers.map(m => {
                            const rawName = getMemberDisplayName(m);
                            const singerName = capitalizeFirstLetter(rawName);
                            const isSelected = song.singers?.some(s =>
                              s === rawName ||
                              s === singerName ||
                              s === m.id ||
                              s === m.nickname ||
                              s === m.firstName
                            );

                            if (isQuickEditMode) {
                              return (
                                <Pressable
                                  key={m.id}
                                  style={[
                                    styles.miniSingerChip,
                                    {
                                      backgroundColor: isSelected ? 'rgba(33,150,243,0.25)' : 'rgba(200,200,200,0.12)',
                                      borderColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.25)',
                                    }
                                  ]}
                                  onPress={() => handleToggleSingerQuick(song, m)}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <SymbolView
                                      name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                                      size={12}
                                      tintColor={isSelected ? '#2196f3' : theme.textSecondary}
                                    />
                                    <ThemedText
                                      type="smallBold"
                                      style={{
                                        fontSize: 11,
                                        color: isSelected ? '#2196f3' : theme.textSecondary,
                                      }}
                                    >
                                      {singerName}
                                    </ThemedText>
                                  </View>
                                </Pressable>
                              );
                            }

                            if (!isSelected) return null;

                            return (
                              <View key={m.id} style={styles.miniSingerBadge}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <SymbolView
                                    name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                                    size={12}
                                    tintColor="#2196f3"
                                  />
                                  <ThemedText type="smallBold" style={{ fontSize: 11, color: '#2196f3' }}>
                                    {singerName}
                                  </ThemedText>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {/* Ikonka tužky pro plnou úpravu formuláře */}
                      {activeRoleView !== 'fan' && (
                        <Pressable onPress={() => openEditSong(song)} style={{ padding: 6 }} hitSlop={6}>
                          <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={20} tintColor={theme.textSecondary} />
                        </Pressable>
                      )}
                    </ThemedView>
                  </Pressable>
                ))}

                {filteredSongs.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                    Nenalezeny žádné odpovídající skladby.
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {repertoireTab === 'audio_zapisnik' && (
            <View style={{ flex: 1, marginTop: Spacing.two }}>
              <AudioRecorder />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Full-screen prohlížeč textu a akordů (Lyrics Viewer z Naplech Koncerty) */}
      <Modal visible={showLyricsViewerModal} animationType="slide" presentationStyle="fullScreen">
        <SongLyricsViewer
          songs={filteredSongs}
          initialIndex={selectedLyricsIndex}
          onClose={async () => {
            if (activeRoleView === 'admin' && activeBand?.id && isLiveSyncActive) {
              await liveSyncService.endLiveSession(activeBand.id);
              setIsLiveSyncActive(false);
            }
            setShowLyricsViewerModal(false);
          }}
          onUpdateSong={async (songId, updates) => {
            if (!activeBand) return;
            await updateSong(activeBand.id, songId, updates);
            loadSongs();
          }}
        />
      </Modal>

      {/* Modal pro výběr zdroje souboru / ruční zápis */}
      <Modal visible={showSourcePickerModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSourcePickerModal(false)}>
          <ThemedView type="backgroundElement" style={styles.sourcePickerModal}>
            <ThemedText type="subtitle" style={{ fontSize: 18, textAlign: 'center', marginBottom: Spacing.three }}>
              Přidat novou píseň do repertoáru
            </ThemedText>

            {/* Ruční zápis z klávesnice */}
            <Pressable
              style={[styles.sourceModalOption, { backgroundColor: 'rgba(255,193,7,0.18)', borderColor: 'rgba(255,193,7,0.4)', borderWidth: 1 }]}
              onPress={() => {
                setShowSourcePickerModal(false);
                setEditingSong(null);
                setShowEditSongModal(true);
              }}
            >
              <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} size={22} tintColor="#ffc107" />
              <ThemedText type="smallBold" style={{ marginLeft: 10, fontSize: 15, color: theme.text }}>
                Ruční zápis (Napsat z klávesnice)
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.sourceModalOption, { backgroundColor: 'rgba(200,200,200,0.18)' }]}
              onPress={() => handleImportFileDirectly('local')}
            >
              <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={22} tintColor={theme.text} />
              <ThemedText type="smallBold" style={{ marginLeft: 10, fontSize: 15 }}>
                Z disku (Lokální paměť / Soubory)
              </ThemedText>
            </Pressable>

            {Platform.OS === 'android' ? (
              <Pressable
                style={[styles.sourceModalOption, { backgroundColor: 'rgba(200,200,200,0.18)' }]}
                onPress={() => handleImportFileDirectly('gdrive')}
              >
                <SymbolView name={{ ios: 'cloud', android: 'cloud', web: 'cloud' }} size={22} tintColor="#2196f3" />
                <ThemedText type="smallBold" style={{ marginLeft: 10, fontSize: 15 }}>
                  Z Google Disku
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.sourceModalOption, { backgroundColor: 'rgba(200,200,200,0.18)' }]}
                onPress={() => handleImportFileDirectly('icloud')}
              >
                <SymbolView name={{ ios: 'icloud', android: 'cloud', web: 'cloud' }} size={22} tintColor="#2196f3" />
                <ThemedText type="smallBold" style={{ marginLeft: 10, fontSize: 15 }}>
                  Z iCloud Drive
                </ThemedText>
              </Pressable>
            )}

            <Pressable style={styles.cancelModalBtn} onPress={() => setShowSourcePickerModal(false)}>
              <ThemedText type="smallBold" style={{ color: '#e91e63' }}>Zrušit</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal s průběhem hromadného nahrávání */}
      <Modal visible={isImportingBatch} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.progressModal}>
            <SymbolView name={{ ios: 'square.and.arrow.down.fill', android: 'cloud_download', web: 'cloud_download' }} size={32} tintColor="#4caf50" />
            <ThemedText type="subtitle" style={{ marginTop: 8, fontSize: 18, textAlign: 'center' }}>
              Hromadné nahrávání skladeb...
            </ThemedText>
            <ThemedText type="default" style={{ fontWeight: 'bold', marginTop: 4, color: '#4caf50' }}>
              Nahrávám {importProgress.current} z {importProgress.total} skladeb
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
              Probíhá nahrávání na Firebase a extrakce textů. Prosím počkejte...
            </ThemedText>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal pro úpravu / editaci písně */}
      <Modal visible={showEditSongModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={{ flex: 1 }}>
          <AddSongForm
            initialSong={editingSong || undefined}
            isZpevnikPlus={repertoireTab === 'zpevnik_plus'}
            onSave={handleSaveSongUpdate}
            onDelete={editingSong ? () => handleDeleteSong(editingSong.id) : undefined}
            onCancel={() => {
              setShowEditSongModal(false);
              setEditingSong(null);
            }}
          />
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 4, paddingBottom: Spacing.six },
  sectionContainer: { marginTop: Spacing.two },
  liveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  circleAddBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.three },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  list: { gap: Spacing.two },
  songRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  sourcePickerModal: { width: '100%', padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three },
  progressModal: { width: '85%', padding: Spacing.four, borderRadius: Spacing.three, alignItems: 'center' },
  sourceModalOption: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.two },
  cancelModalBtn: { alignItems: 'center', paddingVertical: Spacing.two, marginTop: Spacing.one },
  miniSingerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniSingerBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(33,150,243,0.15)',
  },
});