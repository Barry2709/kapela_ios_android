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

    // Aktualizace VŠECH velikostních variant Android Widgetu (2x2, 3x1, 4x1, 5x1)
    if (Platform.OS === 'android') {
      const widgetNames = ['ConcertWidget', 'ConcertWidget3x1', 'ConcertWidget4x1', 'ConcertWidget5x1'];
      for (const widgetName of widgetNames) {
        try {
          await requestWidgetUpdate({
            widgetName,
            renderWidget: () => <ConcertWidget {...data} />,
          });
        } catch (e) {
          // Ignoruje u neplaced widgetů
        }
      }
    }
  } catch (e) {
    console.error("Chyba při aktualizaci widgetů:", e);
  }
};
