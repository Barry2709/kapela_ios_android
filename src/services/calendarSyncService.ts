import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const getSyncCalendarId = async (bandId: string) => {
  return await AsyncStorage.getItem(`syncCalendarId_${bandId}`);
};

export const setSyncCalendarId = async (bandId: string, calendarId: string) => {
  if (calendarId) {
    await AsyncStorage.setItem(`syncCalendarId_${bandId}`, calendarId);
  } else {
    await AsyncStorage.removeItem(`syncCalendarId_${bandId}`);
  }
};

export const getAvailableCalendars = async (): Promise<any[]> => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status === 'granted') {
    // Android sometimes requires explicit REMINDERS/WRITE permissions, but expo-calendar combines it into requestCalendarPermissionsAsync.
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    // Na Androidu jsou někdy kalendáře defaultně allowModifications false, i když zapisovat jdou. iOS je striktnější.
    return calendars.filter(c => Platform.OS === 'android' ? true : c.allowsModifications);
  }
  return [];
};

const findEventByFirebaseId = async (calendarId: string, firebaseId: string, startDate: Date, endDate: Date) => {
  // Prohledáme bezpečné okno půl roku zpět a dopředu
  const start = new Date(startDate);
  start.setMonth(start.getMonth() - 6);
  const end = new Date(endDate);
  end.setMonth(end.getMonth() + 6);
  const events = await Calendar.getEventsAsync([calendarId], start, end);
  return events.find(e => e.notes && e.notes.includes(`[KAPELA_APP_ID:${firebaseId}]`));
};

export const syncEventToLocalCalendar = async (
  bandId: string,
  firebaseId: string,
  title: string,
  startDate: Date,
  endDate: Date,
  location?: string,
  notes?: string,
  isAllDay: boolean = false
) => {
  try {
    const calId = await getSyncCalendarId(bandId);
    if (!calId) return;

    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted') {
      const { status: reqStatus } = await Calendar.requestCalendarPermissionsAsync();
      if (reqStatus !== 'granted') return;
    }

    const combinedNotes = `${notes ? notes + '\n\n' : ''}[KAPELA_APP_ID:${firebaseId}]`;
    const existingEvent = await findEventByFirebaseId(calId, firebaseId, startDate, endDate);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';

    const eventDetails: any = {
      title,
      startDate,
      endDate,
      location: location || '',
      notes: combinedNotes,
      allDay: isAllDay,
      timeZone: tz,
      endTimeZone: tz,
    };

    if (existingEvent) {
      await Calendar.updateEventAsync(existingEvent.id, eventDetails);
    } else {
      await Calendar.createEventAsync(calId, eventDetails);
    }
  } catch (e) {
    console.error("Chyba při synchronizaci s kalendářem zařízení:", e);
  }
};

export const deleteEventFromLocalCalendar = async (bandId: string, firebaseId: string, searchDate: Date) => {
  try {
    const calId = await getSyncCalendarId(bandId);
    if (!calId) return;

    const start = new Date(searchDate); start.setMonth(start.getMonth() - 6);
    const end = new Date(searchDate); end.setMonth(end.getMonth() + 6);
    const existingEvent = await findEventByFirebaseId(calId, firebaseId, start, end);
    if (existingEvent) {
      await Calendar.deleteEventAsync(existingEvent.id);
    }
  } catch (e) {
    console.error("Chyba při mazání události z kalendáře:", e);
  }
};

export const parseEventDate = (dateStr: string, timeStr?: string): Date => {
  const [d, m, y] = dateStr.split('.');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (timeStr) {
    const [hh, mm] = timeStr.split(':');
    date.setHours(Number(hh), Number(mm), 0, 0);
  } else {
    date.setHours(12, 0, 0, 0);
  }
  return date;
};


export const formatGoogleDate = (dateStr: string, timeStr?: string) => {
  let d: string = '01', m: string = '01', y: string = '2025';
  const cleanDateStr = (dateStr || '').trim();
  if (cleanDateStr.includes('.')) {
    const parts = cleanDateStr.split('.');
    d = (parts[0] || '').trim().padStart(2, '0');
    m = (parts[1] || '').trim().padStart(2, '0');
    y = (parts[2] || '').trim();
  } else if (cleanDateStr.includes('-')) {
    const parts = cleanDateStr.split('-');
    y = (parts[0] || '').trim();
    m = (parts[1] || '').trim().padStart(2, '0');
    d = (parts[2] || '').trim().padStart(2, '0');
  }

  const isoDate = `${y}-${m}-${d}`;
  if (timeStr && timeStr.trim()) {
    const timeParts = timeStr.trim().split(':');
    const hh = (timeParts[0] || '00').trim().padStart(2, '0');
    const mm = (timeParts[1] || '00').trim().padStart(2, '0');
    return {
      dateTime: `${isoDate}T${hh}:${mm}:00`,
      timeZone: 'Europe/Prague',
    };
  }
  return {
    date: isoDate,
  };
};


export const openInGoogleCalendarPrefilled = (eventData: {
  title: string;
  location?: string;
  notes?: string;
  startDateStr: string;
  startTimeStr?: string;
  endDateStr?: string;
  endTimeStr?: string;
  isAllDay?: boolean;
  calendarEmail?: string;
}) => {
  try {
    const { Linking, Platform } = require('react-native');
    const start = parseEventDate(eventData.startDateStr, eventData.startTimeStr);
    let end = eventData.endDateStr ? parseEventDate(eventData.endDateStr, eventData.endTimeStr) : new Date(start);

    if (!eventData.endTimeStr && !eventData.isAllDay) {
      end.setHours(start.getHours() + 2);
    }

    // 1. NA ANDROIDU OTEVŘEME NATIVNÍ APLIKACI GOOGLE KALENDÁŘ PŘES INTENT S CÍLOVÝM ÚČTEM
    if (Platform.OS === 'android') {
      try {
        const IntentLauncher = require('expo-intent-launcher');
        const extras: any = {
          title: eventData.title,
          eventLocation: eventData.location || '',
          description: eventData.notes || '',
          beginTime: start.getTime(),
          endTime: end.getTime(),
          allDay: !!eventData.isAllDay,
        };

        if (eventData.calendarEmail && eventData.calendarEmail.trim()) {
          const calEmail = eventData.calendarEmail.trim();
          extras.account_name = calEmail;
          extras.account_type = 'com.google';
        }

        IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
          data: 'content://com.android.calendar/events',
          extra: extras
        }).catch(() => {
          openWebCalendarFallback(eventData, start, end);
        });
        return;
      } catch (e) {
        console.error("IntentLauncher error, using fallback:", e);
      }
    }

    // 2. iOS NEBO FALLBACK PRO WEBOVÝ KALENDÁŘ S PARAMETREM SRC A ADD
    openWebCalendarFallback(eventData, start, end);
  } catch (e) {
    console.error("Chyba při otevírání kalendářové aplikace:", e);
  }
};

const openWebCalendarFallback = (eventData: any, start: Date, end: Date) => {
  const { Linking } = require('react-native');
  const formatIsoUtc = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
  const startIso = formatIsoUtc(start);
  const endIso = formatIsoUtc(end);

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(eventData.title)}` +
    `&dates=${startIso}/${endIso}` +
    `&details=${encodeURIComponent(eventData.notes || '')}` +
    `&location=${encodeURIComponent(eventData.location || '')}`;

  if (eventData.calendarEmail && eventData.calendarEmail.trim()) {
    const calEmail = eventData.calendarEmail.trim();
    url += `&add=${encodeURIComponent(calEmail)}`;
    url += `&src=${encodeURIComponent(calEmail)}`;
  }

  Linking.openURL(url).catch((err: any) => console.error("Nelze otevřít kalendář:", err));
};

export const openGoogleCalendarAtDate = (dateStr: string, calendarEmail?: string) => {
  try {
    const { Linking, Platform } = require('react-native');
    const start = parseEventDate(dateStr);

    if (Platform.OS === 'android') {
      try {
        const IntentLauncher = require('expo-intent-launcher');
        IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: `content://com.android.calendar/time/${start.getTime()}`,
        }).catch(() => {
          openWebCalendarDateFallback(dateStr);
        });
        return;
      } catch (e) {
        console.error("IntentLauncher error:", e);
      }
    }

    openWebCalendarDateFallback(dateStr);
  } catch (e) {
    console.error("Chyba při otevírání kalendáře na datu:", e);
  }
};

const openWebCalendarDateFallback = (dateStr: string) => {
  const { Linking } = require('react-native');
  const start = parseEventDate(dateStr);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');

  const url = `https://calendar.google.com/calendar/r/day/${y}/${m}/${d}`;
  Linking.openURL(url).catch((err: any) => console.error("Nelze otevřít kalendář na datu:", err));
};
