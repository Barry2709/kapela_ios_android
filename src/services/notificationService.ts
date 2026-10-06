import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

let Notifications: typeof import('expo-notifications') | null = null;

try {
  // Dynamické načtení pro ochranu před pádem v Expo Go SDK 53+ na Androidu
  Notifications = require('expo-notifications');

  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.log("Expo Notifications modul nebylo možné načíst v tomto prostředí (předpoklad: Expo Go v Androidu).");
  Notifications = null;
}

/**
 * Požádá o oprávnění a získá Expo Push Token pro aktuální zařízení.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  // Detekce Expo Go na Androidu (SDK 53+ zakázalo remote notifications v Expo Go)
  const isExpoGo = Constants.appOwnership === 'expo' || (Constants as any).executionEnvironment === 'storeClient';
  if (Platform.OS === 'android' && isExpoGo) {
    console.log("Android Push notifikace vyžadují Development Build (nejsou podporovány v čistém Expo Go od SDK 53).");
    return null;
  }

  if (!Device.isDevice) {
    console.log("Push notifikace fungují pouze na fyzických zařízeních, ne na emulátoru.");
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log("Oprávnění pro Push notifikace nebylo uděleno.");
      return null;
    }

    let projectId = Constants.expoConfig?.extra?.eas?.projectId || (Constants as any).easConfig?.projectId;
    let tokenData;

    try {
      if (projectId) {
        tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      } else {
        tokenData = await Notifications.getExpoPushTokenAsync();
      }
    } catch (e) {
      console.log("Sideloaded iOS verze neobsahuje APNs nárok (vyžaduje placený Apple Developer účet).");
      return null;
    }

    const token = tokenData.data;

    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('kapela_push_v2', {
        name: 'Kapela Notifikace',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e91e63',
        enableVibrate: true,
        showBadge: true,
      });
    }

    return token;
  } catch (error) {
    console.error("Chyba při získávání Push Tokenu:", error);
    return null;
  }
}

/**
 * Odešle Push notifikaci na seznam Expo Push Tokenů přes Expo REST API.
 */
export async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const validTokens = tokens.filter(t => typeof t === 'string' && t.trim().length > 0);
  if (validTokens.length === 0) return;

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data || {},
    priority: 'high',
    channelId: 'kapela_push_v2',
    badge: 1,
    ttl: 86400,
    _displayInForeground: true,
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    console.log("Expo Push server odpověď:", JSON.stringify(result));
  } catch (error) {
    console.error("Chyba při odesílání Push notifikace přes Expo API:", error);
  }
}

/**
 * Nastaví číslo odznaku (badge count) na ikoně aplikace.
 */
export async function updateAppBadgeCount(count: number): Promise<void> {
  if (!Notifications || typeof Notifications.setBadgeCountAsync !== 'function') {
    return;
  }

  try {
    const safeCount = Math.max(0, count);
    await Notifications.setBadgeCountAsync(safeCount);
  } catch (error) {
    console.log("Nepodařilo se nastavit odznak na ikoně aplikace:", error);
  }
}

/**
 * Spustí okamžitou místní systémovou notifikaci (banner + zvuk + odznak) přes expo-notifications.
 */
export async function triggerLocalSystemNotification(
  title: string,
  body: string,
  badgeCount?: number
): Promise<void> {
  if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
    return;
  }

  try {
    if (typeof badgeCount === 'number') {
      await updateAppBadgeCount(badgeCount);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        badge: typeof badgeCount === 'number' ? badgeCount : undefined,
      },
      trigger: null,
    });
  } catch (error) {
    console.log("Nepodařilo se zobrazit místní notifikaci:", error);
  }
}
