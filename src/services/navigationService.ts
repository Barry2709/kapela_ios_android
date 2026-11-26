import { Alert, Linking, Platform } from 'react-native';
import { getTranslation } from '@/utils/i18n';

export const openNavigationOptions = (location: string) => {
  if (!location || !location.trim()) {
    Alert.alert('Chyba', getTranslation('navigation.errorNoLocation') || 'Místo koncertu není zadané.');
    return;
  }

  const cleanLocation = location.trim();
  const encodedLocation = encodeURIComponent(cleanLocation);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
  const wazeUrl = `https://waze.com/ul?q=${encodedLocation}&navigate=yes`;
  const appleMapsUrl = `maps://?q=${encodedLocation}`;

  const options: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [];

  if (Platform.OS === 'ios') {
    options.push({
      text: '🍏 Apple Maps',
      onPress: () => Linking.openURL(appleMapsUrl).catch(() => Alert.alert('Chyba', 'Nelze otevřít Apple Maps.')),
    });
  }

  options.push({
    text: '🗺️ Google Maps',
    onPress: () => Linking.openURL(googleMapsUrl).catch(() => Alert.alert('Chyba', 'Nelze otevřít Google Maps.')),
  });

  options.push({
    text: '🚗 Waze',
    onPress: () => Linking.openURL(wazeUrl).catch(() => Alert.alert('Chyba', 'Nelze otevřít Waze.')),
  });

  options.push({
    text: getTranslation('navigation.cancel') || 'Zrušit',
    style: 'cancel',
  });

  Alert.alert(
    getTranslation('navigation.title') || '🧭 Navigace na koncert',
    `${getTranslation('navigation.selectPrompt') || 'Vyberte navigaci pro cílové místo:'}\n${cleanLocation}`,
    options,
    { cancelable: true }
  );
};
