import * as FileSystem from 'expo-file-system';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { Song } from '@/types';
import { fixCzechDiacritics } from '@/utils/diacritics';

const getCacheDir = () => `${(FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || ''}zpevnik_plus_cache/`;
const getIndexFilePath = () => `${(FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || ''}zpevnik_plus_index.json`;

// Načíst lokální index písní uložený v zařízení
export const getLocalZpevnikPlusIndex = async (): Promise<Song[]> => {
  try {
    const indexPath = getIndexFilePath();
    const info = await FileSystem.getInfoAsync(indexPath);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(indexPath);
      return JSON.parse(content) as Song[];
    }
  } catch (e) {
    console.error('Chyba při čtení lokálního indexu Zpěvníku+:', e);
  }
  return [];
};

// Uložit aktualizovaný index písní v zařízení
export const saveLocalZpevnikPlusIndex = async (songs: Song[]): Promise<void> => {
  try {
    const indexPath = getIndexFilePath();
    await FileSystem.writeAsStringAsync(indexPath, JSON.stringify(songs));
  } catch (e) {
    console.error('Chyba při ukládání lokálního indexu Zpěvníku+:', e);
  }
};

// Při otevření písničky stáhnout aktuální verzi z Firebase Storage, přepsat lokální verzi a vrátit text
export const fetchAndCacheSongLyrics = async (song: Song): Promise<string> => {
  const fileName = song.fileName || (song.id.startsWith('storage_') ? song.id.replace('storage_', '') : `${song.title}.chordpro`);
  const cacheDir = getCacheDir();
  const localFilePath = `${cacheDir}${fileName}`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true } as any);
    }
  } catch (e) {}

  // 1. ONLINE: Pokusit se stáhnout nejnovější verzi z Firebase Storage Zpevnik_plus
  if (fileName) {
    try {
      const storageRef = ref(storage, `Zpevnik_plus/${fileName}`);
      const downloadUrl = await getDownloadURL(storageRef);
      const response = await fetch(downloadUrl);

      if (response.ok) {
        const rawText = await response.text();
        const cleanText = fixCzechDiacritics(rawText);

        // Nahradit verzi v zařízení nově staženým souborem
        await FileSystem.writeAsStringAsync(localFilePath, cleanText);
        return cleanText;
      }
    } catch (onlineErr) {
      console.log(`[Offline / Offline režim] Používám uloženou lokální verzi pro ${fileName}`);
    }
  }

  // 2. OFFLINE FALLBACK: Použít uloženou verzi v zařízení
  try {
    const fileInfo = await FileSystem.getInfoAsync(localFilePath);
    if (fileInfo.exists) {
      const cachedText = await FileSystem.readAsStringAsync(localFilePath);
      return fixCzechDiacritics(cachedText);
    }
  } catch (offlineErr) {
    console.error('Chyba při čtení lokální verze ze zařízení:', offlineErr);
  }

  return song.lyrics || '';
};
