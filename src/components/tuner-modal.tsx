import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Platform, Text, Alert, UIManager } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

let NativeWebView: any = null;
try {
  NativeWebView = require('react-native-webview').WebView;
} catch (e) {
  NativeWebView = null;
}

// Bezpečně ověříme, zda nainstalovaný APK balíček má v C++ jádru zkompilovaný RNCWebView
const checkNativeWebViewAvailable = (): boolean => {
  if (Platform.OS === 'web') return true;
  try {
    if (!NativeWebView) return false;
    if (UIManager && typeof UIManager.getViewManagerConfig === 'function') {
      const config = UIManager.getViewManagerConfig('RNCWebView');
      return Boolean(config);
    }
    if (UIManager && typeof UIManager.hasViewManagerConfig === 'function') {
      return UIManager.hasViewManagerConfig('RNCWebView');
    }
    return Boolean((UIManager as any)?.RNCWebView);
  } catch (e) {
    return false;
  }
};

const hasNativeWebView = checkNativeWebViewAvailable();

// Definice ladění a nástrojů
export interface TuningString {
  note: string;     // např. "E"
  octave: number;   // např. 2 -> "E2"
  freq: number;     // Hz
}

export interface InstrumentPreset {
  id: string;
  name: string;
  category: string;
  strings: TuningString[];
}

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  // BASSKYTARY
  {
    id: 'bass_4',
    name: 'Baskytara (4 struny)',
    category: 'Baskytara',
    strings: [
      { note: 'E', octave: 1, freq: 41.20 },
      { note: 'A', octave: 1, freq: 55.00 },
      { note: 'D', octave: 2, freq: 73.42 },
      { note: 'G', octave: 2, freq: 98.00 },
    ],
  },
  {
    id: 'bass_5',
    name: 'Baskytara (5 strun - H/B)',
    category: 'Baskytara',
    strings: [
      { note: 'B', octave: 0, freq: 30.87 },
      { note: 'E', octave: 1, freq: 41.20 },
      { note: 'A', octave: 1, freq: 55.00 },
      { note: 'D', octave: 2, freq: 73.42 },
      { note: 'G', octave: 2, freq: 98.00 },
    ],
  },
  {
    id: 'bass_6',
    name: 'Baskytara (6 strun)',
    category: 'Baskytara',
    strings: [
      { note: 'B', octave: 0, freq: 30.87 },
      { note: 'E', octave: 1, freq: 41.20 },
      { note: 'A', octave: 1, freq: 55.00 },
      { note: 'D', octave: 2, freq: 73.42 },
      { note: 'G', octave: 2, freq: 98.00 },
      { note: 'C', octave: 3, freq: 130.81 },
    ],
  },

  // KYTARY
  {
    id: 'guitar_6',
    name: 'Kytara (6 strun Standard E)',
    category: 'Kytara',
    strings: [
      { note: 'E', octave: 2, freq: 82.41 },
      { note: 'A', octave: 2, freq: 110.00 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'E', octave: 4, freq: 329.63 },
    ],
  },
  {
    id: 'guitar_drop_d',
    name: 'Kytara (Drop D)',
    category: 'Kytara',
    strings: [
      { note: 'D', octave: 2, freq: 73.42 },
      { note: 'A', octave: 2, freq: 110.00 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'E', octave: 4, freq: 329.63 },
    ],
  },
  {
    id: 'guitar_12',
    name: 'Kytara (12 strun)',
    category: 'Kytara',
    strings: [
      { note: 'E', octave: 2, freq: 82.41 },
      { note: 'E', octave: 3, freq: 164.81 },
      { note: 'A', octave: 2, freq: 110.00 },
      { note: 'A', octave: 3, freq: 220.00 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'G', octave: 4, freq: 392.00 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'E', octave: 4, freq: 329.63 },
      { note: 'E', octave: 4, freq: 329.63 },
    ],
  },

  // BLUEGRASS & COUNTRY
  {
    id: 'banjo_5',
    name: 'Banjo (5 strunné Open G)',
    category: 'Banjo & Dobro',
    strings: [
      { note: 'G', octave: 4, freq: 392.00 }, // 5. krátká struna
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'D', octave: 4, freq: 293.66 },
    ],
  },
  {
    id: 'banjo_tenor',
    name: 'Banjo (Tenorové 4 struny)',
    category: 'Banjo & Dobro',
    strings: [
      { note: 'C', octave: 3, freq: 130.81 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'A', octave: 4, freq: 440.00 },
    ],
  },
  {
    id: 'dobro_open_g',
    name: 'Dobro / Resofonika (Open G)',
    category: 'Banjo & Dobro',
    strings: [
      { note: 'G', octave: 2, freq: 98.00 },
      { note: 'B', octave: 2, freq: 123.47 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'D', octave: 4, freq: 293.66 },
    ],
  },
  {
    id: 'dobro_open_d',
    name: 'Dobro (Open D)',
    category: 'Banjo & Dobro',
    strings: [
      { note: 'D', octave: 2, freq: 73.42 },
      { note: 'A', octave: 2, freq: 110.00 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'F#', octave: 3, freq: 185.00 },
      { note: 'A', octave: 3, freq: 220.00 },
      { note: 'D', octave: 4, freq: 293.66 },
    ],
  },

  // FOLK & MALÉ NÁSTROJE
  {
    id: 'mandolin',
    name: 'Mandolína',
    category: 'Mandolína & Ukulele',
    strings: [
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'A', octave: 4, freq: 440.00 },
      { note: 'E', octave: 5, freq: 659.25 },
    ],
  },
  {
    id: 'ukulele_soprano',
    name: 'Ukulele (Standard C)',
    category: 'Mandolína & Ukulele',
    strings: [
      { note: 'G', octave: 4, freq: 392.00 },
      { note: 'C', octave: 4, freq: 261.63 },
      { note: 'E', octave: 4, freq: 329.63 },
      { note: 'A', octave: 4, freq: 440.00 },
    ],
  },
  {
    id: 'ukulele_baritone',
    name: 'Ukulele (Baryton D-G-B-E)',
    category: 'Mandolína & Ukulele',
    strings: [
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'E', octave: 4, freq: 329.63 },
    ],
  },

  // SMYČCOVÉ NÁSTROJE
  {
    id: 'violin',
    name: 'Housle',
    category: 'Smyčce',
    strings: [
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'A', octave: 4, freq: 440.00 },
      { note: 'E', octave: 5, freq: 659.25 },
    ],
  },
  {
    id: 'viola',
    name: 'Viola',
    category: 'Smyčce',
    strings: [
      { note: 'C', octave: 3, freq: 130.81 },
      { note: 'G', octave: 3, freq: 196.00 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'A', octave: 4, freq: 440.00 },
    ],
  },
  {
    id: 'cello',
    name: 'Violoncello',
    category: 'Smyčce',
    strings: [
      { note: 'C', octave: 2, freq: 65.41 },
      { note: 'G', octave: 2, freq: 98.00 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'A', octave: 3, freq: 220.00 },
    ],
  },
  {
    id: 'contrabass',
    name: 'Kontrabas',
    category: 'Smyčce',
    strings: [
      { note: 'E', octave: 1, freq: 41.20 },
      { note: 'A', octave: 1, freq: 55.00 },
      { note: 'D', octave: 2, freq: 73.42 },
      { note: 'G', octave: 2, freq: 98.00 },
    ],
  },
];

// Názvy not pro chromatické zobrazení
const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function TunerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [selectedPreset, setSelectedPreset] = useState<InstrumentPreset>(INSTRUMENT_PRESETS[3]); // Default Kytara (6 strun Standard E)
  const [selectedStringIndex, setSelectedStringIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Vše');

  // Unikátní kategorie
  const categories = ['Vše', 'Baskytara', 'Kytara', 'Banjo & Dobro', 'Mandolína & Ukulele', 'Smyčce'];

  const filteredPresets = selectedCategory === 'Vše'
    ? INSTRUMENT_PRESETS
    : INSTRUMENT_PRESETS.filter(p => p.category === selectedCategory);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [detectedNote, setDetectedNote] = useState<string>('--');
  const [detectedOctave, setDetectedOctave] = useState<number | null>(null);
  const [centsDiff, setCentsDiff] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [targetString, setTargetString] = useState<TuningString | null>(null);

  // Web Audio HTML pro analýzu zvuku přes autokorelaci (YIN alg.)
  const tunerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="background:transparent; margin:0;">
      <script>
        let audioContext = null;
        let analyser = null;
        let microphone = null;
        let isRunning = false;
        let buffer = null;

        function autoCorrelate(buf, sampleRate) {
          let SIZE = buf.length;
          let rms = 0;
          for (let i = 0; i < SIZE; i++) {
            let val = buf[i];
            rms += val * val;
          }
          rms = Math.sqrt(rms / SIZE);
          if (rms < 0.01) return -1; // Příliš tichý signál

          let r1 = 0, r2 = SIZE - 1, thres = 0.2;
          for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
          }
          for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
          }

          buf = buf.slice(r1, r2);
          SIZE = buf.length;

          let c = new Array(SIZE).fill(0);
          for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
              c[i] = c[i] + buf[j] * buf[j + i];
            }
          }

          let d = 0;
          while (c[d] > c[d + 1]) d++;
          let maxval = -1, maxpos = -1;
          for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
              maxval = c[i];
              maxpos = i;
            }
          }
          let T0 = maxpos;
          let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
          let a = (x1 + x3 - 2 * x2) / 2;
          let b = (x3 - x1) / 2;
          if (a) T0 = T0 - b / (2 * a);

          return sampleRate / T0;
        }

        async function startTuner() {
          try {
            if (isRunning) return;
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            });

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            buffer = new Float32Array(analyser.fftSize);

            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);

            isRunning = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STATUS', running: true }));

            function update() {
              if (!isRunning) return;
              analyser.getFloatTimeDomainData(buffer);
              let pitch = autoCorrelate(buffer, audioContext.sampleRate);
              if (pitch !== -1 && pitch > 20 && pitch < 2000) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PITCH', freq: pitch }));
              }
              requestAnimationFrame(update);
            }
            update();
          } catch (err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.message }));
          }
        }

        function stopTuner() {
          isRunning = false;
          if (audioContext) {
            audioContext.close();
            audioContext = null;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STATUS', running: false }));
        }

        document.addEventListener('message', function(e) {
          if (e.data === 'START') startTuner();
          if (e.data === 'STOP') stopTuner();
        });
        window.addEventListener('message', function(e) {
          if (e.data === 'START') startTuner();
          if (e.data === 'STOP') stopTuner();
        });
      </script>
    </body>
    </html>
  `;

  // Start/Stop při otevření modalu + bezpečné spuštění
  useEffect(() => {
    let timer: any = null;

    if (visible) {
      // Bezpečně zkusíme požádat o mikrofon pouze pokud modul existuje
      const requestMicAndStart = async () => {
        try {
          let audioMod: any = null;
          try {
            audioMod = require('expo-audio').AudioModule;
          } catch (e) {}

          if (audioMod && audioMod.requestRecordingPermissionsAsync) {
            const status = await audioMod.requestRecordingPermissionsAsync();
            if (!status.granted) {
              Alert.alert("Mikrofon zakázán", "Pro fungování ladičky prosím povolte přístup k mikrofonu.");
              return;
            }
          }
        } catch (e) {
          console.log("Kontrola mikrofonu selhala:", e);
        }

        timer = setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.postMessage('START');
          }
        }, 300);
      };

      requestMicAndStart();

      return () => {
        if (timer) clearTimeout(timer);
      };
    } else {
      if (webViewRef.current) {
        webViewRef.current.postMessage('STOP');
      }
      setDetectedPitch(null);
      setDetectedNote('--');
      setCentsDiff(0);
    }
  }, [visible]);

  // Výpočet odchylky v centech
  const handlePitchDetected = (freq: number) => {
    setDetectedPitch(freq);

    // 1. Výpočet nejbližší chromatické noty
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;
    const noteIndex = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const noteName = NOTE_STRINGS[noteIndex];

    // Výpočet cílové struny podle režimu (ruční výběr vs automatika)
    let currentTarget: TuningString | null = null;

    if (selectedStringIndex !== null && selectedPreset.strings[selectedStringIndex]) {
      currentTarget = selectedPreset.strings[selectedStringIndex];
    } else {
      // Automatický výběr: Najdeme strunu daného nástroje s nejmenším rozdílem frekvence
      let minDiff = Infinity;
      selectedPreset.strings.forEach(str => {
        const diff = Math.abs(str.freq - freq);
        if (diff < minDiff) {
          minDiff = diff;
          currentTarget = str;
        }
      });
    }

    setTargetString(currentTarget);

    if (currentTarget) {
      setDetectedNote(currentTarget.note);
      setDetectedOctave(currentTarget.octave);
      // Odchylka v centech = 1200 * log2(freq / targetFreq)
      const cents = Math.round(1200 * (Math.log(freq / currentTarget.freq) / Math.log(2)));
      setCentsDiff(Math.max(-50, Math.min(50, cents)));
    } else {
      setDetectedNote(noteName);
      setDetectedOctave(octave);
      const standardFreq = 440 * Math.pow(2, (midi - 69) / 12);
      const cents = Math.round(1200 * (Math.log(freq / standardFreq) / Math.log(2)));
      setCentsDiff(Math.max(-50, Math.min(50, cents)));
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'PITCH') {
        handlePitchDetected(data.freq);
      } else if (data.type === 'STATUS') {
        setIsListening(data.running);
      }
    } catch (e) {}
  };

  // Barva indikátoru podle přesnosti (±3 centy = naladěno, zelená)
  const isTuned = Math.abs(centsDiff) <= 3 && detectedPitch !== null;
  const needleColor = isTuned ? '#4caf50' : (Math.abs(centsDiff) < 15 ? '#ff9800' : '#f44336');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <ThemedView style={[styles.container, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>

        {/* Hlavička */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={22} tintColor={theme.text} />
          </Pressable>
          <ThemedText type="subtitle" style={{ fontSize: 19, fontWeight: 'bold' }}>Ladička nástrojů</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Výběr Nástroje (Kategorie a Presety přehledně) */}
        <View style={{ marginBottom: 12 }}>
          {/* Kategorie (Vše, Kytara, Baskytara, Banjo, Smyčce...) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, marginBottom: 8 }}>
            {categories.map((cat) => {
              const isCatSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.catChip,
                    { backgroundColor: isCatSelected ? theme.text : 'rgba(150,150,150,0.12)' }
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <ThemedText type="smallBold" style={{ color: isCatSelected ? theme.background : theme.text, fontSize: 11 }}>
                    {cat}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Konkrétní nástroje */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {filteredPresets.map((preset) => {
              const isSelected = selectedPreset.id === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isSelected ? '#ff9800' : 'rgba(150,150,150,0.15)',
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? '#ff9800' : 'rgba(150,150,150,0.25)',
                    }
                  ]}
                  onPress={() => {
                    setSelectedPreset(preset);
                    setSelectedStringIndex(null);
                  }}
                >
                  <ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 13 }}>
                    {preset.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Struny nástroje (Tlačítka pro volbu konkrétní struny nebo Auto) */}
        <View style={styles.stringsRow}>
          <Pressable
            style={[styles.stringBadge, selectedStringIndex === null && { borderColor: '#4caf50', borderWidth: 2, backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}
            onPress={() => setSelectedStringIndex(null)}
          >
            <ThemedText type="smallBold" style={{ color: selectedStringIndex === null ? '#4caf50' : theme.textSecondary, fontSize: 11 }}>
              AUTO
            </ThemedText>
          </Pressable>

          {selectedPreset.strings.map((str, idx) => {
            const isTarget = targetString?.note === str.note && targetString?.octave === str.octave;
            const isManuallySelected = selectedStringIndex === idx;
            return (
              <Pressable
                key={`${str.note}-${str.octave}-${idx}`}
                style={[
                  styles.stringBadge,
                  isManuallySelected && { borderColor: '#2196f3', borderWidth: 2, backgroundColor: 'rgba(33, 150, 243, 0.2)' },
                  !isManuallySelected && isTarget && { borderColor: '#4caf50', borderWidth: 2 }
                ]}
                onPress={() => setSelectedStringIndex(idx)}
              >
                <ThemedText type="smallBold" style={{ fontSize: 13, color: isTarget ? '#4caf50' : theme.text }}>
                  {str.note}
                </ThemedText>
                <ThemedText type="small" style={{ fontSize: 9, color: theme.textSecondary }}>
                  {str.octave}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Hlavní ukazatel ladičky (Ciferník s ručičkou) */}
        <View style={styles.meterContainer}>
          {/* Velký název noty */}
          <View style={[styles.noteCircle, { borderColor: needleColor }]}>
            <ThemedText type="title" style={{ fontSize: 48, fontWeight: 'bold', color: needleColor }}>
              {detectedNote}
            </ThemedText>
            {detectedOctave !== null && (
              <ThemedText type="small" style={{ fontSize: 14, color: theme.textSecondary, position: 'absolute', right: 28, top: 28 }}>
                {detectedOctave}
              </ThemedText>
            )}
          </View>

          {/* Frekvence v Hz */}
          <ThemedText type="subtitle" style={{ fontSize: 20, marginTop: 12, fontWeight: 'bold' }}>
            {detectedPitch ? `${detectedPitch.toFixed(1)} Hz` : 'Zahrajte tón...'}
          </ThemedText>

          {/* Cílová frekvence struny */}
          {targetString && (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              Cíl: {targetString.note}{targetString.octave} ({targetString.freq.toFixed(1)} Hz)
            </ThemedText>
          )}

          {/* Stupnice odchylky v centech (-50 až +50) */}
          <View style={styles.gaugeBox}>
            <View style={styles.gaugeLine}>
              <View style={[styles.gaugeCenterMark, { backgroundColor: isTuned ? '#4caf50' : theme.textSecondary }]} />
              {/* Ručička ukazatele */}
              <View
                style={[
                  styles.needle,
                  {
                    backgroundColor: needleColor,
                    left: `${50 + centsDiff}%`,
                  }
                ]}
              />
            </View>

            <View style={styles.gaugeLabels}>
              <ThemedText type="small" style={{ fontSize: 11, color: '#f44336' }}>-50 Podladěno</ThemedText>
              <ThemedText type="smallBold" style={{ fontSize: 12, color: isTuned ? '#4caf50' : theme.text }}>
                {centsDiff > 0 ? `+${centsDiff}` : centsDiff} centů
              </ThemedText>
              <ThemedText type="small" style={{ fontSize: 11, color: '#f44336' }}>Přetaženo +50</ThemedText>
            </View>
          </View>
        </View>

        {/* Spodní info o mikrofonu */}
        <View style={styles.footer}>
          <SymbolView
            name={{ ios: isListening ? 'waveform.circle.fill' : 'mic.fill', android: 'mic', web: 'mic' }}
            size={18}
            tintColor={isListening ? '#4caf50' : '#888'}
          />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
            {isListening ? 'Mikrofon aktivní - poslouchám...' : 'Připojování mikrofonu...'}
          </ThemedText>
        </View>

        {/* Neviditelný WebView s Web Audio API pro 100% spolehlivou analýzu bez kompilace C++ */}
        {NativeWebView ? (
          <View style={{ height: 1, width: 1, position: 'absolute', bottom: -10, left: -10, opacity: 0.01, overflow: 'hidden' }}>
            <NativeWebView
              ref={webViewRef}
              source={{ html: tunerHtml, baseUrl: 'https://localhost' }}
              onMessage={handleMessage}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback={true}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onError={(e: any) => console.log("WebView error:", e)}
              onHttpError={(e: any) => console.log("WebView http error:", e)}
              onPermissionRequest={(event: any) => {
                if (event && event.grant) {
                  event.grant(event.resources);
                }
              }}
            />
          </View>
        ) : null}

      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  closeBtn: {
    padding: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stringsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 14,
  },
  stringBadge: {
    width: 44,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  noteCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  gaugeBox: {
    width: '90%',
    marginTop: 40,
  },
  gaugeLine: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(150,150,150,0.25)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  gaugeCenterMark: {
    position: 'absolute',
    left: '50%',
    width: 4,
    height: 16,
    top: -5,
    borderRadius: 2,
    marginLeft: -2,
  },
  needle: {
    position: 'absolute',
    width: 8,
    height: 24,
    borderRadius: 4,
    top: -9,
    marginLeft: -4,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
});
