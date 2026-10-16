import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, Animated, PanResponder, ScrollView, Platform, ActivityIndicator, Linking, NativeModules } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { PDFDocument } from 'pdf-lib';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Band, BandMember, StageplanMember, Concert } from '@/types';
import { uploadImageToStorage, updateBand } from '@/services/firebaseService';

interface Props {
  visible: boolean;
  onClose: () => void;
  band: Band;
  members: BandMember[];
  onSave: (stageplan: StageplanMember[]) => void;
  concert?: Concert;
}

export const getMemberTechBadges = (m: BandMember): string[] => {
  const badges: string[] = [];
  if (!m || !m.tech) return badges;

  // 1. Přidat přesně a pouze ty položky technického setupu, které má člen zaškrtnuté ve svém profilu
  if (m.tech.customTech && typeof m.tech.customTech === 'object') {
    Object.entries(m.tech.customTech).forEach(([key, val]) => {
      if (val) {
        const cleanVal = key.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        if (cleanVal && !badges.includes(cleanVal)) {
          badges.push(cleanVal);
        }
      }
    });
  }

  // 2. Pokud nemá žádné customTech položky, zobrazíme základní zaškrtnuté přepínače
  if (badges.length === 0) {
    if (m.tech.mic) badges.push('Zpěv mic');
    if (m.tech.instrumentMic) badges.push('Nástroj mic');
    if (m.tech.comboXlr || m.tech.xlr) badges.push('Combo XLR');
    if (m.tech.comboJack || m.tech.jack) badges.push('Jack 6.3mm');
    if (m.tech.wirelessMonitor || m.tech.monitor) badges.push('IN-EAR');
    if (m.tech.power230V) badges.push('230V');
    if (m.tech.pedalboard) badges.push('Pedalboard');
  }

  return badges;
};

// Generování A4 1-stránkové HTML šablony pro PDF Stageplanu & Rideru
export function generatePdfHtmlForBand(band: Band, concert?: Concert, members: BandMember[] = []): string {
  const bandName = band?.name || 'Naplech';
  const concertTitle = concert?.title || 'Koncert / Akce';
  const concertDate = concert?.date || '';
  const concertLocation = concert?.location || '';
  const concertTime = concert?.startTime ? `v ${concert.startTime}` : '';

  // Kontakty pořadatelů
  let orgsHtml = '';
  if (concert?.organizers && Array.isArray(concert.organizers) && concert.organizers.length > 0) {
    orgsHtml = `
      <div style="margin-top: 10px;">
        <h3 style="margin-bottom: 4px; color: #1877f2; border-bottom: 2px solid #1877f2; padding-bottom: 2px; font-size: 12px;">Kontakty na pořadatele a zvukaře:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 3px;">
          <thead>
            <tr style="background: #eef3fb;">
              <th style="border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px;">Role</th>
              <th style="border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px;">Jméno</th>
              <th style="border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px;">Telefon</th>
              <th style="border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px;">E-mail</th>
            </tr>
          </thead>
          <tbody>
            ${concert.organizers.map(o => `
              <tr>
                <td style="border: 1px solid #ccc; padding: 3px 6px; font-weight: bold; font-size: 10px;">${o?.role || 'Kontakt'}</td>
                <td style="border: 1px solid #ccc; padding: 3px 6px; font-size: 10px;">${o?.name || ''}</td>
                <td style="border: 1px solid #ccc; padding: 3px 6px; font-size: 10px;">${o?.phone || '-'}</td>
                <td style="border: 1px solid #ccc; padding: 3px 6px; font-size: 10px;">${o?.email || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (concert?.contacts) {
    orgsHtml = `
      <div style="margin-top: 10px;">
        <h3 style="margin-bottom: 4px; color: #1877f2; font-size: 12px;">Kontakty na pořadatele:</h3>
        <p style="font-size: 10px; margin: 0; background: #f5f5f5; padding: 6px; border-radius: 4px;">${concert.contacts}</p>
      </div>
    `;
  }

  const safeMembers = Array.isArray(members) ? members : [];
  const safeStageplan = Array.isArray(band?.stageplan) ? band.stageplan : [];

  const isMemberMatch = (m: BandMember, stageMemberId: string) => {
    if (!m || !stageMemberId) return false;
    return (
      m.id === stageMemberId ||
      (m as any).memberId === stageMemberId ||
      (m as any).uid === stageMemberId ||
      String(m.id) === String(stageMemberId)
    );
  };

  // Členové na stagi HTML (požadavky svisle pod sebou bez překrývání)
  const pinsHtml = safeStageplan.map(s => {
    const mem = safeMembers.find(m => isMemberMatch(m, s.memberId));
    if (!mem) return '';
    const badges = getMemberTechBadges(mem);
    return `
      <div style="position: absolute; left: ${s.x || 50}%; top: ${s.y || 50}%; transform: translate(-50%, -50%); background: #2196f3; color: white; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.25); border: 1px solid #1976d2; min-width: 55px; white-space: nowrap; z-index: 10;">
        <strong style="font-size: 11px;">${mem.nickname || mem.firstName || 'Člen'}</strong><br>
        <span style="font-size: 9px; color: #e8f5e9; font-weight: bold;">${mem.instrument || ''}</span>
        <div style="font-size: 8px; font-weight: normal; opacity: 0.95; margin-top: 1px; line-height: 1.05;">
          ${badges.map(b => `<div>${b}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Součet počtu jednotlivých technických položek na stagi
  const techCounts: Record<string, number> = {};
  safeMembers
    .filter(m => safeStageplan.some(s => isMemberMatch(m, s.memberId)))
    .forEach(m => {
      const badges = getMemberTechBadges(m);
      badges.forEach(badge => {
        techCounts[badge] = (techCounts[badge] || 0) + 1;
      });
    });

  if (band?.techRiderPresets && Array.isArray(band.techRiderPresets)) {
    band.techRiderPresets.forEach(preset => {
      if (!techCounts[preset]) {
        techCounts[preset] = 1;
      }
    });
  }

  const techCountsHtml = Object.entries(techCounts).map(([item, count]) => `
    <span style="background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; display: inline-block; margin-bottom: 3px;">
      ✔ ${item} (${count}x)
    </span>
  `).join('');

  // Technické požadavky jednotlivých muzikantů
  const memberTechListHtml = safeMembers
    .filter(m => safeStageplan.some(s => isMemberMatch(m, s.memberId)))
    .map(m => {
      const badges = getMemberTechBadges(m);
      const nickname = m.nickname || m.firstName || 'Člen';
      const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim();
      return `
        <div style="background: #f8f9fa; border: 1px solid #e0e0e0; padding: 6px 10px; border-radius: 6px; width: 48%; box-sizing: border-box; margin-bottom: 6px;">
          <div style="font-size: 12px; font-weight: bold; color: #1976d2;">${nickname}</div>
          <div style="font-size: 9px; color: #666; margin-bottom: 2px;">${fullName}</div>
          <div style="font-size: 10px; font-weight: bold; color: #2e7d32; margin-bottom: 2px;">${m.instrument || ''}</div>
          <div style="font-size: 9px; color: #444; line-height: 1.2;">
            ${badges.map(b => `<div>• ${b}</div>`).join('')}
          </div>
        </div>
      `;
    }).join('');

  const cleanBandName = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${cleanBandName}_stageplan</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 8px; color: #222; margin: 0; box-sizing: border-box; }
        .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2196f3; padding-bottom: 6px; margin-bottom: 8px; }
        .band-title { font-size: 20px; font-weight: bold; color: #111; margin: 0; }
        .concert-info { font-size: 12px; color: #444; margin-top: 2px; }
        .stage-container { width: 100%; height: 190px; border: 2px solid #333; background: #fdfdfd; position: relative; margin: 8px 0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
        .stage-front { position: absolute; bottom: 0; left: 0; right: 0; background: #333; color: white; text-align: center; padding: 3px 0; font-size: 9px; font-weight: bold; letter-spacing: 1px; }
        .footer { margin-top: 10px; font-size: 9px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div>
          <h1 class="band-title">${bandName}</h1>
          <div class="concert-info">
            <strong>${concertTitle}</strong> ${concertDate ? `• ${concertDate}` : ''} ${concertTime} ${concertLocation ? `(${concertLocation})` : ''}
          </div>
        </div>
        <div style="font-size: 10px; text-align: right; color: #666;">
          Stageplan & Technický Rider<br>
          <em>Aplikace Kapela</em>
        </div>
      </div>

      <h3 style="margin-bottom: 3px; color: #111; font-size: 12px;">Pódiové rozmístění členů (Stageplan):</h3>
      <div class="stage-container">
        ${pinsHtml}
        <div class="stage-front">▼ PŘEDNÍ HRANA PÓDIA / HLAVNÍ ZVUK (PA) ▼</div>
      </div>

      <div style="margin-top: 8px;">
        <h3 style="margin-bottom: 3px; color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 2px; font-size: 12px;">Požadavky na techniku & zvukaře (Souhrn položek):</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; margin-bottom: 6px;">
          ${techCountsHtml}
        </div>
      </div>

      <div style="margin-top: 8px;">
        <h3 style="margin-bottom: 3px; color: #1976d2; font-size: 12px;">Technické požadavky jednotlivých muzikantů:</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${memberTechListHtml}
        </div>
      </div>

      ${orgsHtml}

      <div class="footer">
        Tento dokument obsahuje oficiální Stageplan a Technický Rider kapely ${bandName}.
      </div>
    </body>
    </html>
  `;
}

// Helper který musíme posunout nahoru kvůli dosahu
let globalPrintModule: any = null;
let globalFileSystemModule: any = null;

const getNativePrintModule = () => {
  if (globalPrintModule) return globalPrintModule;
  try {
    globalPrintModule = require('expo-print');
    return globalPrintModule;
  } catch (e) {
    return null;
  }
};

const getFileSystemModule = () => {
  if (globalFileSystemModule) return globalFileSystemModule;
  try {
    globalFileSystemModule = require('expo-file-system');
    return globalFileSystemModule;
  } catch (e) {
    return null;
  }
};

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
  base64Lookup[base64Chars.charCodeAt(i)] = i;
}

function base64ToBytes(base64: string): Uint8Array {
  let len = base64.length;
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = base64Lookup[base64.charCodeAt(i)];
    const encoded2 = base64Lookup[base64.charCodeAt(i + 1)];
    const encoded3 = base64Lookup[base64.charCodeAt(i + 2)];
    const encoded4 = base64Lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64 && p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64 && p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    base64 += base64Chars[b1 >> 2];
    base64 += base64Chars[((b1 & 3) << 4) | (b2 >> 4)];
    base64 += i + 1 < len ? base64Chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    base64 += i + 2 < len ? base64Chars[b3 & 63] : '=';
  }
  return base64;
}

const getPdfFileName = (bandName: string): string => {
  const cleanBand = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanBand}_stageplan.pdf`;
};

// Pomocná funkce pro vygenerování a uložení PDF souboru do zařízení pod čistým názvem
export const generateNamedPdfFile = async (html: string, bandName: string, concertTitle?: string): Promise<{ pdfUri: string; fileName: string }> => {
  const printModule = getNativePrintModule();
  if (!printModule || !printModule.printToFileAsync) {
    throw new Error("Modul pro generování PDF není k dispozici.");
  }

  const cleanBandName = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanBandName}_stageplan.pdf`;

  // 1. Tiskový modul vygeneruje dočasné PDF
  const { uri } = await printModule.printToFileAsync({ html, fileName: `${cleanBandName}_stageplan` });

  const fileSystemModule = getFileSystemModule();

  if (fileSystemModule) {
    let finalBase64 = '';

    // 2. Použijeme pdf-lib s bezpečnou Hermes konverzí pro přepsání vnitřních binárních metadat /Title na čisté jméno
    try {
      const base64Input = await fileSystemModule.readAsStringAsync(uri, { encoding: fileSystemModule.EncodingType.Base64 });
      const pdfBytes = base64ToBytes(base64Input);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.setTitle(fileName);
      pdfDoc.setSubject(`Stageplan ${bandName}`);
      pdfDoc.setProducer('Kapela App');
      pdfDoc.setCreator('Kapela App');
      const savedBytes = await pdfDoc.save();
      finalBase64 = bytesToBase64(savedBytes);
      console.log("PDF vnitřní binární metadata /Title úspěšně přepsána na:", fileName);
    } catch (pdfLibErr) {
      console.log("Přepsání PDF metadat přes pdf-lib selhalo:", pdfLibErr);
    }

    let savedUri = uri;

    // 3. Uložíme čistě do složky Dokumenty v zařízení
    if (fileSystemModule.documentDirectory) {
      const docPath = `${fileSystemModule.documentDirectory}${fileName}`;
      try {
        try { await fileSystemModule.deleteAsync(docPath, { idempotent: true }); } catch (e) {}
        if (finalBase64) {
          await fileSystemModule.writeAsStringAsync(docPath, finalBase64, { encoding: fileSystemModule.EncodingType.Base64 });
        } else {
          await fileSystemModule.copyAsync({ from: uri, to: docPath });
        }
        savedUri = docPath;
        console.log("PDF s ošetřenými binárními metadaty uloženo do Dokumentů:", docPath);
      } catch (err) {
        console.log("Zápis do documentDirectory selhal:", err);
      }
    }

    // 4. Uložíme i do složky Cache v zařízení
    if (fileSystemModule.cacheDirectory) {
      const cachePath = `${fileSystemModule.cacheDirectory}${fileName}`;
      try {
        try { await fileSystemModule.deleteAsync(cachePath, { idempotent: true }); } catch (e) {}
        if (finalBase64) {
          await fileSystemModule.writeAsStringAsync(cachePath, finalBase64, { encoding: fileSystemModule.EncodingType.Base64 });
        } else {
          await fileSystemModule.copyAsync({ from: uri, to: cachePath });
        }
        if (!savedUri || savedUri === uri) savedUri = cachePath;
      } catch (err) {
        console.log("Zápis do cacheDirectory selhal:", err);
      }
    }

    // 5. Zaregistrujeme soubor napřímo do veřejného úložiště telefonu (Media Library)
    try {
      let mediaLibraryModule: any = null;
      try { mediaLibraryModule = require('expo-media-library'); } catch (e) {}

      if (mediaLibraryModule && savedUri) {
        const { status } = await mediaLibraryModule.requestPermissionsAsync();
        if (status === 'granted') {
          await mediaLibraryModule.createAssetAsync(savedUri);
          console.log("PDF nahráno do Media Library pod čistým názvem.");
        }
      }
    } catch (e) {
      console.log("MediaStore uložení selhalo:", e);
    }

    // 6. Smažeme původní dočasný soubor z tiskárny s náhodným ID
    try {
      await fileSystemModule.deleteAsync(uri, { idempotent: true });
    } catch (e) {}

    return { pdfUri: savedUri, fileName };
  }

  return { pdfUri: uri, fileName };
};

// Pomocné funkce pro sdílení Obrázku a Textu
export const shareImageWithText = async (imageUri: string, text: string) => {
  try {
    let clipboardModule: any = null;
    try { clipboardModule = require('expo-clipboard'); } catch (e) {}
    if (clipboardModule && clipboardModule.setStringAsync) {
      await clipboardModule.setStringAsync(text);
    }

    if (Platform.OS === 'android') {
      let fileSystemModule: any = null;
      try { fileSystemModule = require('expo-file-system'); } catch (e) {}
      if (fileSystemModule && fileSystemModule.getContentUriAsync) {
        const contentUri = await fileSystemModule.getContentUriAsync(imageUri);
        const intentLauncher = require('expo-intent-launcher');
        await intentLauncher.startActivityAsync('android.intent.action.SEND', {
          type: 'image/png',
          extra: {
            'android.intent.extra.STREAM': contentUri,
            'android.intent.extra.TEXT': text,
          },
          flags: 1,
        });
        return;
      }
    }

    let sharingModule: any = null;
    try {
      const nativeModule = requireOptionalNativeModule('ExpoSharing');
      if (nativeModule) sharingModule = require('expo-sharing');
    } catch (e) {}

    if (sharingModule && sharingModule.shareAsync) {
      await sharingModule.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: text,
        UTI: 'public.png',
      });
    }
  } catch (e) {
    console.error("Chyba při sdílení:", e);
  }
};

const openWhatsAppWithImage = async (phone: string, imageUri: string, text: string) => {
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 9) cleanPhone = '420' + cleanPhone;

  let clipboardModule: any = null;
  try { clipboardModule = require('expo-clipboard'); } catch (e) {}
  if (clipboardModule && clipboardModule.setStringAsync) {
    await clipboardModule.setStringAsync(text);
  }

  if (Platform.OS === 'android') {
    let fileSystemModule: any = null;
    try { fileSystemModule = require('expo-file-system'); } catch (e) {}
    if (fileSystemModule && fileSystemModule.getContentUriAsync) {
      try {
        const contentUri = await fileSystemModule.getContentUriAsync(imageUri);
        const intentLauncher = require('expo-intent-launcher');
        await intentLauncher.startActivityAsync('android.intent.action.SEND', {
          type: 'image/png',
          packageName: 'com.whatsapp',
          extra: {
            'android.intent.extra.STREAM': contentUri,
            'android.intent.extra.TEXT': text,
            'jid': `${cleanPhone}@s.whatsapp.net`
          },
          flags: 1,
        });
        return;
      } catch (e) {
        console.log("Cílený WhatsApp intent selhal, pád do záložního:", e);
      }
    }
  }

  // iOS a záložní řešení: Využijeme sdílení napřímo
  let sharingModule: any = null;
  try {
    const nativeModule = requireOptionalNativeModule('ExpoSharing');
    if (nativeModule) sharingModule = require('expo-sharing');
  } catch (e) {}

  if (sharingModule && sharingModule.shareAsync) {
    await sharingModule.shareAsync(imageUri, {
      mimeType: 'image/png',
      dialogTitle: text,
      UTI: 'public.png',
    });
  }
};

// Pomocná metoda pro vygenerování PNG z neviditelného (off-screen) Stageplanu z akce
export const generateOffscreenStageplanImage = async (band: Band, members: BandMember[]) => {
    // V této chvíli z akce nemáme nakreslené Views (nejsme v okně),
    // takže spoléháme na sdílení vygenerovaného PDF jako primární přílohy
    // a přikládání případného naposledy uloženého PNG ze zálohy na disku.
};

// Přímé sdílení Stageplanu z karty koncertu s podporou WhatsApp na telefonní číslo a e-mailu na pořadatele
export async function shareConcertStageplan({
  band,
  concert,
  members = [],
  currentUser,
}: {
  band: Band;
  concert?: Concert;
  members: BandMember[];
  currentUser: any;
}) {
  try {
    const bandName = band?.name || 'Naplech';
    const cleanBand = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfFileName = `${cleanBand}_stageplan.pdf`;

    // 1. Zjištění jména odesílatele
    const senderMember = (members || []).find(m =>
      (currentUser?.memberId && m.id === currentUser.memberId) ||
      (currentUser?.id && m.id === currentUser.id) ||
      ((m as any).uid && currentUser?.id && (m as any).uid === currentUser.id) ||
      (currentUser?.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser?.displayName && m.nickname && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase())
    );
    const senderName = senderMember
      ? `${senderMember.firstName || ''} ${senderMember.lastName || ''}`.trim()
      : (currentUser?.displayName || 'Člen kapely');

    // 2. Kontakty z akce
    const emails = concert?.organizers
      ? concert.organizers.map(o => o.email).filter(Boolean) as string[]
      : [];

    const phoneContacts = concert?.organizers
      ? concert.organizers
          .filter(o => o.phone && o.phone.trim().length > 0)
          .map(o => ({
            name: o.name || o.role || 'Kontakt',
            role: o.role || 'Pořadatel',
            phone: o.phone!.replace(/[^0-9+]/g, '')
          }))
      : [];

    if (phoneContacts.length === 0 && concert?.contacts) {
      const match = concert.contacts.match(/(\+?[0-9\s]{9,15})/);
      if (match) {
        phoneContacts.push({
          name: 'Pořadatel',
          role: 'Kontakt',
          phone: match[1].replace(/[^0-9+]/g, '')
        });
      }
    }

    // 3. Zkontrolujeme lokální soubory z Dokumentů zařízení
    let shareFileUri = '';
    let shareMimeType = 'image/png';
    let shareUTI = 'public.png';

    const fileSystemModule = getFileSystemModule();
    if (fileSystemModule && (fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory)) {
      const baseDir = fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory;
      const pngPath = `${baseDir}${cleanBand}_stageplan.png`;
      const pdfPath = `${baseDir}${cleanBand}_stageplan.pdf`;

      try {
        const pngInfo = await fileSystemModule.getInfoAsync(pngPath);
        if (pngInfo && pngInfo.exists) {
          shareFileUri = pngPath;
        } else {
          const pdfInfo = await fileSystemModule.getInfoAsync(pdfPath);
          if (pdfInfo && pdfInfo.exists) {
            shareFileUri = pdfPath;
            shareMimeType = 'application/pdf';
            shareUTI = 'com.adobe.pdf';
          }
        }
      } catch (e) {
        console.log("Kontrola souborů selhala:", e);
      }
    }

    // 4. Pokud neexistují, zkusíme je vygenerovat napřímo
    if (!shareFileUri) {
       console.log("Lokální soubory chybí, generuje se záložní PDF");
       const html = generatePdfHtmlForBand(band, concert, members);
       const { pdfUri } = await generateNamedPdfFile(html, bandName, concert?.title);
       shareFileUri = pdfUri;
       shareMimeType = 'application/pdf';
       shareUTI = 'com.adobe.pdf';
    }

    // 5. Získáme přímé URL z Firebase Storage pro textový odkaz
    const pdfLink = band?.stageplanPdfUrl || '';
    const bodyText = `Dobrý den,\nposílám Vám Stageplan skupiny "${bandName}".\n\nPřeji krásný den\nza skupinu "${bandName}"\n${senderName}`;
    const captionText = pdfLink
      ? `Zasílám Stageplan skupiny "${bandName}"\n\nOdkaz na PDF ke stažení (${pdfFileName}):\n${pdfLink}`
      : `Zasílám Stageplan skupiny "${bandName}"`;

    // Zkopírujeme text do schránky
    try {
      let clipboardModule: any = null;
      try { clipboardModule = require('expo-clipboard'); } catch (e) {}
      if (clipboardModule && clipboardModule.setStringAsync) {
        await clipboardModule.setStringAsync(captionText);
      }
    } catch (e) {}

    // Pomocné odesílací metody s předáním obrázku
    const openWhatsAppChat = async (phone: string) => {
      await openWhatsAppWithImage(phone, shareFileUri, captionText);
    };

    const sendEmailToOrganizers = async () => {
      const subject = `Stageplan "${bandName}"`;
      const emailBodyWithLink = pdfLink ? `${bodyText}\n\nOdkaz na PDF (${pdfFileName}):\n${pdfLink}` : bodyText;

      let mailComposerModule: any = null;
      try {
        const nativeModule = requireOptionalNativeModule('ExpoMailComposer');
        if (nativeModule) mailComposerModule = require('expo-mail-composer');
      } catch (e) {}

      const attachmentsToPass: string[] = [];
      if (shareFileUri) attachmentsToPass.push(shareFileUri);

      if (mailComposerModule && mailComposerModule.composeAsync) {
        try {
          const isAvailable = await mailComposerModule.isAvailableAsync();
          if (isAvailable) {
            await mailComposerModule.composeAsync({
              recipients: emails.length > 0 ? emails : undefined,
              subject: subject,
              body: emailBodyWithLink,
              attachments: attachmentsToPass,
            });
            return;
          }
        } catch (e) {}
      }

      const emailListStr = emails.join(',');
      const encSubject = encodeURIComponent(subject);
      const encBody = encodeURIComponent(emailBodyWithLink);
      try {
        await Linking.openURL(`mailto:${emailListStr}?subject=${encSubject}&body=${encBody}`);
      } catch (linkErr) {
        Alert.alert("E-mail klient", "Nebylo možné otevřít e-mailový klient.");
      }
    };

    const openGeneralShare = async () => {
      await shareImageWithText(shareFileUri, captionText);
    };

    // Pokud nemáme žádné konkrétní kontakty na akce, otevřeme rovnou e-mail nebo sdílení
    if (phoneContacts.length === 0 && emails.length === 0) {
      await sendEmailToOrganizers();
      return;
    }

    // 4. Nabídka možností sdílení v přehledném okně
    const alertButtons: any[] = [];

    phoneContacts.forEach(c => {
      alertButtons.push({
        text: `💬 WhatsApp: ${c.role} (${c.name})`,
        onPress: () => openWhatsAppChat(c.phone)
      });
    });

    if (emails.length > 0) {
      alertButtons.push({
        text: `📧 E-mail pořadatelům (${emails.join(', ')})`,
        onPress: () => sendEmailToOrganizers()
      });
    }

    alertButtons.push({
      text: `📲 Obecné sdílení souboru`,
      onPress: () => openGeneralShare()
    });

    alertButtons.push({ text: 'Zrušit', style: 'cancel' });

    Alert.alert(
      `Sdílet Stageplan (${concert?.title || bandName})`,
      `Vyberte způsob sdílení Stageplanu pro akci ${concert?.title || 'Koncert'}:`,
      alertButtons
    );

  } catch (err: any) {
    console.error("Chyba při sdílení Stageplanu z akce:", err);
    Alert.alert("Chyba", err?.message || "Nepodařilo se sdílet Stageplan.");
  }
}

export function StageplanModal({ visible, onClose, band, members, onSave, concert }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppStore();
  const stageViewRef = useRef<View>(null);

  const [stageplan, setStageplan] = useState<StageplanMember[]>(band.stageplan || []);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Aktualizace lokálního stavu a rotace obrazovky při otevření
  useEffect(() => {
    if (visible) {
      setStageplan(band.stageplan || []);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, [visible, band.stageplan]);

  const uploadPdfToFirebaseStorage = async (localPdfUri: string, fileName: string): Promise<string> => {
    try {
      const storagePath = `kapela_ios_android/${band?.id || 'band'}/stageplan/${fileName}`;
      const downloadUrl = await uploadImageToStorage(localPdfUri, storagePath);
      if (band?.id) {
        if (fileName.endsWith('.png')) {
          await updateBand(band.id, { stageplanPngUrl: downloadUrl } as any);
        } else {
          await updateBand(band.id, { stageplanPdfUrl: downloadUrl } as any);
        }
      }
      console.log("Soubor úspěšně nahrán na Firebase Storage:", downloadUrl);
      return downloadUrl;
    } catch (err) {
      console.log("Nahrání na Firebase Storage selhalo:", err);
      return '';
    }
  };

  const handleSave = async () => {
    setIsGeneratingPdf(true);
    try {
      onSave(stageplan);

      const bandName = band?.name || 'Naplech';
      const html = generateStageplanPdfHtml();

      let fileSystemModule: any = null;
      try { fileSystemModule = require('expo-file-system'); } catch (e) {}

      // Uložíme do veřejně přístupné složky zařízení (MediaLibrary nebo StorageAccessFramework)
      const saveFileToPublicDownloads = async (fileUri: string, targetFileName: string, mimeType: string) => {
        // 1. Zkusíme použít MediaLibrary (automatické uložení do veřejného úložiště bez otravování uživatele)
        try {
          let mediaLibraryModule: any = null;
          try {
            const nativeModule = requireOptionalNativeModule('ExpoMediaLibrary');
            if (nativeModule) mediaLibraryModule = require('expo-media-library');
          } catch (e) {}

          if (mediaLibraryModule && mediaLibraryModule.createAssetAsync) {
            const perm = await mediaLibraryModule.requestPermissionsAsync();
            if (perm.granted) {
              await mediaLibraryModule.createAssetAsync(fileUri);
              console.log(`Soubor ${targetFileName} úspěšně uložen do veřejné knihovny.`);
              return;
            }
          }
        } catch (mediaErr) {
          console.log("MediaLibrary uložení selhalo:", mediaErr);
        }

        // 2. Záložní metoda: StorageAccessFramework
        if (Platform.OS === 'android' && fileSystemModule && fileSystemModule.StorageAccessFramework) {
          try {
            const permissions = await fileSystemModule.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              const base64Data = await fileSystemModule.readAsStringAsync(fileUri, {
                encoding: fileSystemModule.EncodingType.Base64,
              });
              const newFileUri = await fileSystemModule.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                targetFileName,
                mimeType
              );
              await fileSystemModule.writeAsStringAsync(newFileUri, base64Data, {
                encoding: fileSystemModule.EncodingType.Base64,
              });
              console.log(`Soubor ${targetFileName} úspěšně uložen do vybrané složky.`);
            }
          } catch (safErr) {
            console.log("Uložení přes StorageAccessFramework selhalo:", safErr);
          }
        }
      };

      // 1. Vygenerujeme a nahrajeme PDF
      const { pdfUri, fileName: pdfFileName } = await generateNamedPdfFile(html, bandName, concert?.title);
      await uploadPdfToFirebaseStorage(pdfUri, pdfFileName);
      await saveFileToPublicDownloads(pdfUri, pdfFileName, 'application/pdf');

      // 2. Vygenerujeme a nahrajeme PNG obrázek do paměti a na Firebase
      if (stageViewRef && stageViewRef.current) {
        try {
          const rawSnapUri = await captureRef(stageViewRef, { format: 'png', quality: 1.0, result: 'tmpfile' });
          const cleanBandName = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');
          const pngFileName = `${cleanBandName}_stageplan.png`;

          let finalPngUri = rawSnapUri;
          if (fileSystemModule && (fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory)) {
            const baseDir = fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory;
            const targetPath = `${baseDir}${pngFileName}`;
            try { await fileSystemModule.deleteAsync(targetPath, { idempotent: true }); } catch (e) {}
            await fileSystemModule.copyAsync({ from: rawSnapUri, to: targetPath });
            finalPngUri = targetPath;
          }

          const pngUrl = await uploadPdfToFirebaseStorage(finalPngUri, pngFileName);
          if (band?.id && pngUrl) {
            await updateBand(band.id, { stageplanPngUrl: pngUrl } as any);
          }

          await saveFileToPublicDownloads(finalPngUri, pngFileName, 'image/png');
        } catch (e) {}
      }

      Alert.alert("Uloženo", "Stageplan byl úspěšně uložen na server i do zařízení.");
    } catch (err) {
      console.log("Uložení Stageplanu selhalo:", err);
      Alert.alert("Uloženo", "Stageplan byl úspěšně uložen.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const availableMembers = (members || []).filter(m =>
    !stageplan.some(s =>
      s.memberId === m.id ||
      s.memberId === (m as any).memberId ||
      s.memberId === (m as any).uid ||
      String(s.memberId) === String(m.id)
    )
  );

  // Otevření výběru člena při dlouhém podržení prázdné plochy
  const handleStageLongPress = (e: any) => {
    if (!e || !e.nativeEvent) return;
    const { locationX, locationY } = e.nativeEvent;
    if (!stageSize.width || !stageSize.height || stageSize.width <= 0 || stageSize.height <= 0) return;

    const percentX = Math.max(5, Math.min(95, (locationX / stageSize.width) * 100));
    const percentY = Math.max(5, Math.min(95, (locationY / stageSize.height) * 100));

    setPickerPosition({ x: percentX, y: percentY });
    setShowMemberPicker(true);
  };

  const handleAddMember = (member: BandMember) => {
    setStageplan([...stageplan, { memberId: member.id, x: pickerPosition.x, y: pickerPosition.y }]);
    setShowMemberPicker(false);
  };

  const generateStageplanPdfHtml = (): string => {
    return generatePdfHtmlForBand(band, concert, members);
  };

  // Tlačítko Stáhnout ve Stageplanu: Stáhne a uloží soubory (PDF i PNG) přímo do složky Ke stažení (Downloads)
  const handleDownloadStageplanToDevice = async () => {
    setIsGeneratingPdf(true);
    try {
      const bandName = band?.name || 'Naplech';
      const cleanBandName = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const pdfFileName = `${cleanBandName}_stageplan.pdf`;
      const pngFileName = `${cleanBandName}_stageplan.png`;

      const html = generateStageplanPdfHtml();
      const { pdfUri } = await generateNamedPdfFile(html, bandName, concert?.title);

      let pngUri = '';
      if (stageViewRef && stageViewRef.current) {
        try {
          const rawSnapUri = await captureRef(stageViewRef, { format: 'png', quality: 1.0, result: 'tmpfile' });
          const fileSystemModule = getFileSystemModule();
          if (fileSystemModule && (fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory)) {
            const baseDir = fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory;
            const targetPath = `${baseDir}${pngFileName}`;
            try { await fileSystemModule.deleteAsync(targetPath, { idempotent: true }); } catch (e) {}
            await fileSystemModule.copyAsync({ from: rawSnapUri, to: targetPath });
            pngUri = targetPath;
          } else {
            pngUri = rawSnapUri;
          }
        } catch (e) {}
      }

      let fileSystemModule: any = null;
      try { fileSystemModule = require('expo-file-system'); } catch (e) {}

      // 1. Zkusíme použít StorageAccessFramework (na Androidu vyzve k vybrání složky Ke stažení/Downloads)
      if (Platform.OS === 'android' && fileSystemModule && fileSystemModule.StorageAccessFramework) {
        try {
          const permissions = await fileSystemModule.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            // PDF
            if (pdfUri) {
              const pdfBase64 = await fileSystemModule.readAsStringAsync(pdfUri, { encoding: fileSystemModule.EncodingType.Base64 });
              const newPdfUri = await fileSystemModule.StorageAccessFramework.createFileAsync(permissions.directoryUri, pdfFileName, 'application/pdf');
              await fileSystemModule.writeAsStringAsync(newPdfUri, pdfBase64, { encoding: fileSystemModule.EncodingType.Base64 });
            }
            // PNG
            if (pngUri) {
              const pngBase64 = await fileSystemModule.readAsStringAsync(pngUri, { encoding: fileSystemModule.EncodingType.Base64 });
              const newPngUri = await fileSystemModule.StorageAccessFramework.createFileAsync(permissions.directoryUri, pngFileName, 'image/png');
              await fileSystemModule.writeAsStringAsync(newPngUri, pngBase64, { encoding: fileSystemModule.EncodingType.Base64 });
            }

            Alert.alert("Staženo", `Soubory ${pdfFileName} a ${pngFileName} byly úspěšně uloženy do vybrané složky.`);
            setIsGeneratingPdf(false);
            return;
          }
        } catch (safErr) {
          console.log("SAF stahování selhalo, zkouším MediaLibrary:", safErr);
        }
      }

      // 2. Uložení do MediaLibrary (veřejné úložiště)
      let mediaLibraryModule: any = null;
      try {
        const nativeModule = requireOptionalNativeModule('ExpoMediaLibrary');
        if (nativeModule) mediaLibraryModule = require('expo-media-library');
      } catch (e) {}

      if (mediaLibraryModule && mediaLibraryModule.createAssetAsync) {
        const perm = await mediaLibraryModule.requestPermissionsAsync();
        if (perm.granted) {
          if (pdfUri) await mediaLibraryModule.createAssetAsync(pdfUri);
          if (pngUri) await mediaLibraryModule.createAssetAsync(pngUri);
          Alert.alert("Staženo", `Soubory ${pdfFileName} a ${pngFileName} byly uloženy do vašeho zařízení.`);
          setIsGeneratingPdf(false);
          return;
        }
      }

      Alert.alert("Staženo", `Soubory ${pdfFileName} a ${pngFileName} byly uloženy v zařízení.`);
    } catch (e: any) {
      console.error("Chyba při stahování souborů Stageplanu:", e);
      Alert.alert("Chyba", e?.message || "Nepodařilo se stáhnout soubory.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Tlačítko Sdílet ve Stageplanu: Otevře stejné dialogové okno jako v kartě Akce
  const handleShareStageplan = async () => {
    setIsGeneratingPdf(true);
    try {
      try { await ScreenOrientation.unlockAsync(); } catch (e) {}

      // Pokud ještě nemáme uložený PNG obrázek na disku z aktuálního rozložení, uložíme ho rovnou, aby ho shareConcertStageplan mohl sebrat.
      let fileSystemModule: any = null;
      try { fileSystemModule = require('expo-file-system'); } catch (e) {}

      if (stageViewRef && stageViewRef.current && fileSystemModule) {
        try {
          const rawSnapUri = await captureRef(stageViewRef, { format: 'png', quality: 1.0, result: 'tmpfile' });
          const bandName = band?.name || 'Naplech';
          const cleanBandName = bandName.replace(/[^a-zA-Z0-9_-]/g, '_');
          const pngFileName = `${cleanBandName}_stageplan.png`;
          const baseDir = fileSystemModule.documentDirectory || fileSystemModule.cacheDirectory;
          const targetPath = `${baseDir}${pngFileName}`;

          try { await fileSystemModule.deleteAsync(targetPath, { idempotent: true }); } catch (e) {}
          await fileSystemModule.copyAsync({ from: rawSnapUri, to: targetPath });

          // Rychle a asynchronně hodíme obrázek do cloudu na Firebase pro jistotu (bez blokování)
          uploadImageToStorage(targetPath, `kapela_ios_android/${band.id}/stageplan/${pngFileName}`)
            .then(url => { if (band.id && url) updateBand(band.id, { stageplanPngUrl: url } as any); })
            .catch(() => {});
        } catch (e) {}
      }

      // Nyní zavoláme absolutně stejnou, robustní metodu jako se používá z karty Akce!
      await shareConcertStageplan({ band, concert, members, currentUser });
    } catch (e: any) {
      console.error("Chyba při sdílení Stageplanu:", e);
      Alert.alert("Chyba", e?.message || "Nepodařilo se vygenerovat Stageplan ke sdílení.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}>
      <ThemedView
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingLeft: Math.max(insets.left, 12),
            paddingRight: Math.max(insets.right, 12),
          }
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={{ paddingHorizontal: Spacing.two, paddingVertical: 4 }}>
            <ThemedText type="smallBold" style={{ color: '#e91e63' }}>Zrušit</ThemedText>
          </Pressable>

          <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: Spacing.two }}>
            <ThemedText type="subtitle" style={{ fontSize: 18 }}>Stageplan</ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ marginTop: 2, textAlign: 'center' }}
            >
              Podržením plochy přidáte člena. Přetažením přesouváte. Dvojitým klepnutím mažete.
            </ThemedText>
          </View>

          {/* Tlačítko Stáhnout */}
          <Pressable
            style={[styles.sendHeaderBtn, { backgroundColor: '#ff9800', marginRight: 8 }]}
            onPress={handleDownloadStageplanToDevice}
          >
            <SymbolView name={{ ios: 'arrow.down.doc.fill', android: 'download', web: 'download' }} size={14} tintColor="#fff" />
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>
              Stáhnout
            </ThemedText>
          </Pressable>

          {/* Tlačítko Sdílet */}
          <Pressable
            style={styles.sendHeaderBtn}
            onPress={handleShareStageplan}
          >
            <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={14} tintColor="#fff" />
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>
              Sdílet
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleSave} style={{ paddingHorizontal: Spacing.two, paddingVertical: 4, marginLeft: 8 }}>
            <ThemedText type="smallBold" style={{ color: '#4caf50' }}>Uložit</ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two }}>
          {/* Plocha stageplanu */}
          <View
            ref={stageViewRef}
            collapsable={false}
            style={[styles.stageArea, { backgroundColor: 'rgba(200,200,200,0.1)' }]}
            onLayout={(e) => setStageSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onLongPress={handleStageLongPress}
              delayLongPress={500}
            />

            {/* Vykreslení členů na stageplanu */}
            {stageplan.map((item) => {
              const member = (members || []).find(m =>
                m.id === item.memberId ||
                (m as any).memberId === item.memberId ||
                (m as any).uid === item.memberId ||
                String(m.id) === String(item.memberId)
              );
              if (!member) return null;

              return (
                <DraggableMember
                  key={item.memberId}
                  item={item}
                  member={member}
                  stageSize={stageSize.width > 0 ? stageSize : { width: 320, height: 220 }}
                  theme={theme}
                  onUpdatePosition={(id, x, y) => {
                    setStageplan(prev => prev.map(p => p.memberId === id ? { ...p, x, y } : p));
                  }}
                  onRemove={(id) => {
                    Alert.alert('Odstranit člena', `Opravdu chcete odstranit člena ${member.firstName} ze stageplanu?`, [
                      { text: 'Zrušit', style: 'cancel' },
                      {
                        text: 'Odstranit',
                        style: 'destructive',
                        onPress: () => setStageplan(prev => prev.filter(p => p.memberId !== id))
                      }
                    ]);
                  }}
                />
              );
            })}
          </View>
        </View>

        {/* Vrstva s výběrem člena */}
        {showMemberPicker && (
          <Pressable style={styles.modalOverlay} onPress={() => setShowMemberPicker(false)}>
            <ThemedView type="backgroundElement" style={styles.pickerModal}>
              <ThemedText type="subtitle" style={{ marginBottom: Spacing.three, textAlign: 'center' }}>
                Vyberte člena na stage
              </ThemedText>

              {availableMembers.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: Spacing.three }}>
                  Všichni členové jsou již na stagi.
                </ThemedText>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {availableMembers.map(m => (
                    <Pressable
                      key={m.id}
                      style={styles.pickerOption}
                      onPress={() => handleAddMember(m)}
                    >
                      {m.photoUri ? (
                        <Image source={{ uri: m.photoUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                          <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={20} tintColor={theme.textSecondary} />
                        </View>
                      )}
                      <View style={{ marginLeft: 12 }}>
                        <ThemedText type="default" style={{ fontWeight: 'bold' }}>{m.nickname || m.firstName} {m.lastName}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{m.instrument}</ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <Pressable style={styles.cancelBtn} onPress={() => setShowMemberPicker(false)}>
                <ThemedText type="smallBold" style={{ color: '#e91e63' }}>Zavřít</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        )}



        {/* Vrstva s indikátorem uložení / generování */}
        {isGeneratingPdf && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
            <View style={{ backgroundColor: '#222', padding: 24, borderRadius: 12, alignItems: 'center', minWidth: 160 }}>
              <ActivityIndicator size="large" color="#2196f3" />
              <ThemedText type="smallBold" style={{ color: '#fff', marginTop: 12 }}>Ukládám...</ThemedText>
            </View>
          </View>
        )}

      </ThemedView>
    </Modal>
  );
}

// Komponenta reprezentující jednoho člena na stageplanu (Přímý procentuální Drag and Drop bez odskakování)
function DraggableMember({
  item,
  member,
  stageSize,
  theme,
  onUpdatePosition,
  onRemove
}: {
  item: StageplanMember;
  member: BandMember;
  stageSize: { width: number, height: number };
  theme: any;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
}) {
  const [localPos, setLocalPos] = useState({ x: item.x, y: item.y });
  const localPosRef = useRef({ x: item.x, y: item.y });
  const isDraggingRef = useRef(false);

  // Synchronizace při změně zvenčí (pokud uživatel neposouvá)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalPos({ x: item.x, y: item.y });
      localPosRef.current = { x: item.x, y: item.y };
    }
  }, [item.x, item.y]);

  const lastTapRef = useRef(0);
  const grantTimeRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        grantTimeRef.current = Date.now();
      },
      onPanResponderMove: (_, gestureState) => {
        if (!stageSize.width || !stageSize.height) return;

        // Převod gesta v pixelech na relativní procenta pódia
        const deltaXPercent = (gestureState.dx / stageSize.width) * 100;
        const deltaYPercent = (gestureState.dy / stageSize.height) * 100;

        const newX = Math.max(2, Math.min(92, localPosRef.current.x + deltaXPercent));
        const newY = Math.max(2, Math.min(92, localPosRef.current.y + deltaYPercent));

        setLocalPos({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gestureState) => {
        isDraggingRef.current = false;
        if (!stageSize.width || !stageSize.height) return;

        const moveDistance = Math.hypot(gestureState.dx, gestureState.dy);

        // Pokud to bylo klepnutí bez výrazného posunu (pohyb < 6px)
        if (moveDistance < 6) {
          const now = Date.now();
          const DOUBLE_TAP_DELAY = 400; // 400ms okno pro dvojité poklepání

          if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            onRemove(item.memberId);
            lastTapRef.current = 0;
            return;
          } else {
            lastTapRef.current = now;
          }
        }

        const deltaXPercent = (gestureState.dx / stageSize.width) * 100;
        const deltaYPercent = (gestureState.dy / stageSize.height) * 100;

        const finalX = Math.max(2, Math.min(92, localPosRef.current.x + deltaXPercent));
        const finalY = Math.max(2, Math.min(92, localPosRef.current.y + deltaYPercent));

        localPosRef.current = { x: finalX, y: finalY };
        setLocalPos({ x: finalX, y: finalY });
        onUpdatePosition(item.memberId, finalX, finalY);
      },
    })
  ).current;

  const techRequirements = getMemberTechBadges(member);

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.memberPin,
        {
          left: `${localPos.x}%`,
          top: `${localPos.y}%`,
          transform: [{ translateX: -20 }, { translateY: -20 }],
        }
      ]}
    >
      <Pressable onLongPress={() => onRemove(item.memberId)}>
        <View style={{ alignItems: 'center' }}>
          {/* Fotka člena */}
          {member.photoUri ? (
            <Image source={{ uri: member.photoUri }} style={styles.pinPhoto} />
          ) : (
            <View style={[styles.pinPhoto, { backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
              <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={16} tintColor={theme.textSecondary} />
            </View>
          )}

          {/* Jméno člena */}
          <ThemedText type="smallBold" style={{ fontSize: 11, marginTop: 1, textAlign: 'center', lineHeight: 13 }}>
            {member.nickname || member.firstName}
          </ThemedText>

          {/* Nástroj ZELENĚ pod jménem */}
          {member.instrument ? (
            <ThemedText type="smallBold" style={{ color: '#4caf50', fontSize: 10, textAlign: 'center', lineHeight: 12, marginTop: 1 }}>
              {member.instrument}
            </ThemedText>
          ) : null}

          {/* Technický setup pod sebe s minimálním řádkováním */}
          {techRequirements.length > 0 && (
            <View style={{ alignItems: 'center', marginTop: 1 }}>
              {techRequirements.map((req, rIdx) => (
                <ThemedText
                  key={rIdx}
                  type="small"
                  style={{
                    fontSize: 9,
                    lineHeight: 11,
                    textAlign: 'center',
                    color: theme.textSecondary,
                  }}
                >
                  {req}
                </ThemedText>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  sendHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#2196f3',
  },
  stageArea: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderColor: 'rgba(150,150,150,0.3)',
    marginTop: Spacing.one,
    position: 'relative',
    overflow: 'hidden',
  },
  memberPin: {
    position: 'absolute',
    padding: 2,
    alignItems: 'center',
  },
  pinPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  pinTechBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    zIndex: 99999,
    elevation: 99,
  },
  pickerModal: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  sendModalBox: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  sendOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  cancelBtn: {
    marginTop: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
