import * as FileSystem from 'expo-file-system';
import { fixCzechDiacritics } from '@/utils/diacritics';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  iconLink?: string;
}

export const getGoogleDriveAuthUrl = (redirectUri: string): string => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '1044498308891-bptg6sn4u0k1m9e1j1h3m1m01m000000.apps.googleusercontent.com';
  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');

  // prompt=select_account vynutí nativní výběr ze VŠECH Google účtů přihlášených v telefonu
  return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&prompt=select_account&access_type=offline`;
};

export const fetchGoogleDriveFiles = async (accessToken: string, queryStr?: string): Promise<DriveFile[]> => {
  try {
    let q = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
    if (queryStr && queryStr.trim()) {
      const cleanQ = queryStr.trim().replace(/'/g, "\\'");
      q += ` and name contains '${cleanQ}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=50&fields=files(id,name,mimeType,size,iconLink)&orderBy=name`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (data && data.files) {
      return data.files as DriveFile[];
    }
    return [];
  } catch (e) {
    console.error('Chyba při načítání souborů z Google Disku:', e);
    return [];
  }
};

export const downloadGoogleDriveFile = async (accessToken: string, fileId: string, fileName: string) => {
  try {
    const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).Paths?.cache || '';
    const localUri = `${cacheDir}${Date.now()}_${fileName}`;
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const res = await FileSystem.downloadAsync(downloadUrl, localUri, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let textContent = '';
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.chordpro') || lowerName.endsWith('.pro') || lowerName.endsWith('.chopro')) {
      try {
        const readContent = await FileSystem.readAsStringAsync(res.uri);
        textContent = fixCzechDiacritics(readContent);
      } catch (readErr) {
        console.log('Nelze přečíst text souboru:', readErr);
      }
    }

    return {
      uri: res.uri,
      name: fileName,
      textContent,
    };
  } catch (e) {
    console.error('Chyba při stahování souborů z Google Disku:', e);
    return null;
  }
};
