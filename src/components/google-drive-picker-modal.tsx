import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/utils/i18n';
import { exchangeCodeForTokens, getGoogleUserProfileAndCalendar } from '@/services/googleCalendarService';
import { getGoogleDriveAuthUrl, fetchGoogleDriveFiles, downloadGoogleDriveFile, DriveFile } from '@/services/googleDriveService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onFileSelected: (fileData: { uri: string; name: string; textContent?: string }) => void;
}

export function GoogleDrivePickerModal({ visible, onClose, onFileSelected }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthWebView, setShowAuthWebView] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const redirectUri = 'https://auth.expo.io/@barry2709/kapela_ios_android';

  const startAccountPicker = () => {
    setShowAuthWebView(true);
  };

  const handleWebViewUrlChange = async (url: string) => {
    if (!url) return;

    if (url.includes('code=')) {
      setShowAuthWebView(false);
      const match = url.match(/code=([^&]+)/);
      if (match && match[1]) {
        const code = decodeURIComponent(match[1]);
        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (tokens && tokens.accessToken) {
            setAccessToken(tokens.accessToken);
            const profile = await getGoogleUserProfileAndCalendar(tokens.accessToken);
            if (profile && profile.email) {
              setUserEmail(profile.email);
            }
            loadFiles(tokens.accessToken, searchQuery);
          }
        } catch (e) {
          console.error('Chyba při přihlašování k Google účtu:', e);
          Alert.alert('Chyba', 'Přihlášení k Google účtu selhalo.');
        }
      }
    }
  };

  const loadFiles = async (token: string, query?: string) => {
    setIsLoadingFiles(true);
    try {
      const fetched = await fetchGoogleDriveFiles(token, query);
      setFiles(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (visible && !accessToken && !showAuthWebView) {
      // Automaticky otevřít výběr účtů při otevření dialogu
      startAccountPicker();
    }
  }, [visible]);

  useEffect(() => {
    if (accessToken) {
      const timer = setTimeout(() => {
        loadFiles(accessToken, searchQuery);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, accessToken]);

  const handleSelectFile = async (file: DriveFile) => {
    if (!accessToken) return;
    setIsDownloading(true);
    try {
      const downloaded = await downloadGoogleDriveFile(accessToken, file.id, file.name);
      if (downloaded) {
        onFileSelected(downloaded);
        onClose();
      } else {
        Alert.alert('Chyba', 'Soubor se nepodařilo z Google Disku stáhnout.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.card}>
          {/* Hlavička modal okna */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SymbolView name={{ ios: 'folder.fill', android: 'folder', web: 'folder' }} size={22} tintColor="#ff9800" />
              <ThemedText type="subtitle" style={{ fontSize: 18 }}>
                Google Disk
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }} size={22} tintColor={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Tlačítko pro výběr/změnu Google účtu z telefonu */}
          <View style={styles.accountBar}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
              {userEmail ? `Účet: ${userEmail}` : 'Vyberte Google účet z mobilu'}
            </ThemedText>
            <Pressable onPress={startAccountPicker} style={styles.changeAccountBtn}>
              <SymbolView name={{ ios: 'person.crop.circle.badge.plus', android: 'account_circle', web: 'account_circle' }} size={16} tintColor="#2196f3" />
              <ThemedText type="smallBold" style={{ color: '#2196f3', marginLeft: 4 }}>
                {userEmail ? 'Změnit účet' : 'Vybrat účet'}
              </ThemedText>
            </Pressable>
          </View>

          {/* Vyhledávací pole */}
          {accessToken && (
            <View style={[styles.searchBox, { backgroundColor: theme.background }]}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Hledat písničku nebo akordy..."
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          )}

          {/* Seznam souborů z Google Disku */}
          {isDownloading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff9800" />
              <ThemedText type="smallBold" style={{ marginTop: 10 }}>
                Stahuji soubor z Google Disku...
              </ThemedText>
            </View>
          ) : showAuthWebView ? (
            <View style={{ flex: 1, marginTop: 10 }}>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: 6 }}>
                Vyberte účet v přihlašovacím okně Google:
              </ThemedText>
              <WebView
                source={{ uri: getGoogleDriveAuthUrl(redirectUri) }}
                onNavigationStateChange={(navState) => handleWebViewUrlChange(navState.url)}
                style={{ flex: 1, borderRadius: 10 }}
              />
            </View>
          ) : isLoadingFiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196f3" />
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 10 }}>
                Načítám soubory z Google Disku...
              </ThemedText>
            </View>
          ) : files.length > 0 ? (
            <ScrollView style={{ flex: 1, marginTop: 10 }}>
              {files.map(file => {
                const isText = file.name.endsWith('.txt') || file.name.endsWith('.chordpro') || file.name.endsWith('.pro');
                return (
                  <Pressable key={file.id} style={styles.fileRow} onPress={() => handleSelectFile(file)}>
                    <SymbolView
                      name={{
                        ios: isText ? 'doc.text.fill' : 'doc.fill',
                        android: isText ? 'description' : 'insert_drive_file',
                        web: isText ? 'description' : 'insert_drive_file',
                      }}
                      size={20}
                      tintColor={isText ? '#4caf50' : '#2196f3'}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {file.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {isText ? 'Text / Akordy' : file.mimeType}
                      </ThemedText>
                    </View>
                    <SymbolView name={{ ios: 'arrow.down.circle.fill', android: 'download', web: 'download' }} size={20} tintColor="#ff9800" />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : accessToken ? (
            <View style={styles.loadingContainer}>
              <ThemedText type="small" themeColor="textSecondary">
                Na vašem Google Disku nebyly nalezeny žádné soubory.
              </ThemedText>
            </View>
          ) : null}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    height: '80%',
    borderRadius: 16,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeBtn: {
    padding: 4,
  },
  accountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(150,150,150,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  changeAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
