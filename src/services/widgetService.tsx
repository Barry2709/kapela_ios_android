import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ConcertWidget } from '../widgets/ConcertWidget';

export const updateAppWidget = async (concert: {
  bandName?: string;
  title?: string;
  date?: string;
  startTime?: string;
  location?: string;
} | null) => {
  try {
    if (!concert) {
      await AsyncStorage.removeItem('widgetConcertData');
      return;
    }

    const data = {
      bandName: concert.bandName || 'Kapela',
      concertTitle: concert.title || 'Nadcházející koncert',
      dateStr: concert.date || '',
      timeStr: concert.startTime || '',
      locationStr: concert.location || '',
    };

    await AsyncStorage.setItem('widgetConcertData', JSON.stringify(data));

    // A) Aktualizace Android Widgetu
    if (Platform.OS === 'android') {
      try {
        await requestWidgetUpdate({
          widgetName: 'ConcertWidget',
          renderWidget: () => <ConcertWidget {...data} />,
        });
      } catch (e) {
        // Ignoruje v případě, že widget ještě není na ploše
      }
    }

    // B) Aktualizace iOS WidgetExtension přes App Group
    if (Platform.OS === 'ios') {
      try {
        const WidgetExtension = require('react-native-widget-extension');
        if (WidgetExtension && WidgetExtension.setItem) {
          await WidgetExtension.setItem('widgetConcertData', JSON.stringify(data), 'group.com.ios.kapela');
        }
      } catch (e) {
        // Ignoruje na iOS simulátorech nebo pokud AppGroup není aktivní
      }
    }
  } catch (e) {
    console.error("Chyba při aktualizaci widgetu:", e);
  }
};
