import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, Animated, PanResponder, ScrollView, Platform, ActivityIndicator, Linking, NativeModules } from 'react-native';
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

  // Členové na stagi HTML (požadavky svisle pod sebou bez překrývání)
  const pinsHtml = safeStageplan.map(s => {
    const mem = safeMembers.find(m => m.id === s.memberId);
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
    .filter(m => safeStageplan.some(s => s.memberId === m.id))
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
    .filter(m => safeStageplan.some(s => s.memberId === m.id))
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
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

// Přímé vygenerování a odeslání Stageplanu e-mailem z karty koncertu
export async function sendConcertStageplanByEmail({
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
    const fileName = `${cleanBand}_stageplan.pdf`;

    // 1. Zjištění jména a příjmení odesílajícího člena
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

    // 2. Předmět a Tělo zprávy
    const subject = `Stageplan "${bandName}"`;
    const bodyText = `Dobrý den,\nposílám Vám Stageplan skupiny "${bandName}".\n\nPřeji krásný den\nza skupinu "${bandName}"\n${senderName}`;

    // 3. E-maily pořadatelů
    const emails = concert?.organizers
      ? concert.organizers.map(o => o.email).filter(Boolean) as string[]
      : [];

    // 4. Modul pro tisk
    let printModule: any = null;
    try {
      const nativeModule = requireOptionalNativeModule('ExpoPrint');
      if (nativeModule) printModule = require('expo-print');
    } catch (e) {}

    if (!printModule || !printModule.printToFileAsync) {
      Alert.alert("PDF Nedostupné", "Generování PDF vyžaduje zkompilovanou aplikaci.");
      return;
    }

    // 5. HTML šablona pro PDF s přesným názvem souboru
    const html = generatePdfHtmlForBand(band, concert, members);
    const rawFileName = `${cleanBand}_stageplan`;
    const { uri } = await printModule.printToFileAsync({ html, fileName: rawFileName });

    // 6. Kopírování do složky cache pod názvem {JmenoKapely}_stageplan.pdf pro podporu MailComposer
    let fileSystemModule: any = null;
    try {
      fileSystemModule = require('expo-file-system');
    } catch (e) {}

    let pdfUri = uri;
    if (fileSystemModule && fileSystemModule.cacheDirectory) {
      const targetPath = `${fileSystemModule.cacheDirectory}${fileName}`;
      try {
        try {
          await fileSystemModule.deleteAsync(targetPath, { idempotent: true });
        } catch (e) {}
        await fileSystemModule.copyAsync({ from: uri, to: targetPath });

        // Zkusíme smazat původní soubor s nesmyslným názvem z tiskového modulu
        try {
          await fileSystemModule.deleteAsync(uri, { idempotent: true });
        } catch (e) {}

        pdfUri = targetPath;
      } catch (err) {
        console.log("Kopírování selhalo:", err);
      }
    }

    // 6B. Explicitní sdílení na Androidu pomocí ContentProvider URI a IntentLauncheru
    if (Platform.OS === 'android') {
      try {
        const contentUri = await fileSystemModule.getContentUriAsync(pdfUri);
        const intentLauncher = require('expo-intent-launcher');
        await intentLauncher.startActivityAsync('android.intent.action.SEND', {
          type: 'application/pdf',
          extra: {
            'android.intent.extra.STREAM': contentUri,
            'android.intent.extra.SUBJECT': subject,
            'android.intent.extra.TEXT': bodyText,
            'android.intent.extra.EMAIL': emails.length > 0 ? emails : undefined,
          },
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
        return; // Zastavit provádění iOS kódu
      } catch (intentErr) {
        console.log("IntentLauncher selhal na Androidu:", intentErr);
      }
    }

    // 7. Nahrání na Firebase Storage na pozadí
    try {
      const storagePath = `kapela_ios_android/${band.id}/stageplan/${fileName}`;
      uploadImageToStorage(pdfUri, storagePath).then(downloadUrl => {
        if (band.id) {
          updateBand(band.id, { stageplanPdfUrl: downloadUrl } as any);
        }
      }).catch(console.log);
    } catch (e) {}

    // 8. Otevření e-mailu
    let mailComposerModule: any = null;
    try {
      const nativeModule = requireOptionalNativeModule('ExpoMailComposer');
      if (nativeModule) mailComposerModule = require('expo-mail-composer');
    } catch (e) {}

    let sentViaComposer = false;
    if (mailComposerModule && mailComposerModule.composeAsync) {
      try {
        const isAvailable = await mailComposerModule.isAvailableAsync();
        if (isAvailable) {
          await mailComposerModule.composeAsync({
            recipients: emails.length > 0 ? emails : undefined,
            subject: subject,
            body: bodyText,
            attachments: [pdfUri],
          });
          sentViaComposer = true;
        }
      } catch (err) {
        console.log("MailComposer selhal:", err);
      }
    }

    if (!sentViaComposer) {
      const emailList = emails.join(',');
      const encSubject = encodeURIComponent(subject);
      const encBody = encodeURIComponent(bodyText);
      let openedMailto = false;
      try {
        await Linking.openURL(`mailto:${emailList}?subject=${encSubject}&body=${encBody}`);
        openedMailto = true;
      } catch (linkErr) {
        console.log("mailto URL selhalo:", linkErr);
      }

      if (!openedMailto) {
        let sharingModule: any = null;
        try {
          const nativeModule = requireOptionalNativeModule('ExpoSharing');
          if (nativeModule) sharingModule = require('expo-sharing');
        } catch (e) {}

        if (sharingModule && sharingModule.shareAsync) {
          await sharingModule.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: subject,
            UTI: 'com.adobe.pdf',
          });
        }
      }
    }
  } catch (err: any) {
    console.error("Chyba při odesílání Stageplanu e-mailem:", err);
    Alert.alert("Chyba PDF", err?.message || "Nepodařilo se odeslat Stageplan e-mailem.");
  }
}

export function StageplanModal({ visible, onClose, band, members, onSave, concert }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppStore();

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

  const handleSave = async () => {
    onSave(stageplan);
    onClose();

    // Při každém uložení vygenerovat PDF a uložit ho na Firebase Storage
    try {
      const { pdfUri, fileName } = await generateNamedPdfFile();
      await uploadPdfToFirebaseStorage(pdfUri, fileName);
    } catch (err) {
      console.log("Nahrání na Firebase selhalo po uložení:", err);
    }
  };

  const availableMembers = members.filter(m => !stageplan.some(s => s.memberId === m.id));

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

  const getNativePrintModule = () => {
    try {
      return require('expo-print');
    } catch (e) {
      console.log("ExpoPrint nebyl v tomto buildu nalezen:", e);
      return null;
    }
  };

  const getNativeSharingModule = () => {
    try {
      return require('expo-sharing');
    } catch (e) {
      console.log("ExpoSharing nebyl v tomto buildu nalezen:", e);
      return null;
    }
  };

  const getNativeMailComposer = () => {
    try {
      const nativeModule = requireOptionalNativeModule('ExpoMailComposer');
      if (nativeModule) {
        return require('expo-mail-composer');
      }
    } catch (e) {}
    return null;
  };

  const getPdfFileName = (): string => {
    const cleanBand = (band?.name || 'Naplech').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${cleanBand}_stageplan.pdf`;
  };

  // Pomocná funkce pro vygenerování a pojmenování PDF souboru
  const generateNamedPdfFile = async (): Promise<{ pdfUri: string; fileName: string }> => {
    const printModule = getNativePrintModule();
    if (!printModule || !printModule.printToFileAsync) {
      throw new Error("Modul pro generování PDF není k dispozici.");
    }

    const cleanBandName = (band?.name || 'Naplech').replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawFileName = `${cleanBandName}_stageplan`;
    const html = generateStageplanPdfHtml();

    // Na Androidu Print modul generuje náhodné názvy i při zadání fileName.
    // Musíme soubor manuálně přejmenovat v Cache i Document adresáři.
    const { uri } = await printModule.printToFileAsync({ html, fileName: rawFileName });
    const fileName = `${cleanBandName}_stageplan.pdf`;

    let fileSystemModule: any = null;
    try {
      fileSystemModule = require('expo-file-system');
    } catch (e) {}

    if (fileSystemModule && fileSystemModule.cacheDirectory) {
      // Prioritně ukládáme do Cache Directory pro správné fungování Expo Mail Composer na Androidu
      const targetPath = `${fileSystemModule.cacheDirectory}${fileName}`;
      try {
        try {
          await fileSystemModule.deleteAsync(targetPath, { idempotent: true });
        } catch (e) {}
        await fileSystemModule.copyAsync({ from: uri, to: targetPath });

        // Zkusíme smazat původní soubor s nesmyslným názvem
        try {
          await fileSystemModule.deleteAsync(uri, { idempotent: true });
        } catch (e) {}

        return { pdfUri: targetPath, fileName };
      } catch (err) {
        console.log("Kopírování souboru selhalo:", err);
      }
    }
    return { pdfUri: uri, fileName };
  };

  const uploadPdfToFirebaseStorage = async (localPdfUri: string, fileName: string): Promise<string> => {
    try {
      const storagePath = `kapela_ios_android/${band?.id || 'band'}/stageplan/${fileName}`;
      const downloadUrl = await uploadImageToStorage(localPdfUri, storagePath);
      if (band?.id) {
        await updateBand(band.id, { stageplanPdfUrl: downloadUrl } as any);
      }
      console.log("PDF úspěšně nahráno na Firebase Storage:", downloadUrl);
      return downloadUrl;
    } catch (err) {
      console.log("Nahrání na Firebase Storage selhalo:", err);
      return '';
    }
  };

  // Vygenerování, uložení na disk & do Firebase a okamžité otevření
  const handleGenerateAndOpenPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const sharingModule = getNativeSharingModule();
      const { pdfUri, fileName } = await generateNamedPdfFile();

      // Nahrání na Firebase Storage do adresáře kapely
      await uploadPdfToFirebaseStorage(pdfUri, fileName);

      // Otevření / Sdílení pojmenovaného PDF souboru
      if (sharingModule && sharingModule.shareAsync) {
        await sharingModule.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Otevřít / Uložit ${fileName}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert("PDF Vygenerováno", `Soubor ${fileName} byl vygenerován a uložen.`);
      }

      setShowSendModal(false);
    } catch (e: any) {
      console.error("Chyba při generování a otvírání PDF:", e);
      Alert.alert("Chyba PDF", e?.message || "Nepodařilo se vygenerovat PDF Stageplanu.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Odeslání e-mailem s přesně požadovaným předmětem, textem, příjemci a přiloženým PDF
  const handleSendViaEmail = async () => {
    setIsGeneratingPdf(true);
    try {
      const bandName = band?.name || 'Naplech';
      const emails = concert?.organizers
        ? concert.organizers.map(o => o.email).filter(Boolean) as string[]
        : [];

      // Zjištění jména a příjmení odesílajícího člena
      const senderMember = members.find(m =>
        (currentUser?.memberId && m.id === currentUser.memberId) ||
        (currentUser?.id && m.id === currentUser.id) ||
        ((m as any).uid && currentUser?.id && (m as any).uid === currentUser.id) ||
        (currentUser?.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.displayName && m.nickname && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase())
      );
      const senderName = senderMember
        ? `${senderMember.firstName || ''} ${senderMember.lastName || ''}`.trim()
        : (currentUser?.displayName || 'Člen kapely');

      const subject = `Stageplan "${bandName}"`;
      const bodyText = `Dobrý den,\nposílám Vám Stageplan skupiny "${bandName}".\n\nPřeji krásný den\nza skupinu "${bandName}"\n${senderName}`;

      const { pdfUri, fileName } = await generateNamedPdfFile();

      // Nahrání na Firebase Storage probíhá na pozadí bez blokování uživatele
      uploadPdfToFirebaseStorage(pdfUri, fileName).catch(console.log);

      const mailComposerModule = getNativeMailComposer();
      let sentViaComposer = false;

      if (mailComposerModule && mailComposerModule.composeAsync) {
        try {
          const isAvailable = await mailComposerModule.isAvailableAsync();
          if (isAvailable) {
            await mailComposerModule.composeAsync({
              recipients: emails.length > 0 ? emails : undefined,
              subject: subject,
              body: bodyText,
              attachments: [pdfUri],
            });
            sentViaComposer = true;
          }
        } catch (composerErr) {
          console.log("MailComposer selhal, použije se záložní způsob:", composerErr);
        }
      }

      if (!sentViaComposer) {
        const emailList = emails.join(',');
        const encSubject = encodeURIComponent(subject);
        const encBody = encodeURIComponent(bodyText);
        let openedMailto = false;
        try {
          await Linking.openURL(`mailto:${emailList}?subject=${encSubject}&body=${encBody}`);
          openedMailto = true;
        } catch (linkErr) {
          console.log("mailto URL selhalo:", linkErr);
        }

        if (!openedMailto) {
          const sharingModule = getNativeSharingModule();
          if (sharingModule && sharingModule.shareAsync) {
            await sharingModule.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: subject,
              UTI: 'com.adobe.pdf',
            });
          }
        }
      }

      setShowSendModal(false);
    } catch (e: any) {
      console.error("Chyba při odesílání e-mailu s přílohou:", e);
      Alert.alert("Chyba PDF", e?.message || "Nepodařilo se vygenerovat PDF Stageplanu.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Odeslání přes WhatsApp / Systémové sdílení
  const handleSendViaWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      const bandName = band?.name || 'Kapela';
      const sharingModule = getNativeSharingModule();

      try {
        const { pdfUri, fileName } = await generateNamedPdfFile();
        console.log("Vygenerovaný pojmenovaný PDF soubor pro WhatsApp:", pdfUri);

        // Na Androidu použijeme IntentLauncher pro odeslání s předvyplněným textem
        if (Platform.OS === 'android') {
          try {
            const fileSystemModule = require('expo-file-system');
            const contentUri = await fileSystemModule.getContentUriAsync(pdfUri);
            const intentLauncher = require('expo-intent-launcher');
            await intentLauncher.startActivityAsync('android.intent.action.SEND', {
              type: 'application/pdf',
              extra: {
                'android.intent.extra.STREAM': contentUri,
                'android.intent.extra.TEXT': `Posílám stageplan kapely "${bandName}"`,
              },
              flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            });
            setShowSendModal(false);
            return;
          } catch (intentErr) {
            console.log("IntentLauncher na Androidu selhal pro WhatsApp:", intentErr);
          }
        }

        if (sharingModule && (await sharingModule.isAvailableAsync())) {
          await sharingModule.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Odeslat Stageplan kapely ${bandName}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert("Sdílení nedostupné", "Sdílení souborů není na tomto zařízení dostupné.");
        }
      } catch (pdfErr) {
        const textMsg = encodeURIComponent(`Posílám stageplan kapely "${bandName}"`);
        try {
          await Linking.openURL(`https://wa.me/?text=${textMsg}`);
        } catch (linkErr) {
          Alert.alert("Aplikace nedostupná", "Nepodařilo se otevřít WhatsApp.");
        }
      }

      setShowSendModal(false);
    } catch (e: any) {
      console.error("Chyba při sdílení Stageplanu:", e);
      Alert.alert("Chyba PDF", e?.message || "Nepodařilo se vygenerovat PDF Stageplanu.");
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

          {/* Tlačítko Odeslat Pořadatelům */}
          <Pressable
            style={styles.sendHeaderBtn}
            onPress={() => setShowSendModal(true)}
          >
            <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={14} tintColor="#fff" />
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>
              Odeslat pořadatelům
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleSave} style={{ paddingHorizontal: Spacing.two, paddingVertical: 4, marginLeft: 8 }}>
            <ThemedText type="smallBold" style={{ color: '#4caf50' }}>Uložit</ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two }}>
          {/* Plocha stageplanu */}
          <View
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
              const member = members.find(m => m.id === item.memberId);
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

        {/* Vrstva pro vybraný způsob odeslání Stageplanu pořadatelům */}
        {showSendModal && (
          <Pressable style={styles.modalOverlay} onPress={() => setShowSendModal(false)}>
            <ThemedView type="backgroundElement" style={styles.sendModalBox}>
              <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' }}>
                Odeslat Stageplan & Rider pořadatelům
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: 16 }}>
                Aplikace vygeneruje oficiální PDF dokument se Stageplanem, kontakty a požadavky na techniku.
              </ThemedText>

              {isGeneratingPdf ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#2196f3" />
                  <ThemedText type="small" style={{ marginTop: 10 }}>Generuji a ukládám PDF dokument...</ThemedText>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <Pressable style={[styles.sendOptionBtn, { backgroundColor: '#2196f3' }]} onPress={handleSendViaEmail}>
                    <SymbolView name={{ ios: 'envelope.fill', android: 'email', web: 'email' }} size={20} tintColor="#fff" />
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 14 }}>
                      📧 Odeslat E-mailem pořadatelům
                    </ThemedText>
                  </Pressable>

                  <Pressable style={[styles.sendOptionBtn, { backgroundColor: '#25d366' }]} onPress={handleSendViaWhatsApp}>
                    <SymbolView name={{ ios: 'paperplane.fill', android: 'share', web: 'share' }} size={20} tintColor="#fff" />
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 14 }}>
                      💬 WhatsApp / Systémové sdílení
                    </ThemedText>
                  </Pressable>

                  <Pressable onPress={() => setShowSendModal(false)} style={[styles.cancelBtn, { marginTop: 6 }]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">Zrušit</ThemedText>
                  </Pressable>
                </View>
              )}
            </ThemedView>
          </Pressable>
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
