import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { Song, LiveSessionPayload } from '@/types';
import { getSongs, updateSong, subscribeToSongs } from '@/services/firebaseService';
import { liveSyncService } from '@/services/liveSyncService';
import { SongLyricsViewer } from './song-lyrics-viewer';

export function GlobalLiveLyricsModal() {
  const { activeBand, currentUser, activeRoleView } = useAppStore();

  const [songs, setSongs] = useState<Song[]>([]);
  const [songIndex, setSongIndex] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [livePayload, setLivePayload] = useState<LiveSessionPayload | null>(null);

  // Načtení písní kapely
  const loadBandSongs = async () => {
    if (!activeBand?.id) return;
    try {
      const data = await getSongs(activeBand.id);
      setSongs(data);
      return data;
    } catch (e) {
      console.error("Chyba při načítání písní pro Global Live Sync:", e);
      return [];
    }
  };

  useEffect(() => {
    if (activeBand?.id) {
      loadBandSongs();
      const unsubscribeSongs = subscribeToSongs(activeBand.id, (freshSongs) => {
        setSongs(freshSongs);
      });
      return () => {
        unsubscribeSongs();
      };
    } else {
      setSongs([]);
      setShowModal(false);
    }
  }, [activeBand?.id]);

  // Naslouchání pro živé zprávy na pozadí z jakékoliv stránky
  useEffect(() => {
    if (!activeBand?.id) return;

    const unsubscribe = liveSyncService.startListening(activeBand.id, async (payload) => {
      setLivePayload(payload);

      if (payload?.isActive && payload?.activeSongId) {
        // Zjistíme, zda relaci vysílá toto konkrétní zařízení
        let isSelfAdmin = false;
        if (payload.deviceId) {
          isSelfAdmin = payload.deviceId === liveSyncService.deviceId;
        } else {
          // Fallback pro starší verze
          isSelfAdmin = !!(payload.adminUid && payload.adminUid === currentUser?.uid && activeRoleView === 'admin');
        }

        if (!isSelfAdmin) {
          let currentSongs = songs;
          if (currentSongs.length === 0) {
            currentSongs = (await loadBandSongs()) || [];
          }

          const idx = currentSongs.findIndex(s => s.id === payload.activeSongId);
          if (idx !== -1) {
            setSongIndex(idx);
            setShowModal(true);
          }
        }
      } else {
        // Pokud Admin vypnul Live Režim, zavřeme modal
        setShowModal(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeBand?.id, songs, currentUser?.uid, activeRoleView]);

  if (!showModal || songs.length === 0) {
    return null;
  }

  return (
    <Modal visible={showModal} animationType="slide" presentationStyle="fullScreen">
      <View style={{ flex: 1 }}>
        <SongLyricsViewer
          songs={songs}
          initialIndex={songIndex}
          onClose={() => setShowModal(false)}
          onUpdateSong={async (songId, updates) => {
            if (activeBand?.id) {
              await updateSong(activeBand.id, songId, updates);
              loadBandSongs();
            }
          }}
        />
      </View>
    </Modal>
  );
}
