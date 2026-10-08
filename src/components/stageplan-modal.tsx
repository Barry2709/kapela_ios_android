import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, Animated, PanResponder, ScrollView, Platform, ActivityIndicator, Linking, NativeModules } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModulesProxy } from 'expo-modules-core';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Band, BandMember, StageplanMember, Concert } from '@/types';

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
  if (m.instrument && m.instrument.trim().length > 0) {
    badges.push(m.instrument.trim());
  }
  if (m.tech?.mic) badges.push('Zpěv');
  if (m.tech?.instrumentMic) badges.push('Nástroj. mic');
  if (m.tech?.xlr || m.tech?.comboXlr) badges.push('XLR');
  if (m.tech?.jack || m.tech?.comboJack) badges.push('Jack');
  if (m.tech?.monitor || m.tech?.wirelessMonitor) badges.push('Monitor');
  if (m.tech?.power230V) badges.push('230V');

  if (m.tech?.customTech) {
    Object.entries(m.tech.customTech).forEach(([key, val]) => {
      if (val) {
        const cleanVal = key.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        if (cleanVal) badges.push(cleanVal);
      }
    });
  }
  return badges;
};

export function StageplanModal({ visible, onClose, band, members, onSave, concert }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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

  const handleSave = () => {
    onSave(stageplan);
    onClose();
  };

  const availableMembers = members.filter(m => !stageplan.some(s => s.memberId === m.id));

  // Otevření výběru člena při dlouhém podržení prázdné plochy
  const handleStageLongPress = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    if (!stageSize.width || !stageSize.height) return;

    const percentX = (locationX / stageSize.width) * 100;
    const percentY = (locationY / stageSize.height) * 100;

    setPickerPosition({ x: percentX, y: percentY });
    setShowMemberPicker(true);
  };

  const handleAddMember = (member: BandMember) => {
    setStageplan([...stageplan, { memberId: member.id, x: pickerPosition.x, y: pickerPosition.y }]);
    setShowMemberPicker(false);
  };

  // Generování HTML šablony pro PDF Stageplanu & Rideru s technickými požadavky jednotlivých členů
  const generateStageplanPdfHtml = (): string => {
    const concertTitle = concert?.title || 'Koncert / Akce';
    const concertDate = concert?.date || '';
    const concertLocation = concert?.location || '';
    const concertTime = concert?.startTime ? `v ${concert.startTime}` : '';

    // Kontakty pořadatelů
    let orgsHtml = '';
    if (concert?.organizers && concert.organizers.length > 0) {
      orgsHtml = `
        <div style="margin-top: 15px;">
          <h3 style="margin-bottom: 6px; color: #1877f2; border-bottom: 2px solid #1877f2; padding-bottom: 3px;">Kontakty na pořadatele a zvukaře:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
            <thead>
              <tr style="background: #eef3fb;">
                <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px;">Role</th>
                <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px;">Jméno</th>
                <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px;">Telefon</th>
                <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px;">E-mail</th>
              </tr>
            </thead>
            <tbody>
              ${concert.organizers.map(o => `
                <tr>
                  <td style="border: 1px solid #ccc; padding: 6px 10px; font-weight: bold; font-size: 11px;">${o.role || 'Kontakt'}</td>
                  <td style="border: 1px solid #ccc; padding: 6px 10px; font-size: 11px;">${o.name}</td>
                  <td style="border: 1px solid #ccc; padding: 6px 10px; font-size: 11px;">${o.phone || '-'}</td>
                  <td style="border: 1px solid #ccc; padding: 6px 10px; font-size: 11px;">${o.email || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (concert?.contacts) {
      orgsHtml = `
        <div style="margin-top: 15px;">
          <h3 style="margin-bottom: 6px; color: #1877f2;">Kontakty na pořadatele:</h3>
          <p style="font-size: 12px; margin: 0; background: #f5f5f5; padding: 8px; border-radius: 4px;">${concert.contacts}</p>
        </div>
      `;
    }

    // Členové na stagi HTML včetně jejich konkrétních technických požadavků
    const pinsHtml = stageplan.map(s => {
      const mem = members.find(m => m.id === s.memberId);
      if (!mem) return '';
      const badges = getMemberTechBadges(mem).join(' • ');
      return `
        <div style="position: absolute; left: ${s.x}%; top: ${s.y}%; transform: translate(-50%, -50%); background: #2196f3; color: white; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 1px solid #1976d2;">
          ${mem.nickname || mem.firstName}<br>
          <span style="font-size: 9px; font-weight: normal; opacity: 0.95;">${badges}</span>
        </div>
      `;
    }).join('');

    // Technický rider balíčky kapely a rozpis podle členů
    let techPresetsHtml = '';
    const memberTechListHtml = members
      .filter(m => stageplan.some(s => s.memberId === m.id))
      .map(m => {
        const badges = getMemberTechBadges(m);
        if (badges.length === 0) return '';
        return `
          <div style="background: #f8f9fa; border: 1px solid #e0e0e0; padding: 8px 12px; border-radius: 6px; width: 48%; box-sizing: border-box;">
            <strong style="font-size: 12px; color: #1976d2;">${m.nickname || m.firstName} ${m.lastName || ''}</strong> (${m.instrument || ''})
            <div style="font-size: 11px; color: #555; margin-top: 4px;">
              ${badges.join(' • ')}
            </div>
          </div>
        `;
      }).join('');

    if (band.techRiderPresets && band.techRiderPresets.length > 0) {
      techPresetsHtml = `
        <div style="margin-top: 15px;">
          <h3 style="margin-bottom: 6px; color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 3px;">Požadavky na techniku & zvukaře (Tech Rider):</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; margin-bottom: 10px;">
            ${band.techRiderPresets.map(p => `
              <span style="background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                ✔ ${p}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 25px; color: #222; }
          .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2196f3; padding-bottom: 12px; margin-bottom: 15px; }
          .band-title { font-size: 26px; font-weight: bold; color: #111; margin: 0; }
          .concert-info { font-size: 14px; color: #444; margin-top: 4px; }
          .stage-container { width: 100%; height: 260px; border: 3px solid #333; background: #fdfdfd; position: relative; margin: 15px 0; border-radius: 10px; overflow: hidden; }
          .stage-front { position: absolute; bottom: 0; left: 0; right: 0; background: #333; color: white; text-align: center; padding: 6px 0; font-size: 11px; font-weight: bold; letter-spacing: 1px; }
          .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <h1 class="band-title">${band.name}</h1>
            <div class="concert-info">
              <strong>${concertTitle}</strong> • ${concertDate} ${concertTime} ${concertLocation ? `(${concertLocation})` : ''}
            </div>
          </div>
          <div style="font-size: 12px; text-align: right; color: #666;">
            Stageplan & Technický Rider<br>
            <em>Aplikace Kapela</em>
          </div>
        </div>

        <h3 style="margin-bottom: 5px; color: #111;">Pódiové rozmístění členů (Stageplan):</h3>
        <div class="stage-container">
          ${pinsHtml}
          <div class="stage-front">▼ PŘEDNÍ HRANA PÓDIA / HLAVNÍ ZVUK (PA) ▼</div>
        </div>

        ${techPresetsHtml}

        <div style="margin-top: 15px;">
          <h3 style="margin-bottom: 6px; color: #1976d2;">Technické požadavky jednotlivých muzikantů:</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${memberTechListHtml}
          </div>
        </div>

        ${orgsHtml}

        <div class="footer">
          Tento dokument obsahuje oficiální Stageplan a Technický Rider kapely ${band.name}.
        </div>
      </body>
      </html>
    `;
  };

  const getNativePrintModule = () => {
    try {
      return require('expo-print');
    } catch (e) {
      console.log("ExpoPrint modul není v tomto buildu dostupný:", e);
      return null;
    }
  };

  const getNativeSharingModule = () => {
    try {
      return require('expo-sharing');
    } catch (e) {
      console.log("ExpoSharing modul není v tomto buildu dostupný:", e);
      return null;
    }
  };

  // Vygenerování a okamžité uložení / otevření PDF dokumentu
  const handleGenerateAndOpenPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const printModule = getNativePrintModule();
      const sharingModule = getNativeSharingModule();

      let fileSystemModule: any = null;
      let webBrowserModule: any = null;

      try {
        fileSystemModule = require('expo-file-system');
      } catch (e) {}

      try {
        webBrowserModule = require('expo-web-browser');
      } catch (e) {}

      if (printModule && printModule.printToFileAsync) {
        const html = generateStageplanPdfHtml();
        const { uri } = await printModule.printToFileAsync({ html });
        console.log("PDF vygenerováno v dočasné složce:", uri);

        let finalPdfUri = uri;

        // Uložení do složky dokumentů s přehledným názvem
        if (fileSystemModule && fileSystemModule.documentDirectory) {
          const cleanBandName = band.name.replace(/[^a-zA-Z0-9]/g, '_');
          const targetPath = `${fileSystemModule.documentDirectory}Stageplan_${cleanBandName}.pdf`;
          try {
            await fileSystemModule.copyAsync({ from: uri, to: targetPath });
            finalPdfUri = targetPath;
            console.log("PDF úspěšně uloženo do složky dokumentů:", targetPath);
          } catch (copyErr) {
            console.log("Kopírování souboru selhalo, používám původní uri:", copyErr);
          }
        }

        // Pokus o přímé otevření prohlížečem / prohlížečem PDF
        let isOpened = false;
        if (webBrowserModule && webBrowserModule.openBrowserAsync) {
          try {
            await webBrowserModule.openBrowserAsync(finalPdfUri);
            isOpened = true;
          } catch (browserErr) {}
        }

        if (!isOpened && sharingModule && sharingModule.shareAsync) {
          await sharingModule.shareAsync(finalPdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Otevřít / Uložit Stageplan kapely ${band.name}`,
            UTI: 'com.adobe.pdf',
          });
        }
      } else {
        Alert.alert("PDF Nedostupné", "Generování PDF vyžaduje zkompilovaný balíček (např. v novém buildu).");
      }

      setShowSendModal(false);
    } catch (e: any) {
      console.error("Chyba při generování a otvírání PDF:", e);
      Alert.alert("Chyba PDF", e?.message || "Nepodařilo se vygenerovat PDF Stageplanu.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Odeslání e-mailem
  const handleSendViaEmail = async () => {
    setIsGeneratingPdf(true);
    try {
      const emails = concert?.organizers
        ? concert.organizers.map(o => o.email).filter(Boolean) as string[]
        : [];
      const emailList = emails.join(',');
      const subject = encodeURIComponent(`Stageplan & Technický Rider - ${band.name} (${concert?.title || 'Koncert'})`);

      const printModule = getNativePrintModule();
      const sharingModule = getNativeSharingModule();

      if (printModule && sharingModule) {
        const html = generateStageplanPdfHtml();
        const { uri } = await printModule.printToFileAsync({ html });
        console.log("Vygenerovaný PDF soubor:", uri);

        if (await sharingModule.isAvailableAsync()) {
          await sharingModule.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Stageplan kapely ${band.name}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Linking.openURL(`mailto:${emailList}?subject=${subject}`);
        }
      } else {
        Linking.openURL(`mailto:${emailList}?subject=${subject}`);
      }

      setShowSendModal(false);
    } catch (e: any) {
      console.error("Chyba při generování PDF:", e);
      Alert.alert("Chyba PDF", e?.message || "Nepodařilo se vygenerovat PDF Stageplanu.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Odeslání přes WhatsApp / Systémové sdílení
  const handleSendViaWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      const printModule = getNativePrintModule();
      const sharingModule = getNativeSharingModule();

      if (printModule && sharingModule) {
        const html = generateStageplanPdfHtml();
        const { uri } = await printModule.printToFileAsync({ html });
        console.log("Vygenerovaný PDF soubor:", uri);

        if (await sharingModule.isAvailableAsync()) {
          await sharingModule.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Odeslat Stageplan kapely ${band.name}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert("Sdílení nedostupné", "Sdílení souborů není na tomto zařízení dostupné.");
        }
      } else {
        const textMsg = encodeURIComponent(`Ahoj, posílám kontakt a informace k akce ${concert?.title || 'Koncert'} kapely ${band.name}.`);
        Linking.openURL(`https://wa.me/?text=${textMsg}`);
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

        {/* Modal s výběrem člena */}
        <Modal visible={showMemberPicker} transparent animationType="fade">
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
        </Modal>

        {/* Modal pro vybraný způsob odeslání Stageplanu pořadatelům */}
        <Modal visible={showSendModal} transparent animationType="fade">
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
                  <Pressable style={[styles.sendOptionBtn, { backgroundColor: '#ff9800' }]} onPress={handleGenerateAndOpenPdf}>
                    <SymbolView name={{ ios: 'doc.fill', android: 'description', web: 'description' }} size={20} tintColor="#fff" />
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 14 }}>
                      📄 Vygenerovat & Uložit / Otevřít PDF
                    </ThemedText>
                  </Pressable>

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
        </Modal>

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
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

  const lastTapRef = useRef(0);

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 350;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      onRemove(item.memberId);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const techRequirements = getMemberTechBadges(member).filter(b => b !== member.instrument);

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
      <Pressable onPress={handlePress} onLongPress={() => onRemove(item.memberId)}>
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
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
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
