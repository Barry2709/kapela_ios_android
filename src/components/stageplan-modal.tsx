import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, Animated, PanResponder, ScrollView, Platform, ActivityIndicator, Linking } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Band, BandMember, StageplanMember, Concert } from '@/types';

let Print: typeof import('expo-print') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;

try {
  Print = require('expo-print');
} catch (e) {
  Print = null;
}

try {
  Sharing = require('expo-sharing');
} catch (e) {
  Sharing = null;
}

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
  if (m.tech?.mic) badges.push('🎤 Zpěv');
  if (m.tech?.instrumentMic) badges.push('🎙 Nástroj. mic');
  if (m.tech?.xlr || m.tech?.comboXlr) badges.push('🎛 XLR');
  if (m.tech?.jack || m.tech?.comboJack) badges.push('🎸 Jack');
  if (m.tech?.monitor || m.tech?.wirelessMonitor) badges.push('🔊 Monitor');
  if (m.tech?.power230V) badges.push('⚡ 230V');

  if (m.tech?.customTech) {
    Object.entries(m.tech.customTech).forEach(([key, val]) => {
      if (val) badges.push(key);
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

  // Odeslání e-mailem
  const handleSendViaEmail = async () => {
    setIsGeneratingPdf(true);
    try {
      const emails = concert?.organizers
        ? concert.organizers.map(o => o.email).filter(Boolean) as string[]
        : [];
      const emailList = emails.join(',');
      const subject = encodeURIComponent(`Stageplan & Technický Rider - ${band.name} (${concert?.title || 'Koncert'})`);

      if (Print && Sharing) {
        const html = generateStageplanPdfHtml();
        const { uri } = await Print.printToFileAsync({ html });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
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
    } catch (e) {
      console.error("Chyba při generování PDF:", e);
      Alert.alert("Chyba", "Nepodařilo se vygenerovat PDF Stageplanu.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Odeslání přes WhatsApp / Systémové sdílení
  const handleSendViaWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      if (Print && Sharing) {
        const html = generateStageplanPdfHtml();
        const { uri } = await Print.printToFileAsync({ html });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
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
    } catch (e) {
      console.error("Chyba při sdílení Stageplanu:", e);
      Alert.alert("Chyba", "Nepodařilo se vygenerovat PDF Stageplanu.");
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

            {stageSize.width > 0 && stageplan.map((item, index) => {
              const member = members.find(m => m.id === item.memberId);
              if (!member) return null;

              return (
                <DraggableMember
                  key={item.memberId}
                  item={item}
                  member={member}
                  stageSize={stageSize}
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
                  <ThemedText type="small" style={{ marginTop: 10 }}>Generuji PDF dokument...</ThemedText>
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
        </Modal>

      </ThemedView>
    </Modal>
  );
}

// Komponenta reprezentující jednoho člena na stageplanu (Drag and Drop s podporou dotyků i myši)
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
  const initialX = (item.x / 100) * (stageSize.width || 300);
  const initialY = (item.y / 100) * (stageSize.height || 200);

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const startPosRef = useRef({ x: initialX, y: initialY });

  useEffect(() => {
    if (stageSize.width > 0 && stageSize.height > 0) {
      const px = (item.x / 100) * stageSize.width;
      const py = (item.y / 100) * stageSize.height;
      startPosRef.current = { x: px, y: py };
      pan.setOffset({ x: 0, y: 0 });
      pan.setValue({ x: px, y: py });
    }
  }, [item.x, item.y, stageSize.width, stageSize.height]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: startPosRef.current.x,
          y: startPosRef.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset();
        const finalX = startPosRef.current.x + gestureState.dx;
        const finalY = startPosRef.current.y + gestureState.dy;

        if (stageSize.width > 0 && stageSize.height > 0) {
          const percentX = Math.max(5, Math.min(95, (finalX / stageSize.width) * 100));
          const percentY = Math.max(5, Math.min(95, (finalY / stageSize.height) * 100));

          startPosRef.current = {
            x: (percentX / 100) * stageSize.width,
            y: (percentY / 100) * stageSize.height
          };

          onUpdatePosition(item.memberId, percentX, percentY);
        }
      }
    })
  ).current;
        }
      }
    })
  ).current;

  const techBadges = getMemberTechBadges(member);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.memberPin,
        {
          left: pan.x,
          top: pan.y,
          backgroundColor: theme.backgroundElement,
          borderColor: '#2196f3',
        }
      ]}
    >
      <Pressable onLongPress={() => onRemove(item.memberId)}>
        <View style={{ alignItems: 'center' }}>
          {member.photoUri ? (
            <Image source={{ uri: member.photoUri }} style={styles.pinPhoto} />
          ) : (
            <View style={[styles.pinPhoto, { backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
              <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={16} tintColor={theme.textSecondary} />
            </View>
          )}
          <ThemedText type="smallBold" style={{ fontSize: 11, marginTop: 2, textAlign: 'center' }}>
            {member.nickname || member.firstName}
          </ThemedText>

          {/* Zobrazení konkrétních technických požadavků člena u jeho špendlíku na stagi */}
          {techBadges.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, marginTop: 3, maxWidth: 110 }}>
              {techBadges.map((badge, bIdx) => (
                <View key={bIdx} style={styles.pinTechBadge}>
                  <ThemedText type="small" style={{ fontSize: 8, color: '#2196f3', fontWeight: 'bold' }}>
                    {badge}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
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
    padding: 6,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
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
