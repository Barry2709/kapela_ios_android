import React from 'react';
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

    // Požádat o aktualizaci Android widgetu
    try {
      await requestWidgetUpdate({
        widgetName: 'ConcertWidget',
        renderWidget: () => <ConcertWidget {...data} />,
      });
    } catch (e) {
      // Ignoruje v případě, že widget ještě není na ploše nebo jsme na iOS
    }
  } catch (e) {
    console.error("Chyba při aktualizaci widgetu:", e);
  }
};
