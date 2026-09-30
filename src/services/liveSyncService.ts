import { LiveSessionPayload } from '@/types';
import { updateLiveSession, subscribeToLiveSession, stopLiveSession } from './firebaseService';

type LiveSyncCallback = (payload: LiveSessionPayload | null) => void;

class LiveSyncService {
  public readonly deviceId: string = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  private activeBandId: string | null = null;
  private lastHandledTimestamp: number = 0;
  private listeners: Set<LiveSyncCallback> = new Set();
  private firebaseUnsubscribe: (() => void) | null = null;
  private currentLivePayload: LiveSessionPayload | null = null;

  /**
   * Nastaví aktivní kapelu a zahájí naslouchání na pozadí.
   */
  public startListening(bandId: string, callback?: LiveSyncCallback): () => void {
    if (this.activeBandId === bandId && this.firebaseUnsubscribe) {
      if (callback) this.listeners.add(callback);
      if (this.currentLivePayload) callback?.(this.currentLivePayload);
      return () => {
        if (callback) this.listeners.delete(callback);
      };
    }

    this.stopListening();
    this.activeBandId = bandId;
    if (callback) this.listeners.add(callback);

    // 1. Odběr přes Firebase Firestore (Cloud Fallback & Standard)
    this.firebaseUnsubscribe = subscribeToLiveSession(bandId, (payload) => {
      this.handleIncomingPayload(payload, 'cloud');
    });

    return () => {
      if (callback) this.listeners.delete(callback);
    };
  }

  /**
   * Zastaví naslouchání a vyčistí zdroje.
   */
  public stopListening(): void {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
    this.activeBandId = null;
    this.currentLivePayload = null;
    this.listeners.clear();
  }

  /**
   * Vysílání změny písně (voláno Adminem).
   */
  public async broadcastSongChange(
    bandId: string,
    adminUid: string,
    adminName: string | undefined,
    songId: string,
    transpose?: number
  ): Promise<void> {
    const payload: LiveSessionPayload = {
      bandId,
      activeSongId: songId,
      adminUid,
      adminName: adminName || '',
      isActive: true,
      updatedAt: Date.now(),
      transpose: transpose ?? 0,
      deviceId: this.deviceId,
    };

    // Aktualizace lokálního stavu
    this.handleIncomingPayload(payload, 'local');

    // 1. Zápis do Firebase Firestore (spolehlivý přenos)
    try {
      await updateLiveSession(bandId, payload);
    } catch (error) {
      console.error("Chyba při vysílání Live relace do Firebase:", error);
    }
  }

  /**
   * Ukončení živé relace (Admin vypne Live Režim) – kompletní smazání živého záznamu.
   */
  public async endLiveSession(bandId: string): Promise<void> {
    this.lastHandledTimestamp = 0;
    this.currentLivePayload = null;
    this.notifyListeners(null);
    try {
      await stopLiveSession(bandId);
    } catch (error) {
      console.error("Chyba při ukončování Live relace:", error);
    }
  }

  /**
   * Vrátí aktuální živou relaci.
   */
  public getCurrentPayload(): LiveSessionPayload | null {
    return this.currentLivePayload;
  }

  /**
   * Zpracování a arbitráž příchozích zpráv (z LAN i z cloudu).
   */
  private handleIncomingPayload(payload: LiveSessionPayload | null, source: 'local' | 'lan' | 'cloud'): void {
    if (!payload || !payload.isActive) {
      this.currentLivePayload = null;
      this.lastHandledTimestamp = 0;
      this.notifyListeners(null);
      return;
    }

    // Ignorujeme staré zprávy
    if (payload.updatedAt <= this.lastHandledTimestamp && source !== 'local') {
      return;
    }

    this.lastHandledTimestamp = payload.updatedAt;
    this.currentLivePayload = payload;

    this.notifyListeners(payload);
  }

  private notifyListeners(payload: LiveSessionPayload | null): void {
    this.listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (err) {
        console.error("Chyba v LiveSync listeneru:", err);
      }
    });
  }
}

export const liveSyncService = new LiveSyncService();
