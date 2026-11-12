import { formatGoogleDate } from './calendarSyncService';

const getClientId = (): string => {
  return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
};

const getClientSecret = (): string => {
  return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || '';
};

export const getGoogleUserProfileAndCalendar = async (accessToken: string) => {
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();
    return {
      email: userData.email || '',
      name: userData.name || '',
      calendarId: userData.email || '',
    };
  } catch (e) {
    console.error('Chyba při načítání Google profilu:', e);
    return null;
  }
};

export const exchangeCodeForTokens = async (code: string, redirectUri: string) => {
  try {
    const clientId = getClientId();
    const clientSecret = getClientSecret();
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `code=${encodeURIComponent(code)}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code`,
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
      };
    }
    return null;
  } catch (e) {
    console.error('Chyba při výměně OAuth kódu:', e);
    return null;
  }
};

/**
 * Obnoví vypršený Google Access Token pomocí trvalého Refresh Tokenu
 */
export const refreshGoogleAccessToken = async (refreshToken: string): Promise<string | null> => {
  if (!refreshToken) return null;
  try {
    const clientId = getClientId();
    const clientSecret = getClientSecret();
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken.trim())}`,
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      console.log('Google Access Token byl úspěšně obnoven přes Refresh Token!');
      return data.access_token;
    } else {
      console.error('Chyba při obnově Google Access Tokenu:', data);
      return null;
    }
  } catch (e) {
    console.error('Chyba při refresh Google tokenu:', e);
    return null;
  }
};

/**
 * Získá platný token (buď stávající, nebo ho obnoví přes refresh token)
 */
export const getValidAccessToken = async (
  accessToken: string,
  refreshToken?: string
): Promise<string | null> => {
  if (refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if (refreshed) return refreshed;
  }
  return accessToken || null;
};

/**
 * Vytvoří událost v Google Kalendáři přes REST API
 */
export const createGoogleCalendarEventOAuth = async (
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    location?: string;
    description?: string;
    startDateStr: string; // "DD.MM.YYYY"
    startTimeStr?: string; // "HH:MM" nebo nepovinné
    endDateStr?: string;
    endTimeStr?: string;
    isAllDay?: boolean;
  },
  refreshToken?: string
): Promise<string | null> => {
  try {
    const validToken = await getValidAccessToken(accessToken, refreshToken);
    if (!validToken) {
      console.error("Žádný platný Google Token pro zápis akce.");
      return null;
    }

    const startDateTime = formatGoogleDate(event.startDateStr, event.startTimeStr || "00:00");
    const endDateTime = formatGoogleDate(
      event.endDateStr || event.startDateStr,
      event.endTimeStr || event.startTimeStr || "23:59"
    );

    const bodyData = {
      summary: event.summary,
      location: event.location || '',
      description: event.description || '',
      start: {
        dateTime: startDateTime,
        timeZone: 'Europe/Prague',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Europe/Prague',
      },
    };

    const targetCalendar = calendarId ? encodeURIComponent(calendarId.trim()) : 'primary';
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    const data = await res.json();
    if (res.ok && data.id) {
      console.log("Událost úspěšně zapsána do Google Kalendáře! ID:", data.id);
      return data.id;
    } else {
      console.error("Chyba při zápisu do Google Kalendáře:", data);
      return null;
    }
  } catch (e) {
    console.error("Chyba při komunikaci s Google API:", e);
    return null;
  }
};

/**
 * Upraví událost v Google Kalendáři
 */
export const updateGoogleCalendarEventOAuth = async (
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    summary: string;
    location?: string;
    description?: string;
    startDateStr: string;
    startTimeStr?: string;
    endDateStr?: string;
    endTimeStr?: string;
    isAllDay?: boolean;
  },
  refreshToken?: string
): Promise<boolean> => {
  try {
    if (!eventId) return false;
    const validToken = await getValidAccessToken(accessToken, refreshToken);
    if (!validToken) return false;

    const startDateTime = formatGoogleDate(event.startDateStr, event.startTimeStr || "00:00");
    const endDateTime = formatGoogleDate(
      event.endDateStr || event.startDateStr,
      event.endTimeStr || event.startTimeStr || "23:59"
    );

    const bodyData = {
      summary: event.summary,
      location: event.location || '',
      description: event.description || '',
      start: {
        dateTime: startDateTime,
        timeZone: 'Europe/Prague',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Europe/Prague',
      },
    };

    const targetCalendar = calendarId ? encodeURIComponent(calendarId.trim()) : 'primary';
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    return res.ok;
  } catch (e) {
    console.error("Chyba při aktualizaci události v Google Kalendáři:", e);
    return false;
  }
};

/**
 * Smaže událost z Google Kalendáře
 */
export const deleteGoogleCalendarEventOAuth = async (
  accessToken: string,
  calendarId: string,
  eventId: string,
  refreshToken?: string
): Promise<boolean> => {
  try {
    if (!eventId) return false;
    const validToken = await getValidAccessToken(accessToken, refreshToken);
    if (!validToken) return false;

    const targetCalendar = calendarId ? encodeURIComponent(calendarId.trim()) : 'primary';
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${validToken}`,
      },
    });

    return res.ok || res.status === 404;
  } catch (e) {
    console.error("Chyba při mazání události z Google Kalendáře:", e);
    return false;
  }
};
