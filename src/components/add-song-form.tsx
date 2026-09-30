import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Song, BandMember } from '@/types';
import { getBandMembers } from '@/services/firebaseService';
import { fixCzechDiacritics, capitalizeFirstLetter, hasVocalsInProfile, getMemberDisplayName } from '@/utils/diacritics';

interface Props {
  initialSong?: Song;
  isZpevnikPlus?: boolean;
  onSave: (song: Omit<Song, 'id'>) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B', 'H'];

const isChordName = (str: string): boolean => {
  if (!str) return false;
  const clean = str.trim();
  return /^([A-H][#b]?(m|mi|min|maj|dim|aug|sus|add|[0-9])*(?:\/[A-H][#b]?)?)$/i.test(clean);
};

export function AddSongForm({ initialSong, isZpevnikPlus = false, onSave, onDelete, onCancel }: Props) {
  const theme = useTheme();
  const { activeBand } = useAppStore();

  const [title, setTitle] = useState(initialSong?.title || '');
  const [artist, setArtist] = useState(initialSong?.artist || '');
  const [key, setKey] = useState(initialSong?.key || '');
  const [tempo, setTempo] = useState(initialSong?.tempo || '');
  const [duration, setDuration] = useState(initialSong?.duration || '');
  const [lyrics, setLyrics] = useState(initialSong?.lyrics || '');
  const [isLive, setIsLive] = useState<boolean>(initialSong?.isLive ?? true);
  const [isPreferred, setIsPreferred] = useState<boolean>(initialSong?.isPreferred ?? false);

  // Nové preference pro chytrý generátor setlistů
  const [isFirst, setIsFirst] = useState<boolean>(initialSong?.isFirst ?? false);
  const [isLast, setIsLast] = useState<boolean>(initialSong?.isLast ?? false);
  const [isEncore, setIsEncore] = useState<boolean>(initialSong?.isEncore ?? false);

  const [singers, setSingers] = useState<string[]>(initialSong?.singers || []);

  // Členové kapely pro výběr zpěváků
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);

  useEffect(() => {
    if (activeBand?.id) {
      getBandMembers(activeBand.id).then(m => setBandMembers(m)).catch(() => {});
    }
  }, [activeBand?.id]);

  // Pouze členové kapely, kteří mají v profilu zadaný zpěv/vokál
  const vocalMembers = bandMembers.filter(hasVocalsInProfile);
  const availableSingers = vocalMembers.length > 0 ? vocalMembers : bandMembers;

  // Celostránkový editor
  const [showFullScreenEditor, setShowFullScreenEditor] = useState(false);

  // Stav pro pokročilé vkládání a editaci akordů
  const [selectedRootNote, setSelectedRootNote] = useState('C');
  const editorSelectionRef = useRef({ start: 0, end: 0 });
  const [editorSelectionState, setEditorSelectionState] = useState({ start: 0, end: 0 });

  // Příloha / Soubor
  const [fileUri, setFileUri] = useState<string | null>(initialSong?.fileUri || null);
  const [fileName, setFileName] = useState<string | null>(initialSong?.fileName || null);
  const [fileSource, setFileSource] = useState<'local' | 'gdrive' | 'icloud'>(initialSong?.fileSource || 'local');

  // Generování variant akordů pro vybranou tóninu
  const getChordVariants = (root: string): string[] => {
    return [
      root,
      `${root}7`,
      `${root}mi`,
      `${root}m`,
      `${root}maj`,
      `${root}maj7`,
      `${root}6`,
      `${root}9`,
      `${root}sus`,
      `${root}sus4`,
      `${root}add9`,
      `${root}dim`,
      `${root}7/5+`,
      `${root}/G`,
      `${root}/E`,
    ];
  };

  // Sledování změny kurzoru
  const handleSelectionChange = (e: any) => {
    const sel = e.nativeEvent?.selection;
    if (sel) {
      editorSelectionRef.current = sel;
      setEditorSelectionState(sel);
    }
  };

  // Vložení akordu PŘESNĚ NA POZICI KURZORU v hranatých závorkách [Akord]
  const insertChordAtCursor = (chordName: string) => {
    const textToInsert = `[${chordName}]`;
    const start = editorSelectionRef.current.start ?? 0;
    const end = editorSelectionRef.current.end ?? start;

    const before = lyrics.substring(0, start);
    const after = lyrics.substring(end);

    const newText = before + textToInsert + after;
    setLyrics(newText);

    const newCursor = start + textToInsert.length;
    editorSelectionRef.current = { start: newCursor, end: newCursor };
    setEditorSelectionState({ start: newCursor, end: newCursor });
  };

  // Vyhledání akordu v hranatých závorkách na pozici kurzoru
  const findChordAtCursor = () => {
    if (!lyrics) return null;
    const pos = editorSelectionRef.current.start;
    const regex = /\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(lyrics)) !== null) {
      const start = match.index;
      const end = regex.lastIndex;
      if (pos >= start && pos <= end) {
        return {
          chordName: match[1],
          fullText: match[0],
          startPos: start,
          endPos: end,
        };
      }
    }
    return null;
  };

  const activeChordMatch = findChordAtCursor();

  // Smazat akord na pozici kurzoru
  const handleDeleteActiveChord = () => {
    if (!activeChordMatch) return;
    const before = lyrics.substring(0, activeChordMatch.startPos);
    const after = lyrics.substring(activeChordMatch.endPos);
    setLyrics(before + after);
    editorSelectionRef.current = { start: activeChordMatch.startPos, end: activeChordMatch.startPos };
    setEditorSelectionState({ start: activeChordMatch.startPos, end: activeChordMatch.startPos });
  };

  // Nahradit aktivní akord novým
  const handleReplaceActiveChord = (newChordName: string) => {
    if (!activeChordMatch) {
      insertChordAtCursor(newChordName);
      return;
    }
    const replacement = `[${newChordName}]`;
    const before = lyrics.substring(0, activeChordMatch.startPos);
    const after = lyrics.substring(activeChordMatch.endPos);
    setLyrics(before + replacement + after);
    const newPos = activeChordMatch.startPos + replacement.length;
    editorSelectionRef.current = { start: newPos, end: newPos };
    setEditorSelectionState({ start: newPos, end: newPos });
  };

  const handlePickDocument = async (source: 'local' | 'gdrive' | 'icloud') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.name);
        setFileSource(source);

        const lowerName = asset.name.toLowerCase();
        if (lowerName.endsWith('.txt') || lowerName.endsWith('.chordpro') || lowerName.endsWith('.pro')) {
          try {
            const resp = await fetch(asset.uri);
            const textContent = await resp.text();
            if (textContent && !lyrics) {
              setLyrics(fixCzechDiacritics(textContent));
            }
          } catch (err) {
            console.log("Nelze automaticky předvyplnit text ze souboru:", err);
          }
        }
      }
    } catch (e) {
      console.error("Nepodařilo se vybrat soubor:", e);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Chyba', 'Vyplňte prosím název písně.');
      return;
    }

    onSave({
      bandId: '',
      title: title.trim(),
      artist: artist.trim(),
      key: key.trim(),
      tempo: tempo.trim(),
      duration: duration.trim(),
      lyrics: lyrics.trim(),
      isLive: isZpevnikPlus ? true : isLive,
      isPreferred: isZpevnikPlus ? (initialSong ? isPreferred : false) : isPreferred,
      isFirst,
      isLast,
      isEncore,
      singers,
      fileUri: fileUri || undefined,
      fileName: fileName || undefined,
      fileSource,
    });
  };

  const handleOpenFullScreenEditor = () => {
    editorSelectionRef.current = { start: 0, end: 0 };
    setEditorSelectionState({ start: 0, end: 0 });
    setShowFullScreenEditor(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>
        {initialSong ? 'Upravit píseň' : 'Přidat novou píseň'}
      </ThemedText>

      {/* Název písně (povinné) */}
      <ThemedText type="smallBold">Název písně *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Např. Stánky, Jasná zpráva"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Interpret / Autor */}
      <ThemedText type="smallBold">Interpret / Autor</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={artist}
        onChangeText={setArtist}
        placeholder="Např. Bratři Nedvědové, Olympic"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Stav v repertoáru: Hrajeme / Nehrajeme & Preferované (Žluté srdíčko) */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>Stav a preference písničky</ThemedText>
      <View style={styles.liveToggleRow}>
        <Pressable
          style={[
            styles.liveToggleBtn,
            {
              backgroundColor: isLive ? 'rgba(76,175,80,0.2)' : 'rgba(200,200,200,0.18)',
              borderColor: isLive ? '#4caf50' : 'rgba(200,200,200,0.3)',
            }
          ]}
          onPress={() => setIsLive(true)}
        >
          <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={18} tintColor={isLive ? '#4caf50' : theme.textSecondary} />
          <ThemedText type="smallBold" style={{ marginLeft: 6, color: isLive ? '#4caf50' : theme.text, fontSize: 13 }}>
            Hrajeme
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.liveToggleBtn,
            {
              backgroundColor: !isLive ? 'rgba(233,30,99,0.2)' : 'rgba(200,200,200,0.18)',
              borderColor: !isLive ? '#e91e63' : 'rgba(200,200,200,0.3)',
            }
          ]}
          onPress={() => setIsLive(false)}
        >
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} tintColor={!isLive ? '#e91e63' : theme.textSecondary} />
          <ThemedText type="smallBold" style={{ marginLeft: 6, color: !isLive ? '#e91e63' : theme.text, fontSize: 13 }}>
            Nehrajeme
          </ThemedText>
        </Pressable>

        {/* Preferované (Žluté srdíčko) */}
        <Pressable
          style={[
            styles.liveToggleBtn,
            {
              backgroundColor: isPreferred ? 'rgba(255,193,7,0.2)' : 'rgba(200,200,200,0.18)',
              borderColor: isPreferred ? '#ffc107' : 'rgba(200,200,200,0.3)',
            }
          ]}
          onPress={() => setIsPreferred(!isPreferred)}
        >
          <SymbolView
            name={{ ios: isPreferred ? 'heart.fill' : 'heart', android: isPreferred ? 'favorite' : 'favorite_border', web: isPreferred ? 'favorite' : 'favorite_border' }}
            size={18}
            tintColor={isPreferred ? '#ffc107' : theme.textSecondary}
          />
          <ThemedText type="smallBold" style={{ marginLeft: 6, color: isPreferred ? '#ffc107' : theme.text, fontSize: 13 }}>
            Preferovaná
          </ThemedText>
        </Pressable>
      </View>

      {/* Detailní preference pro Chytrý generátor setlistů (Otvírák, Zavírák, Přídavek) */}
      <View style={{ marginTop: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two, backgroundColor: 'rgba(200,200,200,0.1)' }}>
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Setlist pozice</ThemedText>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="default" style={{ fontWeight: 'bold' }}>První (Otvírák)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Hodí se na začátek koncertu</ThemedText>
          </View>
          <Switch value={isFirst} onValueChange={setIsFirst} trackColor={{ false: 'rgba(150,150,150,0.3)', true: '#4caf50' }} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="default" style={{ fontWeight: 'bold' }}>Poslední (Finále)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Hodí se na úplný konec série</ThemedText>
          </View>
          <Switch value={isLast} onValueChange={setIsLast} trackColor={{ false: 'rgba(150,150,150,0.3)', true: '#4caf50' }} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="default" style={{ fontWeight: 'bold' }}>Přídavek (Encore)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Vyžadované hity po vytleskání</ThemedText>
          </View>
          <Switch value={isEncore} onValueChange={setIsEncore} trackColor={{ false: 'rgba(150,150,150,0.3)', true: '#4caf50' }} />
        </View>
      </View>

      {/* Zpívá - Členové kapely se zpěvem v profilu */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Zpívá (Členové kapely s vokály)</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.one, marginBottom: Spacing.two, alignItems: 'center' }}>
        {availableSingers.length > 0 ? (
          availableSingers.map(m => {
            const rawName = getMemberDisplayName(m);
            const singerName = capitalizeFirstLetter(rawName);
            const isSelected = singers.some(s => s === rawName || s === singerName || s === m.id || s === m.nickname || s === m.firstName);

            return (
              <Pressable
                key={m.id}
                style={[
                  styles.singerChip,
                  {
                    backgroundColor: isSelected ? 'rgba(33,150,243,0.25)' : 'rgba(200,200,200,0.18)',
                    borderColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.3)',
                  }
                ]}
                onPress={() => {
                  if (isSelected) {
                    setSingers(prev => prev.filter(s => s !== rawName && s !== singerName && s !== m.id && s !== m.nickname && s !== m.firstName));
                  } else {
                    setSingers(prev => [...prev, rawName]);
                  }
                }}
              >
                <SymbolView name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }} size={14} tintColor={isSelected ? '#2196f3' : theme.textSecondary} />
                <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 4, color: isSelected ? '#2196f3' : theme.text }}>
                  {singerName}
                </ThemedText>
              </Pressable>
            );
          })
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Žádný člen kapely nemá v profilu zadaný zpěv.
          </ThemedText>
        )}
      </View>

      {/* Tónina, Tempo, Délka v řádku vedle sebe */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Tónina</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            value={key}
            onChangeText={setKey}
            placeholder="C dur"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Tempo (BPM)</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            value={tempo}
            onChangeText={setTempo}
            placeholder="120 BPM"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Délka</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            value={duration}
            onChangeText={setDuration}
            placeholder="3:45"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Výběr přílohy (z Disku / Google Disk pro Android, z Disku / iCloud pro iOS) */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Přiložit soubor (MP3, PDF, noty)</ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.two }}>
        <Pressable
          style={[styles.sourceBtn, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
          onPress={() => handlePickDocument('local')}
        >
          <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={16} tintColor={theme.text} />
          <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 4 }}>Z disku</ThemedText>
        </Pressable>

        {Platform.OS === 'android' ? (
          <Pressable
            style={[styles.sourceBtn, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => handlePickDocument('gdrive')}
          >
            <SymbolView name={{ ios: 'cloud', android: 'cloud', web: 'cloud' }} size={16} tintColor="#2196f3" />
            <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 4 }}>Google Disk</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sourceBtn, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            onPress={() => handlePickDocument('icloud')}
          >
            <SymbolView name={{ ios: 'icloud', android: 'cloud', web: 'cloud' }} size={16} tintColor="#2196f3" />
            <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 4 }}>iCloud Drive</ThemedText>
          </Pressable>
        )}
      </View>

      {fileName && (
        <View style={styles.attachedFileBox}>
          <SymbolView name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }} size={18} tintColor="#4caf50" />
          <ThemedText type="smallBold" style={{ flex: 1, marginLeft: 6, color: '#4caf50' }} numberOfLines={1}>
            Připojeno: {fileName}
          </ThemedText>
          <Pressable onPress={() => { setFileUri(null); setFileName(null); }}>
            <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} tintColor={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Text / Akordy s hlavičkou pro otevření na celou obrazovku */}
      <View style={styles.lyricsHeaderRow}>
        <ThemedText type="smallBold">Text písně a akordy</ThemedText>

        <Pressable
          style={[styles.fullScreenBtn, { backgroundColor: 'rgba(200,200,200,0.2)' }]}
          onPress={handleOpenFullScreenEditor}
        >
          <SymbolView name={{ ios: 'arrow.up.left.and.arrow.down.right', android: 'fullscreen', web: 'fullscreen' }} size={14} tintColor={theme.text} />
          <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 4 }}>Celá obrazovka</ThemedText>
        </Pressable>
      </View>

      <TextInput
        style={[styles.input, styles.multilineInput, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={lyrics}
        onChangeText={setLyrics}
        onSelectionChange={handleSelectionChange}
        placeholder="Vložte text písně, slova nebo akordy..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={6}
      />

      {/* Akční tlačítka v jedné řádce */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: theme.text }}>Zrušit</ThemedText>
        </Pressable>
        {initialSong && onDelete && (
          <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onDelete}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>Smazat píseň</ThemedText>
          </Pressable>
        )}
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Uložit
          </ThemedText>
        </Pressable>
      </View>

      {/* Modal - Celostránkový editor textu a akordů */}
      <Modal visible={showFullScreenEditor} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.background }]}>
          {/* Lišta celostránkového editoru */}
          <View style={[styles.fullScreenHeader, { borderBottomColor: 'rgba(200,200,200,0.2)' }]}>
            <ThemedText type="subtitle" style={{ fontSize: 18 }} numberOfLines={1}>
              Editor {title ? `- ${title}` : ''}
            </ThemedText>

            <Pressable
              style={styles.doneBtn}
              onPress={() => setShowFullScreenEditor(false)}
            >
              <ThemedText type="smallBold" style={{ color: '#fff' }}>Hotovo</ThemedText>
            </Pressable>
          </View>

          {/* Rychlá lišta pro pokročilé vkládání a výběr akordů */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(200,200,200,0.15)' }}>
            {/* 1. Řádek: Výběr základního tónu akordu (C, C#, D, D#...) */}
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.quickChordsBar} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginRight: 2, fontSize: 11 }}>Tón:</ThemedText>
              {ROOT_NOTES.map(root => (
                <Pressable
                  key={root}
                  style={[
                    styles.rootNoteBtn,
                    { backgroundColor: selectedRootNote === root ? '#2196f3' : 'rgba(200,200,200,0.2)' }
                  ]}
                  onPress={() => setSelectedRootNote(root)}
                >
                  <ThemedText type="smallBold" style={{ color: selectedRootNote === root ? '#fff' : theme.text, fontSize: 12 }}>
                    {root}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {/* 2. Řádek: Varianty akordů pro vybraný tón (C, C7, Cmi, Cmaj, Cmaj7, C6, Csus...) */}
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={[styles.quickChordsBar, { backgroundColor: 'rgba(255,193,7,0.12)' }]} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginRight: 2, fontSize: 11 }}>Vložit:</ThemedText>
              {getChordVariants(selectedRootNote).map(chord => (
                <Pressable
                  key={chord}
                  style={styles.quickChordBtn}
                  onPress={() => {
                    if (activeChordMatch) {
                      handleReplaceActiveChord(chord);
                    } else {
                      insertChordAtCursor(chord);
                    }
                  }}
                >
                  <ThemedText type="smallBold" style={{ color: '#000', fontSize: 12 }}>[{chord}]</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {/* 3. Řádek: Akce pro vybraný akord v závorkách na pozici kurzoru (Změnit / Smazat) */}
            {activeChordMatch && (
              <View style={styles.activeChordActionBar}>
                <ThemedText type="smallBold" style={{ color: '#ffc107', fontSize: 13 }}>
                  Vybrán akord [{activeChordMatch.chordName}]
                </ThemedText>

                <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
                  <Pressable
                    style={[styles.editorActionBtn, { backgroundColor: '#e91e63', paddingVertical: 4, paddingHorizontal: 10 }]}
                    onPress={handleDeleteActiveChord}
                  >
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>Smazat [{activeChordMatch.chordName}]</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* TextInput přes celou obrazovku */}
          <TextInput
            style={[
              styles.fullScreenInput,
              {
                color: theme.text,
                backgroundColor: theme.background,
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              }
            ]}
            value={lyrics}
            onChangeText={setLyrics}
            onSelectionChange={handleSelectionChange}
            placeholder="Zde napište nebo vložte text písně s akordy v hranatých závorkách [C]..."
            placeholderTextColor={theme.textSecondary}
            multiline
            autoFocus
          />
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six * 2 },
  title: { marginBottom: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  liveToggleRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.two },
  liveToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  singerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  attachedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
    marginBottom: Spacing.two,
  },
  lyricsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  fullScreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    fontSize: 16,
  },
  multilineInput: { height: 120, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenContainer: { flex: 1 },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  doneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#4caf50',
    borderRadius: Spacing.two,
  },
  quickChordsBar: {
    maxHeight: 40,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(200,200,200,0.12)',
  },
  rootNoteBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  quickChordBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#ffc107',
    borderRadius: 6,
  },
  activeChordActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,193,7,0.18)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,193,7,0.3)',
  },
  editorActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Spacing.two,
  },
  fullScreenInput: {
    flex: 1,
    padding: Spacing.four,
    fontSize: 18,
    lineHeight: 26,
    textAlignVertical: 'top',
  },
});