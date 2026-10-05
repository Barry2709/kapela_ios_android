import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Modal, TextInput, Alert, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Song } from '@/types';
import { fixCzechDiacritics, capitalizeFirstLetter } from '@/utils/diacritics';
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from 'expo-audio';
import { updateSong, fetchSongTextFromStorage, subscribeToSong, addAudioRecord, uploadAudioToStorage } from '@/services/firebaseService';
import { getPersonalSongSetting, savePersonalSongSetting, PersonalNote } from '@/utils/personalSongSettings';
import { liveSyncService } from '@/services/liveSyncService';
import { FloatingNoteItem } from './floating-note-item';

interface Props {
  songs: Song[];
  initialIndex: number;
  onClose: () => void;
  onUpdateSong?: (songId: string, updates: Partial<Song>) => void;
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'H'];

const isChordName = (str: string): boolean => {
  if (!str) return false;
  const clean = str.trim();
  return /^([A-H][#b]?(m|mi|min|maj|dim|aug|sus|add|[0-9])*(?:\/[A-H][#b]?)?)$/i.test(clean);
};

interface LyricSegment {
  chord?: string;
  comment?: string;
  text: string;
}

const parseChordProLine = (line: string): LyricSegment[] => {
  const segments: LyricSegment[] = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let currentChord: string | undefined = undefined;
  let currentComment: string | undefined = undefined;

  let match;
  while ((match = regex.exec(line)) !== null) {
    const textBefore = line.slice(lastIndex, match.index);
    const content = match[1];

    if (isChordName(content)) {
      if (textBefore.length > 0 || currentChord !== undefined || currentComment !== undefined || segments.length === 0) {
        segments.push({ chord: currentChord, comment: currentComment, text: textBefore });
      }
      currentChord = content;
      currentComment = undefined;
      lastIndex = regex.lastIndex;
    } else {
      if (textBefore.length > 0 || currentChord !== undefined || currentComment !== undefined || segments.length === 0) {
        segments.push({ chord: currentChord, comment: currentComment, text: textBefore });
      }
      currentChord = undefined;
      currentComment = `[${content}]`;
      lastIndex = regex.lastIndex;
    }
  }

  const remainingText = line.slice(lastIndex);
  segments.push({ chord: currentChord, comment: currentComment, text: remainingText });

  return segments;
};

export function SongLyricsViewer({ songs: initialSongs, initialIndex, onClose, onUpdateSong }: Props) {
  const theme = useTheme();
  const { currentUser, activeBand, activeRoleView } = useAppStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const fullScreenInputRef = useRef<TextInput>(null);

  // Unikátní identifikátor člena/uživatele pro osobní nastavení
  const currentUserId = currentUser?.uid || currentUser?.email || activeRoleView || 'local_user';

  const [songsList, setSongsList] = useState<Song[]>(initialSongs);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0); // Osobní Capo člena (0 až 12)
  const [fontSize, setFontSize] = useState(18);
  const [isInverted, setIsInverted] = useState(false);

  // Stav pro osobní poznámky k písni
  const [personalNotes, setPersonalNotes] = useState<PersonalNote[]>([]);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showEditNoteModal, setShowEditNoteModal] = useState(false);
  const [showNoteActionsModal, setShowNoteActionsModal] = useState(false);
  const [pendingNoteCoords, setPendingNoteCoords] = useState<{ xPercent: number, yPx: number } | null>(null);
  const [selectedNoteForAction, setSelectedNoteForAction] = useState<PersonalNote | null>(null);
  const [noteInputText, setNoteInputText] = useState('');
  const [isNoteAdminShared, setIsNoteAdminShared] = useState(false);

  // Zjistíme, zda je výchozí téma aplikace tmavé
  const isThemeDark = theme.text === '#ffffff' || theme.background === '#000000' || theme.background === '#121212';

  // Pokud je aktivní inverze barev, obrátíme pozadí a text
  const effectiveBgColor = isInverted
    ? (isThemeDark ? '#ffffff' : '#000000')
    : theme.background;

  const effectiveTextColor = isInverted
    ? (isThemeDark ? '#000000' : '#ffffff')
    : theme.text;

  // Live Režim stav
  const [isLiveActive, setIsLiveActive] = useState(false);

  useEffect(() => {
    if (!activeBand?.id) return;
    const unsubscribe = liveSyncService.startListening(activeBand.id, (payload) => {
      if (payload?.isActive && payload?.activeSongId) {
        setIsLiveActive(true);

        // Zjistíme, zda relaci vysílá toto konkrétní zařízení
        let isSelfAdmin = false;
        if (payload.deviceId) {
          isSelfAdmin = payload.deviceId === liveSyncService.deviceId;
        } else {
          isSelfAdmin = !!(payload.adminUid && payload.adminUid === currentUser?.uid && activeRoleView === 'admin');
        }

        if (!isSelfAdmin) {
          const idx = songsList.findIndex(s => s.id === payload.activeSongId);
          if (idx !== -1 && idx !== currentIndex) {
            setCurrentIndex(idx);
            currentScrollY.current = 0;
            scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          }
        }
      } else {
        setIsLiveActive(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeBand?.id, songsList, activeRoleView, currentIndex]);

  const broadcastCurrentSong = (newIndex: number) => {
    const targetSong = songsList[newIndex];
    if (activeRoleView === 'admin' && activeBand?.id && targetSong && isLiveActive) {
      liveSyncService.broadcastSongChange(
        activeBand.id,
        currentUser?.uid || 'admin',
        currentUser?.displayName || 'Kapelník',
        targetSong.id,
        transpose
      );
    }
  };

  // Auto-fit (přizpůsobení velikosti textu obrazovce)
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Auto-scroll stav
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const currentScrollY = useRef(0);

  // Celostránková editace textu přímo z prohlížeče
  const [showLyricsEditorModal, setShowLyricsEditorModal] = useState(false);
  const [editingLyricsText, setEditingLyricsText] = useState('');

  // Stav pro pokročilé vkládání a editaci akordů v editoru (sledování kurzoru přes useRef)
  const [selectedRootNote, setSelectedRootNote] = useState('C');
  const editorSelectionRef = useRef({ start: 0, end: 0 });
  const [editorSelectionState, setEditorSelectionState] = useState({ start: 0, end: 0 });

  const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B', 'H'];

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

  useEffect(() => {
    setSongsList(initialSongs);
  }, [initialSongs]);

  const currentSong = songsList[currentIndex] || songsList[0];

  // Reálná synchronizace písně (při úpravě textu nebo Admin poznámek na Firebase se ihned překreslí)
  useEffect(() => {
    if (!activeBand?.id || !currentSong?.id) return;

    const unsubscribe = subscribeToSong(activeBand.id, currentSong.id, (freshSong) => {
      if (freshSong) {
        setSongsList(prev => prev.map(s => s.id === freshSong.id ? { ...s, ...freshSong } : s));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeBand?.id, currentSong?.id]);

  // Načtení OSOBNÍHO nastavení člena (Capo, Tónina, Písmo, Inverze, Poznámky) pro konkrétní skladbu
  useEffect(() => {
    let isMounted = true;
    if (activeBand && currentSong?.id) {
      getPersonalSongSetting(currentUserId, activeBand.id, currentSong.id).then(setting => {
        if (!isMounted) return;
        if (setting) {
          if (setting.transpose !== undefined) setTranspose(setting.transpose);
          if (setting.capo !== undefined) setCapo(setting.capo);
          if (setting.fontSize !== undefined) setFontSize(setting.fontSize);
          if (setting.isInverted !== undefined) setIsInverted(setting.isInverted);
          if (setting.notes !== undefined) setPersonalNotes(setting.notes);
          else setPersonalNotes([]);
        } else {
          setTranspose(0);
          setCapo(0);
          setFontSize(18);
          setIsInverted(false);
          setPersonalNotes([]);
        }
      });
    }
    return () => { isMounted = false; };
  }, [currentIndex, currentSong?.id, currentUserId, activeBand?.id]);

  // Pomocná funkce pro uložení osobního nastavení člena
  const updatePersonalSetting = (
    newTranspose: number,
    newCapo: number,
    newFontSize: number,
    newInverted: boolean = isInverted,
    newNotes: PersonalNote[] = personalNotes
  ) => {
    if (activeBand && currentSong?.id) {
      savePersonalSongSetting(currentUserId, activeBand.id, currentSong.id, {
        transpose: newTranspose,
        capo: newCapo,
        fontSize: newFontSize,
        isInverted: newInverted,
        notes: newNotes,
      });
    }
  };

  const savePersonalNotesSetting = (newNotes: PersonalNote[]) => {
    setPersonalNotes(newNotes);
    updatePersonalSetting(transpose, capo, fontSize, isInverted, newNotes);
  };

  // Sloučení Admin poznámek (z písně na Firebase) a Osobních poznámek člena s podporou osobního přemístění
  const effectiveNotes: PersonalNote[] = useMemo(() => {
    const bandAdminNotes = currentSong?.adminNotes || [];

    return [
      ...bandAdminNotes.map(aNote => {
        // Pokud si člen přenastavil pozici Admin poznámky na svém zařízení, použijeme jeho pozici
        const personalOverride = personalNotes.find(p => p.id === aNote.id);
        if (personalOverride) {
          return {
            ...aNote,
            xPercent: personalOverride.xPercent,
            yPx: personalOverride.yPx,
          };
        }
        return aNote;
      }),
      ...personalNotes.filter(pNote => !pNote.isAdminNote && !bandAdminNotes.some(a => a.id === pNote.id))
    ];
  }, [currentSong?.adminNotes, personalNotes]);

  const handleLyricsLongPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const cWidth = containerWidth > 0 ? containerWidth : Dimensions.get('window').width;
    const xPercent = Math.max(0, Math.min(85, (locationX / cWidth) * 100));

    setPendingNoteCoords({ xPercent, yPx: locationY });
    setNoteInputText('');
    setIsNoteAdminShared(false);
    setShowAddNoteModal(true);
  };

  const handleSaveNewNote = async () => {
    if (!noteInputText.trim() || !pendingNoteCoords) return;
    const newNote: PersonalNote = {
      id: `note_${Date.now()}`,
      text: noteInputText.trim(),
      xPercent: pendingNoteCoords.xPercent,
      yPx: pendingNoteCoords.yPx,
      createdAt: Date.now(),
      isAdminNote: isNoteAdminShared && activeRoleView === 'admin',
    };

    if (isNoteAdminShared && activeRoleView === 'admin' && currentSong?.id) {
      const updatedAdminNotes = [...(currentSong.adminNotes || []), newNote];
      onUpdateSong?.(currentSong.id, { adminNotes: updatedAdminNotes });
      setSongsList(prev => prev.map(s => s.id === currentSong.id ? { ...s, adminNotes: updatedAdminNotes } : s));
    } else {
      const updated = [...personalNotes, newNote];
      savePersonalNotesSetting(updated);
    }

    setShowAddNoteModal(false);
    setPendingNoteCoords(null);
    setNoteInputText('');
    setIsNoteAdminShared(false);
  };

  const handleNoteDragEnd = (noteId: string, newXPercent: number, newYPx: number) => {
    const existingIndex = personalNotes.findIndex(n => n.id === noteId);
    let updated: PersonalNote[];
    if (existingIndex !== -1) {
      updated = personalNotes.map(n => n.id === noteId ? { ...n, xPercent: newXPercent, yPx: newYPx } : n);
    } else {
      const noteToOverride = effectiveNotes.find(n => n.id === noteId);
      if (noteToOverride) {
        updated = [...personalNotes, { ...noteToOverride, xPercent: newXPercent, yPx: newYPx }];
      } else {
        updated = personalNotes;
      }
    }
    savePersonalNotesSetting(updated);
  };

  const handleNoteTap = (note: PersonalNote) => {
    setSelectedNoteForAction(note);
    setShowNoteActionsModal(true);
  };

  const handleDeleteSelectedNote = async () => {
    if (!selectedNoteForAction) return;

    if (selectedNoteForAction.isAdminNote && activeRoleView === 'admin' && currentSong?.id) {
      const updatedAdminNotes = (currentSong.adminNotes || []).filter(n => n.id !== selectedNoteForAction.id);
      onUpdateSong?.(currentSong.id, { adminNotes: updatedAdminNotes });
      setSongsList(prev => prev.map(s => s.id === currentSong.id ? { ...s, adminNotes: updatedAdminNotes } : s));
    }

    const updatedPersonal = personalNotes.filter(n => n.id !== selectedNoteForAction.id);
    savePersonalNotesSetting(updatedPersonal);

    setShowNoteActionsModal(false);
    setSelectedNoteForAction(null);
  };

  const handleOpenEditSelectedNote = () => {
    if (!selectedNoteForAction) return;
    setNoteInputText(selectedNoteForAction.text);
    setIsNoteAdminShared(!!selectedNoteForAction.isAdminNote);
    setShowNoteActionsModal(false);
    setShowEditNoteModal(true);
  };

  const handleSaveEditedNote = async () => {
    if (!selectedNoteForAction || !noteInputText.trim()) return;

    if (selectedNoteForAction.isAdminNote && activeRoleView === 'admin' && currentSong?.id) {
      const updatedAdminNotes = (currentSong.adminNotes || []).map(n =>
        n.id === selectedNoteForAction.id ? { ...n, text: noteInputText.trim() } : n
      );
      onUpdateSong?.(currentSong.id, { adminNotes: updatedAdminNotes });
      setSongsList(prev => prev.map(s => s.id === currentSong.id ? { ...s, adminNotes: updatedAdminNotes } : s));
    } else {
      const updated = personalNotes.map(n =>
        n.id === selectedNoteForAction.id ? { ...n, text: noteInputText.trim() } : n
      );
      savePersonalNotesSetting(updated);
    }

    setShowEditNoteModal(false);
    setSelectedNoteForAction(null);
    setNoteInputText('');
    setIsNoteAdminShared(false);
  };

  const handleTransposeChange = (newVal: number) => {
    setTranspose(newVal);
    updatePersonalSetting(newVal, capo, fontSize);
  };

  const handleCapoChange = (newVal: number) => {
    setCapo(newVal);
    updatePersonalSetting(transpose, newVal, fontSize);
  };

  const handleFontSizeChange = (newVal: number) => {
    setFontSize(newVal);
    updatePersonalSetting(transpose, capo, newVal);
  };

  const [isPinching, setIsPinching] = useState(false);

  // Gesto plynulého pinch-to-zoom (zvětšení/zmenšení přes Animated scale pro 60 FPS plynulost)
  const pinchScale = useRef(new Animated.Value(1)).current;
  const currentScaleRef = useRef(1);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialFontSizeRef = useRef<number>(fontSize);

  const getTouchesDistance = (touches: any[]) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches && touches.length === 2) {
      const dist = getTouchesDistance(touches);
      if (dist > 10) {
        initialPinchDistanceRef.current = dist;
        initialFontSizeRef.current = fontSize;
        currentScaleRef.current = 1;
        setIsPinching(true);
      }
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches && touches.length === 2 && initialPinchDistanceRef.current && initialPinchDistanceRef.current > 0) {
      const currentDist = getTouchesDistance(touches);
      const scale = currentDist / initialPinchDistanceRef.current;
      currentScaleRef.current = scale;
      pinchScale.setValue(scale);
    }
  };

  const handleTouchEnd = () => {
    if (initialPinchDistanceRef.current !== null) {
      const finalScale = currentScaleRef.current;
      initialPinchDistanceRef.current = null;

      const newFontSize = Math.max(8, Math.min(48, Math.round(initialFontSizeRef.current * finalScale)));
      pinchScale.setValue(1);
      currentScaleRef.current = 1;
      setIsPinching(false);

      if (newFontSize !== fontSize) {
        setFontSize(newFontSize);
        updatePersonalSetting(transpose, capo, newFontSize, isInverted);
      }
    }
  };

  // Načtení čerstvého textu z Firebase Storage při otevření skladby (s fallbackem na Firestore)
  useEffect(() => {
    let isMounted = true;
    if (activeBand && currentSong) {
      fetchSongTextFromStorage(activeBand.id, currentSong).then(result => {
        if (!isMounted) return;

        if (result.text && result.text.trim().length > 0 && result.text !== currentSong.lyrics) {
          setSongsList(prev => prev.map(s => s.id === currentSong.id ? { ...s, lyrics: result.text } : s));
        }
      }).catch((err) => {
        console.log("Chyba při synchronizaci textu ze Storage:", err);
      });
    }
    return () => { isMounted = false; };
  }, [currentIndex, currentSong?.id]);

  // Efektivní transpozice zobrazených akordů s započítáním Capo: (transpose - capo)
  const effectiveSteps = transpose - capo;

  // Přesný matematický výpočet velikosti písma beroucí v úvahu i zalamování dlouhých řádků na úzkém displeji!
  const calculateAutoFitFontSize = (lyricsText: string, height: number): number => {
    if (!lyricsText || height <= 0) return 18;

    const cleanText = fixCzechDiacritics(lyricsText);
    const lines = cleanText.split('\n');

    let plainLines = 0;
    let chordLines = 0;
    let emptyLines = 0;

    for (const line of lines) {
      if (!line.trim()) {
        emptyLines++;
      } else {
        const lineWrapFactor = line.length > 80 ? 2.2 : line.length > 45 ? 1.5 : 1.0;

        const hasBrackets = line.includes('[') && line.includes(']');
        if (hasBrackets) {
          const matches = line.match(/\[([^\]]+)\]/g);
          if (matches?.some(m => isChordName(m.slice(1, -1)))) {
            chordLines += lineWrapFactor;
          } else {
            plainLines += lineWrapFactor;
          }
        } else {
          plainLines += lineWrapFactor;
        }
      }
    }

    const usableHeight = Math.max(80, height - 4);
    const fixedPadding = (plainLines * 2) + (chordLines * 4);
    const fontMultiplier = (plainLines * 1.45) + (chordLines * 2.45) + (emptyLines * 0.75);

    if (fontMultiplier <= 0) return 18;

    const availableForFont = Math.max(40, usableHeight - fixedPadding);
    const computedSize = Math.floor(availableForFont / fontMultiplier);

    return Math.max(3, Math.min(36, computedSize));
  };

  // Jednorázové přizpůsobení velikosti písma obrazovce (stisknutí tlačítka)
  const handleApplyAutoFit = () => {
    if (currentSong?.lyrics) {
      const heightToUse = containerHeight > 0 ? containerHeight : (Dimensions.get('window').height - 120);
      const fitSize = calculateAutoFitFontSize(currentSong.lyrics, heightToUse);
      setFontSize(fitSize);
      updatePersonalSetting(transpose, capo, fitSize);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Auto-scroll smyčka
  useEffect(() => {
    let interval: any = null;
    if (isAutoScrolling) {
      interval = setInterval(() => {
        if (scrollViewRef.current) {
          currentScrollY.current += scrollSpeed;
          scrollViewRef.current.scrollTo({ y: currentScrollY.current, animated: true });
        }
      }, 50);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoScrolling, scrollSpeed]);

  // Transpozice jednoho akordu
  const transposeSingleChord = (chordStr: string, steps: number): string => {
    if (!chordStr || steps === 0) return chordStr;

    if (chordStr.includes('/')) {
      const parts = chordStr.split('/');
      return `${transposeSingleChord(parts[0], steps)}/${transposeSingleChord(parts[1], steps)}`;
    }

    const match = chordStr.match(/^([A-H][#b]?)(.*)$/i);
    if (!match) return chordStr;

    let root = match[1];
    const suffix = match[2];

    root = root.charAt(0).toUpperCase() + root.slice(1);

    let index = SHARPS.indexOf(root);
    if (index === -1) index = FLATS.indexOf(root);
    if (index === -1) return chordStr;

    let newIndex = (index + steps) % 12;
    if (newIndex < 0) newIndex += 12;

    return SHARPS[newIndex] + suffix;
  };

  // Formátování zobrazení tóniny (zobrazuje čistě písmeno např. C, D, Ami, C#)
  const formatKeyString = (keyStr: string, steps: number): string => {
    if (!keyStr) return '';
    const clean = keyStr.trim();
    const transposed = transposeSingleChord(clean, steps);
    return transposed.replace(/\s*dur/gi, '').trim();
  };

  // Získání tóniny jako akordového písmena pro ovládací lištu (např. C, C#, D, Ami)
  const getFirstKey = (song: Song | undefined, steps: number): string => {
    if (!song) return steps > 0 ? `+${steps}` : `${steps}`;
    if (song.key && song.key.trim().length > 0) {
      return formatKeyString(song.key, steps);
    }
    if (song.lyrics) {
      const match = song.lyrics.match(/\[([^\]]+)\]/);
      if (match && isChordName(match[1])) {
        return formatKeyString(match[1], steps);
      }
    }
    return steps > 0 ? `+${steps}` : `${steps}`;
  };

  // Bezpečné nastavení pozice kurzoru pro mobilní zařízení i Web
  const safeSetSelection = (inputRef: React.RefObject<TextInput | null>, start: number, end: number) => {
    if (!inputRef.current) return;
    try {
      const node = inputRef.current as any;
      if (typeof node.setSelection === 'function') {
        node.setSelection(start, end);
      } else if (typeof node.setSelectionRange === 'function') {
        node.setSelectionRange(start, end);
      }
    } catch (e) {}
  };

  // Otevření celostránkového editoru - ZOBRAZÍ A OTEVŘE HNED NA 1. ŘÁDKU (start = 0)!
  const openDirectLyricsEditor = () => {
    if (currentSong) {
      const lyr = currentSong.lyrics || '';
      setEditingLyricsText(lyr);
      editorSelectionRef.current = { start: 0, end: 0 };
      setEditorSelectionState({ start: 0, end: 0 });
      setShowLyricsEditorModal(true);

      setTimeout(() => {
        fullScreenInputRef.current?.focus();
        safeSetSelection(fullScreenInputRef, 0, 0);
      }, 100);
    }
  };

  // Uložení celostránkových úprav textu (pouze 1 synchronní zápis pro zamezení souběhu)
  const handleSaveLyricsDirectly = async () => {
    if (!currentSong || !activeBand) return;

    const newLyrics = editingLyricsText.trim();
    const updatedSong: Song = {
      ...currentSong,
      lyrics: newLyrics,
    };

    setSongsList(prev => prev.map(s => s.id === currentSong.id ? updatedSong : s));
    setShowLyricsEditorModal(false);

    try {
      if (onUpdateSong) {
        await onUpdateSong(currentSong.id, { lyrics: newLyrics });
      } else {
        await updateSong(activeBand.id, currentSong.id, { lyrics: newLyrics });
      }
    } catch (e) {
      console.error("Chyba při ukládání textu na Firebase:", e);
    }
  };

  // Zahodit změny
  const handleDiscardLyricsChanges = () => {
    setShowLyricsEditorModal(false);
  };

  // Sledování změny kurzoru v editoru
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

    const before = editingLyricsText.substring(0, start);
    const after = editingLyricsText.substring(end);

    const newText = before + textToInsert + after;
    setEditingLyricsText(newText);

    const newCursor = start + textToInsert.length;
    editorSelectionRef.current = { start: newCursor, end: newCursor };
    setEditorSelectionState({ start: newCursor, end: newCursor });

    // Okamžité nastavení nového kurzoru za vložený akord
    setTimeout(() => {
      fullScreenInputRef.current?.focus();
      safeSetSelection(fullScreenInputRef, newCursor, newCursor);
    }, 50);
  };

  // Vyhledání akordu v hranatých závorkách na pozici kurzoru
  const findChordAtCursor = () => {
    if (!editingLyricsText) return null;
    const pos = editorSelectionRef.current.start;
    const regex = /\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(editingLyricsText)) !== null) {
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
    const before = editingLyricsText.substring(0, activeChordMatch.startPos);
    const after = editingLyricsText.substring(activeChordMatch.endPos);
    setEditingLyricsText(before + after);
    const newPos = activeChordMatch.startPos;
    editorSelectionRef.current = { start: newPos, end: newPos };
    setEditorSelectionState({ start: newPos, end: newPos });

    setTimeout(() => {
      fullScreenInputRef.current?.focus();
      safeSetSelection(fullScreenInputRef, newPos, newPos);
    }, 50);
  };

  // Nahradit aktivní akord novým
  const handleReplaceActiveChord = (newChordName: string) => {
    if (!activeChordMatch) {
      insertChordAtCursor(newChordName);
      return;
    }
    const replacement = `[${newChordName}]`;
    const before = editingLyricsText.substring(0, activeChordMatch.startPos);
    const after = editingLyricsText.substring(activeChordMatch.endPos);
    setEditingLyricsText(before + replacement + after);
    const newPos = activeChordMatch.startPos + replacement.length;
    editorSelectionRef.current = { start: newPos, end: newPos };
    setEditorSelectionState({ start: newPos, end: newPos });

    setTimeout(() => {
      fullScreenInputRef.current?.focus();
      safeSetSelection(fullScreenInputRef, newPos, newPos);
    }, 50);
  };

  // Formátování řádků textu s akordy s započítáním transpozice i Capo
  const renderFormattedLyrics = (rawText: string) => {
    if (!rawText) return null;
    const cleanText = fixCzechDiacritics(rawText);
    const lines = cleanText.split('\n');

    return lines.map((line, lIdx) => {
      // Prázdný řádek
      if (!line.trim()) {
        return <View key={lIdx} style={{ height: fontSize * 0.8 }} />;
      }

      // Kontrola řádku s akordy v hranatých závorkách [...]
      const hasBrackets = line.includes('[') && line.includes(']');

      if (hasBrackets) {
        const bracketMatches = line.match(/\[([^\]]+)\]/g);
        const hasValidChords = bracketMatches?.some(m => isChordName(m.slice(1, -1)));

        if (hasValidChords) {
          const segments = parseChordProLine(line);
          const hasAnyChordInLine = segments.some(s => s.chord !== undefined);

          return (
            <View key={lIdx} style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 2, alignItems: 'flex-end' }}>
              {segments.map((seg, sIdx) => (
                <View key={sIdx} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  {hasAnyChordInLine && (
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: '#f44336', // Akordy ČERVENĚ
                        fontSize: fontSize * 0.85,
                        fontWeight: 'bold',
                        minHeight: fontSize * 1.1,
                      }}
                    >
                      {seg.chord ? transposeSingleChord(seg.chord, effectiveSteps) : ' '}
                    </ThemedText>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {seg.comment ? (
                      <ThemedText
                        type="default"
                        style={{
                          fontSize, // Stejná velikost písma ako text
                          lineHeight: fontSize * 1.3,
                          color: '#4caf50', // Ostatní v hranatých závorkách ZELENĚ
                          fontStyle: 'italic', // KURZÍVOU
                          fontWeight: '600',
                        }}
                      >
                        {seg.comment}{' '}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="default" style={{ fontSize, lineHeight: fontSize * 1.3, color: effectiveTextColor }}>
                      {seg.text || ' '}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          );
        }
      }

      // Samostatný řádek akordů bez závorek (např. "C  G  Dmi  Ami")
      const isChordLine = /^\s*([A-H][#b]?[m70-9]*)(\s+([A-H][#b]?[m70-9]*))*\s*$/i.test(line) && line.trim().length > 0;

      if (isChordLine) {
        const tokens = line.split(/(\s+)/);
        return (
          <View key={lIdx} style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 1 }}>
            {tokens.map((token, tIdx) => (
              <ThemedText
                key={tIdx}
                type={isChordName(token) ? "smallBold" : "default"}
                style={{
                  fontSize: fontSize + 1,
                  lineHeight: fontSize * 1.4,
                  color: isChordName(token) ? '#f44336' : effectiveTextColor, // Akordy ČERVENĚ
                  fontWeight: isChordName(token) ? 'bold' : 'normal',
                }}
              >
                {isChordName(token) ? transposeSingleChord(token, effectiveSteps) : token}
              </ThemedText>
            ))}
          </View>
        );
      }

      // Poznámka nebo struktura v závorkách (např. [solo kytara ...], [2x])
      const isCommentLine = line.trim().startsWith('[') && line.trim().endsWith(']');

      return (
        <ThemedText
          key={lIdx}
          type="default"
          style={{
            fontSize: fontSize, // Stejná velikost písma
            lineHeight: fontSize * 1.4,
            fontStyle: isCommentLine ? 'italic' : 'normal', // KURZÍVOU
            color: isCommentLine ? '#4caf50' : effectiveTextColor, // ZELENĚ pro hranaté závorky
            fontWeight: isCommentLine ? '600' : 'normal',
            marginVertical: 1,
          }}
        >
          {line}
        </ThemedText>
      );
    });
  };

  const handleNextSong = () => {
    if (currentIndex < songsList.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      currentScrollY.current = 0;
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      broadcastCurrentSong(nextIdx);
    }
  };

  const handlePrevSong = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      currentScrollY.current = 0;
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      broadcastCurrentSong(prevIdx);
    }
  };

  // Navigace poklepáním na levou (Předchozí) nebo pravou (Následující) polovinu textu
  const handleLyricsTap = (event: any) => {
    const pageX = event.nativeEvent.pageX;
    const screenWidth = Dimensions.get('window').width;

    if (pageX > screenWidth / 2) {
      handleNextSong();
    } else {
      handlePrevSong();
    }
  };

  // Audio nahrávání zobrazené písně přes expo-audio
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const isSongRecording = recorderState.isRecording || audioRecorder.isRecording;

  const isSongRecordingRef = useRef(false);
  const currentSongRef = useRef(currentSong);
  const previousSongRef = useRef(currentSong);

  isSongRecordingRef.current = isSongRecording;
  currentSongRef.current = currentSong;

  const formatDuration = (millis: number) => {
    if (!millis || millis <= 0) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const dateStr = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    const timeStr = `${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
    return `${dateStr} ${timeStr}`;
  };

  const startSongRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (permission.status === 'granted') {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      } else {
        Alert.alert('Chyba', 'Aplikace nemá přístup k mikrofonu.');
      }
    } catch (err) {
      console.error('Nepodařilo se spustit nahrávání písně', err);
      Alert.alert('Chyba', 'Nepodařilo se spustit nahrávání.');
    }
  };

  const stopAndSaveSongRecording = async (songToSave?: Song) => {
    const targetSong = songToSave || currentSongRef.current;
    if (!audioRecorder.isRecording || !activeBand || !targetSong) return;

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;

      const durationMillis = recorderState.durationMillis || (audioRecorder.currentTime || 0) * 1000;
      const recordTitle = `${targetSong.title} - ${formatDateTime(Date.now())}`;

      // Uložení do Storage složky: kapela_ios_android/<bandId>/records/
      const uploadResult = await uploadAudioToStorage(
        activeBand.id,
        uri,
        recordTitle,
        activeBand.name
      );

      // Uložení záznamu do Firestore
      await addAudioRecord(activeBand.id, {
        bandId: activeBand.id,
        title: recordTitle,
        durationMillis,
        downloadUrl: uploadResult.downloadUrl,
        storagePath: uploadResult.storagePath,
        createdAt: Date.now(),
        isPublic: false,
      });

      Alert.alert('Nahrávka uložena', `Nahrávka "${recordTitle}" byla uložena do Audio zápisníku.`);
    } catch (err) {
      console.error('Chyba při ukládání nahrávky písně', err);
    }
  };

  // Metronom stav a Tempo / Takt písně
  const [tempoBpm, setTempoBpm] = useState<number>(120);
  const [timeSig, setTimeSig] = useState<'4/4' | '3/4'>('4/4');
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false);
  const [currentMetronomeBeat, setCurrentMetronomeBeat] = useState<number | null>(null);
  const [currentMeasureIndex, setCurrentMeasureIndex] = useState<number>(0);
  const [metronomeFlashColor, setMetronomeFlashColor] = useState<string | null>(null);
  const metronomeIntervalRef = useRef<any>(null);
  const flashTimeoutRef = useRef<any>(null);

  // Načtení tempa a taktu při načtení nebo změně písně
  useEffect(() => {
    if (currentSong) {
      const parsedBpm = parseInt(currentSong.tempo || '120', 10);
      setTempoBpm(!isNaN(parsedBpm) && parsedBpm >= 30 ? parsedBpm : 120);
      setTimeSig(currentSong.timeSignature || '4/4');
    }
    stopVisualMetronome();
  }, [currentIndex, currentSong?.id, currentSong?.tempo, currentSong?.timeSignature]);

  const handleTempoChange = async (newBpm: number) => {
    const validBpm = Math.max(30, Math.min(260, newBpm));
    setTempoBpm(validBpm);
    if (currentSong && activeBand) {
      const bpmStr = `${validBpm}`;
      setSongsList(prev => prev.map(s => s.id === currentSong.id ? { ...s, tempo: bpmStr } : s));
      try {
        if (onUpdateSong) {
          await onUpdateSong(currentSong.id, { tempo: bpmStr });
        } else {
          await updateSong(activeBand.id, currentSong.id, { tempo: bpmStr });
        }
      } catch (e) {
        console.error("Chyba při ukládání tempa:", e);
      }
    }
  };

  const handleTimeSigToggle = async () => {
    const newSig: '4/4' | '3/4' = timeSig === '4/4' ? '3/4' : '4/4';
    setTimeSig(newSig);
    if (currentSong && activeBand) {
      setSongsList(prev => prev.map(s => s.id === currentSong.id ? { ...s, timeSignature: newSig } : s));
      try {
        if (onUpdateSong) {
          await onUpdateSong(currentSong.id, { timeSignature: newSig });
        } else {
          await updateSong(activeBand.id, currentSong.id, { timeSignature: newSig });
        }
      } catch (e) {
        console.error("Chyba při ukládání taktu:", e);
      }
    }
  };

  const triggerBeatFlash = (beatNumber: number) => {
    // 1. doba ČERVENÁ (#f44336), 2, 3, (4). doba ZELENÁ (#4caf50)
    const color = beatNumber === 1 ? '#f44336' : '#4caf50';
    setMetronomeFlashColor(color);

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }

    // Výrazné bliknutí na 140ms pro rytmický světelný efekt
    flashTimeoutRef.current = setTimeout(() => {
      setMetronomeFlashColor(null);
    }, 140);
  };

  const startVisualMetronome = () => {
    if (isMetronomeRunning) {
      stopVisualMetronome();
      return;
    }

    const beatsPerMeasure = timeSig === '3/4' ? 3 : 4;
    const totalBeats = beatsPerMeasure * 3; // Přesně 3 takty
    const msPerBeat = Math.round((60 / tempoBpm) * 1000);

    let count = 0;
    setIsMetronomeRunning(true);
    setCurrentMetronomeBeat(1);
    setCurrentMeasureIndex(1);
    triggerBeatFlash(1);

    metronomeIntervalRef.current = setInterval(() => {
      count++;
      if (count >= totalBeats) {
        stopVisualMetronome();
      } else {
        const beatInMeasure = (count % beatsPerMeasure) + 1;
        const measureNum = Math.floor(count / beatsPerMeasure) + 1;
        setCurrentMetronomeBeat(beatInMeasure);
        setCurrentMeasureIndex(measureNum);
        triggerBeatFlash(beatInMeasure);
      }
    }, msPerBeat);
  };

  const stopVisualMetronome = () => {
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setIsMetronomeRunning(false);
    setCurrentMetronomeBeat(null);
    setCurrentMeasureIndex(0);
    setMetronomeFlashColor(null);
  };

  useEffect(() => {
    return () => {
      stopVisualMetronome();
    };
  }, []);

  // Při přepnutí na jinou píseň zastavit a uložit nahrávku předchozí písně
  useEffect(() => {
    if (isSongRecordingRef.current && previousSongRef.current && previousSongRef.current.id !== currentSong?.id) {
      stopAndSaveSongRecording(previousSongRef.current);
    }
    previousSongRef.current = currentSong;
  }, [currentIndex]);

  const handleCloseViewer = async () => {
    if (isSongRecordingRef.current) {
      await stopAndSaveSongRecording();
    }
    if (activeRoleView === 'admin' && activeBand?.id && isLiveActive) {
      await liveSyncService.endLiveSession(activeBand.id);
    }
    onClose();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: effectiveBgColor }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Horní lišta - Live tlačítko/kolečko, Název skladby, Upravit a Zavření */}
        <View style={[styles.topBar, { borderBottomColor: 'rgba(150,150,150,0.2)' }]}>
          <View style={{ flex: 1, marginRight: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable
              style={[
                styles.liveCircleBtn,
                { backgroundColor: isLiveActive ? '#f44336' : 'rgba(150,150,150,0.25)' }
              ]}
              onPress={async () => {
                if (activeRoleView === 'admin' && activeBand?.id && currentSong) {
                  if (isLiveActive) {
                    await liveSyncService.endLiveSession(activeBand.id);
                  } else {
                    await liveSyncService.broadcastSongChange(
                      activeBand.id,
                      currentUser?.uid || 'admin',
                      currentUser?.displayName || 'Kapelník',
                      currentSong.id,
                      transpose
                    );
                  }
                }
              }}
              hitSlop={6}
            >
              <View style={[styles.liveDot, { backgroundColor: isLiveActive ? '#fff' : '#888' }]} />
              <ThemedText style={{ color: isLiveActive ? '#fff' : effectiveTextColor, fontSize: 10, fontWeight: 'bold' }}>
                LIVE
              </ThemedText>
            </Pressable>

            <ThemedText
              type="subtitle"
              style={{ fontSize: 16, fontWeight: 'bold', flex: 1, color: effectiveTextColor }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {capitalizeFirstLetter(currentSong?.title || '')}
            </ThemedText>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Pressable style={styles.closeBtn} onPress={handleCloseViewer}>
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor={effectiveTextColor} />
            </Pressable>
          </View>
        </View>

        {/* Ovládací lišta - Horizontálně posuvná (Metronom Ikona/Číslo, Tónina, Capo, Písmo, Posun, Tempo, Takt, REC, Upravit...) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: 'rgba(200,200,200,0.12)', maxHeight: 46, minHeight: 46 }}
          contentContainerStyle={styles.controlsBarContent}
        >
          {/* 1. Vizuální Metronom (Na PRVNÍM MÍSTĚ v liště) - při přehrávání se ikona změní na čísla 1, 2, 3, 4 (1. doba červená, zbytek zeleně) */}
          <Pressable
            style={[
              styles.smallCtrlBtn,
              {
                backgroundColor: metronomeFlashColor || (isMetronomeRunning ? 'rgba(255, 152, 0, 0.4)' : 'rgba(255, 152, 0, 0.2)'),
                borderColor: metronomeFlashColor ? '#fff' : 'rgba(255, 152, 0, 0.4)',
                borderWidth: 1,
                width: 38,
              }
            ]}
            onPress={startVisualMetronome}
          >
            {isMetronomeRunning ? (
              <ThemedText type="smallBold" style={{ color: metronomeFlashColor ? '#fff' : '#ff9800', fontSize: 16 }}>
                {currentMetronomeBeat}
              </ThemedText>
            ) : (
              <SymbolView
                name={{ ios: 'timer', android: 'timer', web: 'timer' }}
                size={18}
                tintColor="#ff9800"
              />
            )}
          </Pressable>

          {/* Transpozice tóniny */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleTransposeChange(transpose - 1)}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>-</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={{ color: transpose !== 0 ? '#ffc107' : effectiveTextColor, fontSize: 15, paddingHorizontal: 2 }}>
              {getFirstKey(currentSong, transpose)}
            </ThemedText>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleTransposeChange(transpose + 1)}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>+</ThemedText>
            </Pressable>
          </View>

          {/* Ovládání Osobního Capo (C 0, C 1, C 2... max 12) */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleCapoChange(Math.max(0, capo - 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>-</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={{ color: capo > 0 ? '#ffc107' : effectiveTextColor, fontSize: 13, paddingHorizontal: 2 }}>
              C {capo}
            </ThemedText>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleCapoChange(Math.min(12, capo + 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>+</ThemedText>
            </Pressable>
          </View>

          {/* Velikost písma bez spodního omezení u A- */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleFontSizeChange(Math.max(3, fontSize - 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>A-</ThemedText>
            </Pressable>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleFontSizeChange(Math.min(48, fontSize + 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>A+</ThemedText>
            </Pressable>
          </View>

          {/* Auto-scroll (Posun) */}
          <Pressable
            style={[styles.scrollToggleBtn, { backgroundColor: isAutoScrolling ? '#4caf50' : 'rgba(150,150,150,0.2)' }]}
            onPress={() => setIsAutoScrolling(!isAutoScrolling)}
          >
            <SymbolView name={{ ios: isAutoScrolling ? 'pause.fill' : 'play.fill', android: isAutoScrolling ? 'pause' : 'play_arrow', web: isAutoScrolling ? 'pause' : 'play_arrow' }} size={16} tintColor={isAutoScrolling ? '#fff' : effectiveTextColor} />
            <ThemedText type="smallBold" style={{ color: isAutoScrolling ? '#fff' : effectiveTextColor, fontSize: 11, marginLeft: 4 }}>
              {isAutoScrolling ? 'Stop' : 'Posun'}
            </ThemedText>
          </Pressable>

          {/* Zadání Tempa písně (BPM) ZA TLAČÍTKEM POSUN */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleTempoChange(tempoBpm - 5)}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>-</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={{ color: '#ff9800', fontSize: 13, paddingHorizontal: 2 }}>
              {tempoBpm} BPM
            </ThemedText>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleTempoChange(tempoBpm + 5)}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>+</ThemedText>
            </Pressable>
          </View>

          {/* Přepínač taktu písně (4/4 nebo 3/4) ZA TEMPEM */}
          <Pressable
            style={[styles.smallCtrlBtn, { backgroundColor: 'rgba(255, 152, 0, 0.2)', paddingHorizontal: 8 }]}
            onPress={handleTimeSigToggle}
          >
            <ThemedText type="smallBold" style={{ color: '#ff9800', fontSize: 13 }}>
              {timeSig}
            </ThemedText>
          </Pressable>
          {/* Transpozice tóniny */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleTransposeChange(transpose - 1)}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>-</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={{ color: transpose !== 0 ? '#ffc107' : effectiveTextColor, fontSize: 15, paddingHorizontal: 2 }}>
              {getFirstKey(currentSong, transpose)}
            </ThemedText>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleTransposeChange(transpose + 1)}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>+</ThemedText>
            </Pressable>
          </View>

          {/* Ovládání Osobního Capo (C 0, C 1, C 2... max 12) */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleCapoChange(Math.max(0, capo - 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>-</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={{ color: capo > 0 ? '#ffc107' : effectiveTextColor, fontSize: 13, paddingHorizontal: 2 }}>
              C {capo}
            </ThemedText>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleCapoChange(Math.min(12, capo + 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>+</ThemedText>
            </Pressable>
          </View>

          {/* Velikost písma bez spodního omezení u A- */}
          <View style={styles.controlGroup}>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleFontSizeChange(Math.max(3, fontSize - 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>A-</ThemedText>
            </Pressable>
            <Pressable style={styles.smallCtrlBtn} onPress={() => handleFontSizeChange(Math.min(48, fontSize + 1))}>
              <ThemedText type="smallBold" style={{ color: effectiveTextColor }}>A+</ThemedText>
            </Pressable>
          </View>

          {/* Auto-scroll */}
          <Pressable
            style={[styles.scrollToggleBtn, { backgroundColor: isAutoScrolling ? '#4caf50' : 'rgba(150,150,150,0.2)' }]}
            onPress={() => setIsAutoScrolling(!isAutoScrolling)}
          >
            <SymbolView name={{ ios: isAutoScrolling ? 'pause.fill' : 'play.fill', android: isAutoScrolling ? 'pause' : 'play_arrow', web: isAutoScrolling ? 'pause' : 'play_arrow' }} size={16} tintColor={isAutoScrolling ? '#fff' : effectiveTextColor} />
            <ThemedText type="smallBold" style={{ color: isAutoScrolling ? '#fff' : effectiveTextColor, fontSize: 11, marginLeft: 4 }}>
              {isAutoScrolling ? 'Stop' : 'Posun'}
            </ThemedText>
          </Pressable>

          {/* Tlačítko REC / STOP pro rychlé nahrávání zvuku přímo z náhledu písničky */}
          {activeRoleView !== 'fan' && (
            <Pressable
              style={[
                styles.scrollToggleBtn,
                {
                  backgroundColor: isSongRecording ? '#f44336' : 'rgba(244,67,54,0.15)',
                  borderColor: isSongRecording ? '#f44336' : 'rgba(244,67,54,0.4)',
                  borderWidth: 1,
                }
              ]}
              onPress={isSongRecording ? () => stopAndSaveSongRecording() : startSongRecording}
            >
              <SymbolView
                name={isSongRecording ? { ios: 'stop.fill', android: 'stop', web: 'stop' } : { ios: 'mic.fill', android: 'mic', web: 'mic' }}
                size={16}
                tintColor={isSongRecording ? '#fff' : '#f44336'}
              />
              <ThemedText type="smallBold" style={{ color: isSongRecording ? '#fff' : '#f44336', fontSize: 11, marginLeft: 4 }}>
                {isSongRecording ? `STOP (${formatDuration((recorderState.durationMillis || audioRecorder.currentTime * 1000) || 0)})` : 'REC'}
              </ThemedText>
            </Pressable>
          )}

          {/* Tlačítko Upravit text (Tužka) za tlačítkem Posun */}
          {activeRoleView !== 'fan' && (
            <Pressable style={styles.smallCtrlBtn} onPress={openDirectLyricsEditor}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={18} tintColor={effectiveTextColor} />
            </Pressable>
          )}

          {/* Tlačítko Jednorázově přizpůsobit velikost textu obrazovce (Auto-Fit na celou plochu) */}
          <Pressable
            style={styles.smallCtrlBtn}
            onPress={handleApplyAutoFit}
          >
            <SymbolView
              name={{
                ios: 'arrow.up.left.and.arrow.down.right',
                android: 'fullscreen',
                web: 'fullscreen'
              }}
              size={18}
              tintColor={effectiveTextColor}
            />
          </Pressable>

          {/* Tlačítko pro Inverzní zobrazení (Černé pozadí / Bílý text) */}
          <Pressable
            style={[
              styles.smallCtrlBtn,
              { backgroundColor: isInverted ? '#ffc107' : 'rgba(150,150,150,0.2)' }
            ]}
            onPress={() => {
              const nextVal = !isInverted;
              setIsInverted(nextVal);
              updatePersonalSetting(transpose, capo, fontSize, nextVal);
            }}
          >
            <SymbolView
              name={{
                ios: isInverted ? 'circle.half.filled' : 'sun.max.fill',
                android: isInverted ? 'invert_colors' : 'light_mode',
                web: isInverted ? 'invert_colors' : 'light_mode'
              }}
              size={18}
              tintColor={isInverted ? '#000' : effectiveTextColor}
            />
          </Pressable>
        </ScrollView>

        {/* Hlavní zobrazení textu a akordů */}
        <ScrollView
          ref={scrollViewRef}
          scrollEnabled={!isPinching}
          style={[styles.lyricsScrollView, { backgroundColor: effectiveBgColor }]}
          contentContainerStyle={[styles.lyricsContent, { paddingTop: 2, flexGrow: 1 }]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (height > 0 && height !== containerHeight) {
              setContainerHeight(height);
            }
            if (width > 0 && width !== containerWidth) {
              setContainerWidth(width);
            }
          }}
          onScroll={(e) => {
            currentScrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {/* Formátovaný text písně s akordy (poklepání na pravou polovinu = další píseň, na levou = předchozí, dlouhé podržení = přidat poznámku, gesta dvěma prsty = plynulý pinch-to-zoom) */}
          <Pressable
            onPress={handleLyricsTap}
            onLongPress={handleLyricsLongPress}
            delayLongPress={350}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{ flexGrow: 1, width: '100%', minHeight: '100%', paddingBottom: Spacing.six * 2 }}
          >
            <Animated.View style={{ transform: [{ scale: pinchScale }], flexGrow: 1, width: '100%' }}>
              {currentSong?.lyrics ? (
                renderFormattedLyrics(currentSong.lyrics)
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 40 }}>
                  Píseň zatím nemá vložený žádný text.
                </ThemedText>
              )}

              {/* Plovoucí osobní a Admin poznámky */}
              {effectiveNotes.map(note => (
                <FloatingNoteItem
                  key={note.id}
                  note={note}
                  fontSize={fontSize}
                  containerWidth={containerWidth || Dimensions.get('window').width}
                  onTap={handleNoteTap}
                  onDragEnd={handleNoteDragEnd}
                />
              ))}
            </Animated.View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Modal pro Přidání nové osobní poznámky */}
      <Modal visible={showAddNoteModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddNoteModal(false)}>
          <ThemedView type="backgroundElement" style={styles.noteDialogModal}>
            <ThemedText type="subtitle" style={{ fontSize: 18, marginBottom: 12 }}>
              📌 Přidat poznámku
            </ThemedText>
            <TextInput
              style={[styles.noteInput, { color: theme.text, borderColor: 'rgba(150,150,150,0.3)' }]}
              value={noteInputText}
              onChangeText={setNoteInputText}
              placeholder="Napište poznámku (např. 'Před mezihrou pauza')..."
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />

            {/* Zaškrtávátko Admin pro sdílení poznámky všem členům kapely */}
            {activeRoleView === 'admin' && (
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}
                onPress={() => setIsNoteAdminShared(!isNoteAdminShared)}
              >
                <SymbolView
                  name={{
                    ios: isNoteAdminShared ? 'checkmark.square.fill' : 'square',
                    android: isNoteAdminShared ? 'check_box' : 'check_box_outline_blank',
                    web: isNoteAdminShared ? 'check_box' : 'check_box_outline_blank'
                  }}
                  size={20}
                  tintColor={isNoteAdminShared ? '#FF8C00' : theme.textSecondary}
                />
                <ThemedText type="smallBold" style={{ color: isNoteAdminShared ? '#FF8C00' : theme.text }}>
                  👑 Admin poznámka (oranžová - pro všechny členy)
                </ThemedText>
              </Pressable>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.dialogBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={() => setShowAddNoteModal(false)}>
                <ThemedText type="smallBold">Zrušit</ThemedText>
              </Pressable>
              <Pressable style={[styles.dialogBtn, { backgroundColor: isNoteAdminShared ? '#FF8C00' : '#2196F3' }]} onPress={handleSaveNewNote}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal pro Akce s poznámkou (Editovat / Smazat) */}
      <Modal visible={showNoteActionsModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowNoteActionsModal(false)}>
          <ThemedView type="backgroundElement" style={styles.noteDialogModal}>
            <ThemedText
              type="subtitle"
              style={{ fontSize: 18, marginBottom: 8, color: selectedNoteForAction?.isAdminNote ? '#FF8C00' : '#2196F3' }}
            >
              {selectedNoteForAction?.isAdminNote ? '👑 Admin poznámka kapely' : '📌 Osobní poznámka'}
            </ThemedText>

            <ThemedText type="default" style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
              "{selectedNoteForAction?.text}"
            </ThemedText>

            {/* Pokud jde o Admin poznámku a uživatel NENÍ Admin, zobrazíme informaci */}
            {selectedNoteForAction?.isAdminNote && activeRoleView !== 'admin' ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Tuto poznámku vytvořil kapelník (Admin). Upravit text nebo smazat ji může pouze kapelník. Pozici poznámky na obrazovce můžete přetáhnout prstem.
                </ThemedText>
                <Pressable style={[styles.actionModalBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={() => setShowNoteActionsModal(false)}>
                  <ThemedText type="smallBold">Rozumím</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Pressable style={[styles.actionModalBtn, { backgroundColor: selectedNoteForAction?.isAdminNote ? '#FF8C00' : '#2196F3' }]} onPress={handleOpenEditSelectedNote}>
                  <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={18} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', marginLeft: 8 }}>Editovat poznámku</ThemedText>
                </Pressable>

                <Pressable style={[styles.actionModalBtn, { backgroundColor: '#e91e63' }]} onPress={handleDeleteSelectedNote}>
                  <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={18} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', marginLeft: 8 }}>Smazat poznámku</ThemedText>
                </Pressable>

                <Pressable style={[styles.actionModalBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={() => setShowNoteActionsModal(false)}>
                  <ThemedText type="smallBold">Zrušit</ThemedText>
                </Pressable>
              </View>
            )}
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal pro Úpravu stávající poznámky */}
      <Modal visible={showEditNoteModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditNoteModal(false)}>
          <ThemedView type="backgroundElement" style={styles.noteDialogModal}>
            <ThemedText type="subtitle" style={{ fontSize: 18, marginBottom: 12 }}>
              ✏️ Upravit poznámku
            </ThemedText>
            <TextInput
              style={[styles.noteInput, { color: theme.text, borderColor: 'rgba(150,150,150,0.3)' }]}
              value={noteInputText}
              onChangeText={setNoteInputText}
              placeholder="Upravte text poznámky..."
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />

            {/* Zaškrtávátko Admin pro sdílení poznámky všem členům kapely */}
            {activeRoleView === 'admin' && (
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}
                onPress={() => setIsNoteAdminShared(!isNoteAdminShared)}
              >
                <SymbolView
                  name={{
                    ios: isNoteAdminShared ? 'checkmark.square.fill' : 'square',
                    android: isNoteAdminShared ? 'check_box' : 'check_box_outline_blank',
                    web: isNoteAdminShared ? 'check_box' : 'check_box_outline_blank'
                  }}
                  size={20}
                  tintColor={isNoteAdminShared ? '#FF8C00' : theme.textSecondary}
                />
                <ThemedText type="smallBold" style={{ color: isNoteAdminShared ? '#FF8C00' : theme.text }}>
                  👑 Admin poznámka (oranžová - pro všechny členy)
                </ThemedText>
              </Pressable>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.dialogBtn, { backgroundColor: 'rgba(150,150,150,0.2)' }]} onPress={() => setShowEditNoteModal(false)}>
                <ThemedText type="smallBold">Zrušit</ThemedText>
              </Pressable>
              <Pressable style={[styles.dialogBtn, { backgroundColor: isNoteAdminShared ? '#FF8C00' : '#2196F3' }]} onPress={handleSaveEditedNote}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Celostránkový modal pro přímou editaci textu a akordů s pokročilým vkládáním a úpravou akordů */}
      <Modal visible={showLyricsEditorModal} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.background }]}>
          {/* Lišta celostránkového editoru s tlačítky Zahodit a Hotovo */}
          <View style={[styles.fullScreenHeader, { borderBottomColor: 'rgba(200,200,200,0.2)' }]}>
            <ThemedText type="subtitle" style={{ fontSize: 18, flex: 1, marginRight: 8 }} numberOfLines={1}>
              Text - {fixCzechDiacritics(currentSong?.title || '')}
            </ThemedText>

            <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
              {/* Tlačítko Zahodit */}
              <Pressable
                style={[styles.editorActionBtn, { backgroundColor: '#e91e63' }]}
                onPress={handleDiscardLyricsChanges}
              >
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Zahodit</ThemedText>
              </Pressable>

              {/* Tlačítko Hotovo */}
              <Pressable
                style={[styles.editorActionBtn, { backgroundColor: '#4caf50' }]}
                onPress={handleSaveLyricsDirectly}
              >
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Hotovo</ThemedText>
              </Pressable>
            </View>
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

          {/* TextInput na celou obrazovku se sledováním kurzoru přes ref a native setSelection */}
          <TextInput
            ref={fullScreenInputRef}
            style={[
              styles.fullScreenInput,
              {
                color: theme.text,
                backgroundColor: theme.background,
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              }
            ]}
            value={editingLyricsText}
            onChangeText={setEditingLyricsText}
            onSelectionChange={handleSelectionChange}
            placeholder="Zde napište nebo vložte text písně s akordy v hranatých závorkách [C]..."
            placeholderTextColor={theme.textSecondary}
            multiline
            autoFocus
          />
        </SafeAreaView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  liveCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topBtn: { flexDirection: 'row', alignItems: 'center' },
  topEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(200,200,200,0.2)',
  },
  closeBtn: { padding: 4 },
  controlsBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  controlGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallCtrlBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  scrollToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  lyricsScrollView: { flex: 1 },
  lyricsContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six * 2 },
  fullScreenContainer: { flex: 1 },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  editorActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
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
  fullScreenInput: {
    flex: 1,
    padding: Spacing.four,
    fontSize: 18,
    lineHeight: 26,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  noteDialogModal: {
    width: '85%',
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: 10,
    fontSize: 16,
  },
  dialogBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Spacing.two,
  },
  actionModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Spacing.two,
  },
});