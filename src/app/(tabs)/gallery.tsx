import React, { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ImageViewer from 'react-native-image-zoom-viewer';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/utils/i18n';
import { useAppStore } from '@/store/useAppStore';
import { PhotoAlbum, AlbumPhoto } from '@/types';
import {
  subscribeToPhotoAlbums,
  subscribeToAlbumPhotos,
  createPhotoAlbum,
  uploadPhotoToGallery,
  deletePhotoFromGallery,
  deletePhotoAlbum,
} from '@/services/firebaseService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMN_COUNT = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - (GRID_COLUMN_COUNT - 1) * 8) / GRID_COLUMN_COUNT;

export default function GalleryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { activeBand, currentUser, activeRoleView } = useAppStore();

  const isAdmin = activeRoleView === 'admin' || currentUser?.role === 'admin';
  const uploaderName = currentUser?.displayName || (activeRoleView === 'fan' ? 'Fanoušek' : 'Člen kapely');

  // Načítaná alba z databáze
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);

  // Modály
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<AlbumPhoto | null>(null);

  // Formulář pro upload / vytvoření alba
  const [uploadMode, setUploadMode] = useState<'new' | 'existing'>('new');
  const [selectedAlbumIdForUpload, setSelectedAlbumIdForUpload] = useState<string>('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDate, setNewAlbumDate] = useState(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
  });
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  // Formátované fotky pro react-native-image-zoom-viewer
  const formattedImages = useMemo(() => {
    return albumPhotos.map(p => ({ url: p.downloadUrl }));
  }, [albumPhotos]);

  const activePhotoIndex = useMemo(() => {
    if (!selectedPhotoForView || albumPhotos.length === 0) return 0;
    const idx = albumPhotos.findIndex(p => p.id === selectedPhotoForView.id);
    return idx !== -1 ? idx : 0;
  }, [selectedPhotoForView?.id, albumPhotos]);

    // 1. Živé načítání alb z Firebase (S podporou pro VŠECHNY kapely, které fanoušek sleduje)
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const loadAlbums = async () => {
      let targetBandIds: string[] = activeBand?.id ? [activeBand.id] : [];

      if (activeRoleView === 'fan') {
        try {
          const sessionsStr = await AsyncStorage.getItem('savedSessions');
          if (sessionsStr) {
            const sessions = JSON.parse(sessionsStr);
            const fanBandIds = sessions.map((s: any) => s.band?.id).filter(Boolean);
            fanBandIds.forEach((id: string) => {
              if (!targetBandIds.includes(id)) targetBandIds.push(id);
            });
          }
        } catch (e) {
          console.error("Chyba při načítání sezení pro galerii fanouška:", e);
        }
      }

      // Pokud pořád nemáme žádné ID kapely, zkusíme fallback
      if (targetBandIds.length === 0) {
        targetBandIds = ['naplech-demo', 'naplech', 'kapela'];
      }

      const allAlbumsMap = new Map<string, PhotoAlbum[]>();

      targetBandIds.forEach(bId => {
        const unsub = subscribeToPhotoAlbums(bId, (freshAlbums: PhotoAlbum[]) => {
          allAlbumsMap.set(bId, freshAlbums);
          const combined = Array.from(allAlbumsMap.values()).flat().sort((a, b) => b.createdAt - a.createdAt);
          setAlbums(combined);

          if (selectedAlbum) {
            const freshSel = combined.find(a => a.id === selectedAlbum.id);
            if (freshSel) setSelectedAlbum(freshSel);
          }
        });
        unsubs.push(unsub);
      });
    };

    loadAlbums();

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [activeBand?.id, activeRoleView, selectedAlbum?.id]);

  // 2. Živé načítání fotek ve vybraném albu
  useEffect(() => {
    const targetBandId = selectedAlbum?.bandId || activeBand?.id;
    if (!targetBandId || !selectedAlbum?.id) {
      setAlbumPhotos([]);
      return;
    }
    const unsubscribe = subscribeToAlbumPhotos(targetBandId, selectedAlbum.id, (freshPhotos: AlbumPhoto[]) => {
      setAlbumPhotos(freshPhotos);
    });
    return () => unsubscribe();
  }, [activeBand?.id, selectedAlbum?.id, selectedAlbum?.bandId]);

  // Správa orientace při otevření a zavření fotky
  useEffect(() => {
    try {
      const ScreenOrientation = require('expo-screen-orientation');
      if (selectedPhotoForView) {
        ScreenOrientation.unlockAsync().catch(() => {});
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    } catch (e) {}
  }, [selectedPhotoForView]);

  // Výběr fotek z galerie telefonu
  const pickImagesFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map(a => a.uri);
        setSelectedImageUris(uris);
      }
    } catch (e) {
      console.error("Chyba při výběru fotek z galerie:", e);
      Alert.alert(t('home.attendance.errorTitle'), 'Nepodařilo se načíst fotky z galerie.');
    }
  };

  // Zpracování odeslání / uploadu
  const handleUploadPhotos = async () => {
    if (!activeBand) return;

    if (selectedImageUris.length === 0) {
      Alert.alert(t('home.attendance.errorTitle'), 'Vyberte alespoň jednu fotku k nahrání.');
      return;
    }

    let targetAlbumId = selectedAlbumIdForUpload;

    try {
      setIsUploading(true);

      if (uploadMode === 'new') {
        if (!newAlbumName.trim()) {
          Alert.alert(t('home.attendance.errorTitle'), 'Zadejte název nového alba.');
          setIsUploading(false);
          return;
        }

        targetAlbumId = await createPhotoAlbum(activeBand.id, {
          bandId: activeBand.id,
          albumName: newAlbumName.trim(),
          date: newAlbumDate.trim(),
          uploadedBy: uploaderName,
          uploadedByUid: currentUser?.uid || 'user',
          coverPhotoUrl: '',
        });
      } else {
        if (!targetAlbumId) {
          Alert.alert(t('home.attendance.errorTitle'), 'Vyberte stávající album ze seznamu.');
          setIsUploading(false);
          return;
        }
      }

      for (let i = 0; i < selectedImageUris.length; i++) {
        setUploadProgressText(`Nahrávám fotku ${i + 1} z ${selectedImageUris.length}...`);
        await uploadPhotoToGallery(activeBand.id, targetAlbumId, selectedImageUris[i], uploaderName, currentUser?.uid || (currentUser as any)?.id);
      }

      setIsUploading(false);
      setShowUploadModal(false);
      setSelectedImageUris([]);
      setNewAlbumName('');
      setUploadProgressText('');
      Alert.alert(t('events.alert.success'), `Úspěšně nahráno ${selectedImageUris.length} fotek!`);
    } catch (e) {
      console.error("Chyba při uploadu fotek:", e);
      setIsUploading(false);
      Alert.alert(t('home.attendance.errorTitle'), 'Nepodařilo se nahrát fotky.');
    }
  };

  // Mazání fotky
  const handleDeletePhoto = (photo: AlbumPhoto) => {
    if (!activeBand || !selectedAlbum) return;

    Alert.alert(
      t('gallery.deletePhotoTitle') || 'Smazat fotku',
      t('gallery.deletePhotoConfirm') || 'Opravdu chcete tuto fotku vymazat z galerie?',
      [
        { text: t('home.misc.cancel'), style: 'cancel' },
        {
          text: t('events.alert.delete'),
          style: 'destructive',
          onPress: async () => {
            setSelectedPhotoForView(null);
            await deletePhotoFromGallery(activeBand.id, selectedAlbum.id, photo.id, photo.storagePath);
          }
        }
      ]
    );
  };

  // Mazání celého alba
  const handleDeleteAlbum = (album: PhotoAlbum) => {
    if (!activeBand) return;

    Alert.alert(
      t('gallery.deleteAlbumTitle') || 'Smazat celé album',
      `Opravdu chcete smazat album "${album.albumName}" včetně všech jeho ${album.photoCount || 0} fotek?`,
      [
        { text: t('home.misc.cancel'), style: 'cancel' },
        {
          text: t('events.alert.delete'),
          style: 'destructive',
          onPress: async () => {
            if (selectedAlbum?.id === album.id) setSelectedAlbum(null);
            await deletePhotoAlbum(activeBand.id, album.id);
          }
        }
      ]
    );
  };

  // Sdílení fotky
  const handleSharePhoto = async (photo: AlbumPhoto) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(photo.downloadUrl);
      } else {
        Alert.alert('Sdílení', `Odkaz na fotku:\n${photo.downloadUrl}`);
      }
    } catch (e) {
      console.error("Chyba při sdílení fotky:", e);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* NÁHLED DETAILU ALBA */}
        {selectedAlbum ? (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Math.max(insets.top, 16), paddingBottom: 12 }}>
              <Pressable style={styles.backBtn} onPress={() => setSelectedAlbum(null)}>
                <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={theme.text} />
                <ThemedText type="smallBold" style={{ marginLeft: 4, fontSize: 13 }}>{t('gallery.albums') || 'Alba'}</ThemedText>
              </Pressable>

              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>
                  {selectedAlbum.albumName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                  {selectedAlbum.date} • {selectedAlbum.uploadedBy}
                </ThemedText>
              </View>

              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#2196f3' }}
                onPress={() => {
                  setUploadMode('existing');
                  setSelectedAlbumIdForUpload(selectedAlbum.id);
                  setShowUploadModal(true);
                }}
              >
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
                <ThemedText type="smallBold" style={{ color: '#fff', marginLeft: 4, fontSize: 13 }}>{t('gallery.addPhotosShort') || 'Fotky'}</ThemedText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.photosGrid}>
              {albumPhotos.map((photo) => (
                <Pressable
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => setSelectedPhotoForView(photo)}
                >
                  <Image source={{ uri: photo.downloadUrl }} style={styles.photoThumb} contentFit="cover" />
                </Pressable>
              ))}

              {albumPhotos.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 40, width: '100%' }}>
                  {t('gallery.noPhotosInAlbum') || 'V tomto albu zatím nejsou žádné fotky.'}
                </ThemedText>
              )}
            </ScrollView>
          </View>
        ) : (
          /* HLAVNÍ PŘEHLED ALB / SLOŽEK */
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Math.max(insets.top, 16), paddingBottom: 12 }}>
              <ThemedText type="subtitle" style={{ fontSize: 22, fontWeight: 'bold' }}>{t('nav.gallery') || 'Fotogalerie'}</ThemedText>

              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#2196f3' }}
                onPress={() => {
                  setUploadMode(albums.length > 0 ? 'existing' : 'new');
                  if (albums.length > 0) setSelectedAlbumIdForUpload(albums[0].id);
                  setShowUploadModal(true);
                }}
              >
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
                <ThemedText type="smallBold" style={{ color: '#fff', marginLeft: 4, fontSize: 13 }}>{t('gallery.addPhotosShort') || 'Fotky'}</ThemedText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.albumsGrid}>
              {albums.map((album) => (
                <Pressable
                  key={album.id}
                  style={[styles.albumCard, { backgroundColor: theme.backgroundElement, borderColor: 'rgba(150,150,150,0.2)' }]}
                  onPress={() => setSelectedAlbum(album)}
                >
                  {album.coverPhotoUrl ? (
                    <Image source={{ uri: album.coverPhotoUrl }} style={styles.albumCover} contentFit="cover" />
                  ) : (
                    <View style={[styles.albumCover, styles.albumCoverPlaceholder]}>
                      <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={40} tintColor={theme.textSecondary} />
                    </View>
                  )}

                  <View style={styles.countBadge}>
                    <SymbolView name={{ ios: 'photo.fill', android: 'image', web: 'image' }} size={12} tintColor="#fff" />
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 11, marginLeft: 3 }}>
                      {album.photoCount || 0}
                    </ThemedText>
                  </View>

                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ThemedText type="subtitle" style={{ fontSize: 15, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
                        {album.albumName}
                      </ThemedText>

                      {(isAdmin || (album.uploadedByUid && (album.uploadedByUid === currentUser?.uid || album.uploadedByUid === (currentUser as any)?.id)) || (album.uploadedBy && album.uploadedBy === uploaderName)) && (
                        <Pressable style={{ padding: 4 }} onPress={() => handleDeleteAlbum(album)}>
                          <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#f44336" />
                        </Pressable>
                      )}
                    </View>

                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, marginTop: 2 }}>
                      📅 {album.date}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 2 }}>
                      👤 Zadal: {album.uploadedBy}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}

              {albums.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 40, width: '100%' }}>
                  {t('gallery.noAlbums') || 'Zatím nebyla vytvořena žádná alba fotogalerie.'}
                </ThemedText>
              )}
            </ScrollView>
          </View>
        )}

        {/* MODAL PRO NAHRÁNÍ FOTEK / VYTVOŘENÍ ALBA */}
        {showUploadModal && (
          <Modal visible={showUploadModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowUploadModal(false)}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText type="subtitle" style={{ fontSize: 18 }}>
                      🖼️ Přidat fotky do Galerie
                    </ThemedText>
                    <Pressable onPress={() => setShowUploadModal(false)} style={{ padding: 4 }}>
                      <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={22} tintColor={theme.text} />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {albums.length > 0 && (
                      <Pressable
                        style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: uploadMode === 'existing' ? '#2196f3' : 'rgba(150,150,150,0.18)', alignItems: 'center' }}
                        onPress={() => setUploadMode('existing')}
                      >
                        <ThemedText type="smallBold" style={{ color: uploadMode === 'existing' ? '#fff' : theme.text }}>{t('gallery.existingAlbum') || 'Do stávajícího alba'}</ThemedText>
                      </Pressable>
                    )}
                    <Pressable
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: uploadMode === 'new' ? '#2196f3' : 'rgba(150,150,150,0.18)', alignItems: 'center' }}
                      onPress={() => setUploadMode('new')}
                    >
                      <ThemedText type="smallBold" style={{ color: uploadMode === 'new' ? '#fff' : theme.text }}>{t('gallery.newAlbum') || 'Vytvořit nové album'}</ThemedText>
                    </Pressable>
                  </View>

                  {uploadMode === 'new' ? (
                    <View style={{ gap: 12, padding: 12, backgroundColor: 'rgba(150,150,150,0.08)', borderRadius: 10 }}>
                      <ThemedText type="smallBold">{t('gallery.albumName') || 'Název nového alba *'}</ThemedText>
                      <TextInput
                        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                        value={newAlbumName}
                        onChangeText={setNewAlbumName}
                        placeholder="Např. Koncert Lucerna..."
                        placeholderTextColor={theme.textSecondary}
                      />
                      <ThemedText type="smallBold">{t('gallery.albumDate') || 'Datum akce *'}</ThemedText>
                      <TextInput
                        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                        value={newAlbumDate}
                        onChangeText={setNewAlbumDate}
                      />
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <ThemedText type="smallBold">{t('gallery.existingAlbum') || 'Vyberte stávající album *'}</ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {albums.map((a) => (
                          <Pressable
                            key={a.id}
                            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: selectedAlbumIdForUpload === a.id ? '#2196f3' : 'rgba(150,150,150,0.18)', borderWidth: 1, borderColor: selectedAlbumIdForUpload === a.id ? '#2196f3' : 'transparent' }}
                            onPress={() => setSelectedAlbumIdForUpload(a.id)}
                          >
                            <ThemedText type="smallBold" style={{ color: selectedAlbumIdForUpload === a.id ? '#fff' : theme.text }}>
                              {a.albumName} ({a.date})
                            </ThemedText>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <View style={{ gap: 8 }}>
                    <Pressable
                      style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onPress={pickImagesFromGallery}
                    >
                      <SymbolView name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }} size={20} tintColor="#2196f3" />
                      <ThemedText type="smallBold" style={{ color: '#2196f3' }}>Vybrat fotky z galerie</ThemedText>
                    </Pressable>
                  </View>

                  {isUploading ? (
                    <ActivityIndicator size="large" color="#2196f3" />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                      <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleUploadPhotos}>
                        <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit & Nahrát</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>
              </SafeAreaView>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* MODAL PRO ZOBRAZENÍ FOTKY NA CELOU OBRAZOVKU (NATIVNÍ PODPORA PRO PINCH ZOOM A SWIPE) */}
        <Modal visible={!!selectedPhotoForView} transparent={true} onRequestClose={() => setSelectedPhotoForView(null)}>
          <ImageViewer
            imageUrls={formattedImages}
            index={activePhotoIndex}
            onCancel={() => setSelectedPhotoForView(null)}
            enableSwipeDown={true}
            onChange={(idx?: number) => {
              if (typeof idx === "number" && albumPhotos[idx]) {
                setSelectedPhotoForView(albumPhotos[idx]);
              }
            }}
            renderHeader={(currentIndex) => {
              const currentPhoto = albumPhotos[currentIndex || 0] || selectedPhotoForView;
              return (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Math.max(insets.top, 16), zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <Pressable onPress={() => setSelectedPhotoForView(null)} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}>
                    <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={22} tintColor="#ffffff" />
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      onPress={async () => {
                        try {
                          const ScreenOrientation = require('expo-screen-orientation');
                          const current = await ScreenOrientation.getOrientationAsync();
                          if (current === ScreenOrientation.Orientation.LANDSCAPE_LEFT || current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT) {
                            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                          } else {
                            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
                          }
                        } catch (e) {}
                      }}
                      style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
                    >
                      <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'screen_rotation', web: 'screen_rotation' }} size={22} tintColor="#ffffff" />
                    </Pressable>
                    {currentPhoto && (isAdmin || (currentPhoto.uploadedBy && currentPhoto.uploadedBy === uploaderName) || ((currentPhoto as any).uploadedByUid && ((currentPhoto as any).uploadedByUid === currentUser?.uid || (currentPhoto as any).uploadedByUid === (currentUser as any)?.id))) && (
                      <Pressable onPress={() => handleDeletePhoto(currentPhoto)} style={{ padding: 6, backgroundColor: 'rgba(244,67,54,0.4)', borderRadius: 20 }}>
                        <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={22} tintColor="#ffffff" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            }}
            renderFooter={(currentIndex) => {
              return (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 12, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <ThemedText type="smallBold" style={{ color: '#ffffff', fontSize: 13 }}>
                    {(currentIndex || 0) + 1} / {albumPhotos.length}
                  </ThemedText>
                </View>
              );
            }}
          />
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.18)',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  albumsGrid: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  albumCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  albumCover: {
    width: '100%',
    height: 160,
  },
  albumCoverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photosGrid: {
    padding: Spacing.four,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 15,
  },
  button: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
