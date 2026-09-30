import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PersonalNote {
  id: string;
  text: string;
  xPercent: number;
  yPx: number;
  createdAt: number;
  isAdminNote?: boolean;
}

export interface PersonalSongSetting {
  transpose?: number;
  capo?: number;
  fontSize?: number;
  isAutoFitMode?: boolean;
  isInverted?: boolean;
  notes?: PersonalNote[];
}

const BANDS_COLLECTION = 'kapela_ios_android';

const getStorageKey = (userId: string, songId: string) => {
  const safeUser = (userId || 'default_user').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `@personal_song_${safeUser}_${songId}`;
};

// 1. Načte osobní nastavení tóniny, Capo, písma a auto-fit pro konkrétní píseň člena
export const getPersonalSongSetting = async (
  userId: string,
  bandId: string,
  songId: string
): Promise<PersonalSongSetting | null> => {
  if (!songId) return null;

  try {
    // A) Lokální paměť zařízení (rychlý přístup)
    const localKey = getStorageKey(userId, songId);
    const localJson = await AsyncStorage.getItem(localKey);
    if (localJson) {
      return JSON.parse(localJson) as PersonalSongSetting;
    }

    // B) Firestore (osobní profil člena na cloudu)
    if (userId && bandId) {
      const userRef = doc(db, BANDS_COLLECTION, bandId, 'personalSettings', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data?.songs && data.songs[songId]) {
          const setting = data.songs[songId] as PersonalSongSetting;
          await AsyncStorage.setItem(localKey, JSON.stringify(setting));
          return setting;
        }
      }
    }
  } catch (e) {
    console.log("Chyba při načítání osobního nastavení písně:", e);
  }

  return null;
};

// 2. Uloží osobní nastavení člena (Capo, tónina, písmo) do lokální paměti a synchronizuje na Firebase
export const savePersonalSongSetting = async (
  userId: string,
  bandId: string,
  songId: string,
  setting: PersonalSongSetting
): Promise<void> => {
  if (!songId) return;

  try {
    const localKey = getStorageKey(userId, songId);
    await AsyncStorage.setItem(localKey, JSON.stringify(setting));

    if (userId && bandId) {
      const userRef = doc(db, BANDS_COLLECTION, bandId, 'personalSettings', userId);
      await setDoc(userRef, {
        userId,
        songs: {
          [songId]: setting
        }
      }, { merge: true });
    }
  } catch (e) {
    console.log("Chyba při ukládání osobního nastavení písně:", e);
  }
};
