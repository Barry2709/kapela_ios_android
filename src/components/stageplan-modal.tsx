import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, Animated, PanResponder, Dimensions, ScrollView, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Band, BandMember, StageplanMember } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  band: Band;
  members: BandMember[];
  onSave: (stageplan: StageplanMember[]) => void;
}

export function StageplanModal({ visible, onClose, band, members, onSave }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [stageplan, setStageplan] = useState<StageplanMember[]>(band.stageplan || []);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Aktualizace lokálního stavu a rotace obrazovky při otevření
  useEffect(() => {
    if (visible) {
      setStageplan(band.stageplan || []);
      // Zamknout na šířku při otevření
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      // Při zavření vrátit na výšku
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }

    return () => {
      // Ujištění o navrácení do výchozího stavu při odpojení komponenty
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

    // Uložit pozici jako procenta
    const percentX = (locationX / stageSize.width) * 100;
    const percentY = (locationY / stageSize.height) * 100;

    setPickerPosition({ x: percentX, y: percentY });
    setShowMemberPicker(true);
  };

  const handleAddMember = (member: BandMember) => {
    setStageplan([...stageplan, { memberId: member.id, x: pickerPosition.x, y: pickerPosition.y }]);
    setShowMemberPicker(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}>
      <ThemedView style={[styles.container, { paddingTop: 2, marginTop: Platform.OS === 'android' ? -9 : 0 }]}>
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
              Podržením plochy přidáte člena. Podržením člena přesouváte. Dvojitým klepnutím mažete.
            </ThemedText>
          </View>
          <Pressable onPress={handleSave} style={{ paddingHorizontal: Spacing.two, paddingVertical: 4 }}>
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
      </ThemedView>
    </Modal>
  );
}

// Komponenta reprezentující jednoho člena na stageplanu (Drag and Drop)
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
  const pan = useRef(new Animated.ValueXY({
    x: (item.x / 100) * stageSize.width,
    y: (item.y / 100) * stageSize.height
  })).current;

  const [isDragging, setIsDragging] = useState(false);

  // Detekce double tap
  const lastTapTime = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap
      onRemove(item.memberId);
    }
    lastTapTime.current = now;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Nechat kliknutí/dvojitý klik fungovat
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Povolit posun jen pokud uživatel drží a táhne (nepatrný posun filtrujeme)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          // @ts-ignore
          x: pan.x._value,
          // @ts-ignore
          y: pan.y._value
        });
        pan.setValue({ x: 0, y: 0 });
        setIsDragging(true);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setIsDragging(false);

        // Přepočet zpět na procenta
        // @ts-ignore
        let newX = (pan.x._value / stageSize.width) * 100;
        // @ts-ignore
        let newY = (pan.y._value / stageSize.height) * 100;

        // Udržení v rámci obrazovky
        newX = Math.max(0, Math.min(100, newX));
        newY = Math.max(0, Math.min(100, newY));

        onUpdatePosition(item.memberId, newX, newY);
      }
    })
  ).current;

  // Vytažení tech rideru člena
  const activeTech = Object.entries(member.tech?.customTech || {})
    .filter(([_, isActive]) => isActive)
    .map(([key]) => key);

  return (
    <Animated.View
      style={[
        styles.draggableItem,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          opacity: isDragging ? 0.8 : 1,
          zIndex: isDragging ? 100 : 1,
        }
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={handlePress}>
        <View style={styles.memberAvatarContainer}>
          {member.photoUri ? (
            <Image source={{ uri: member.photoUri }} style={styles.memberAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.memberAvatar, { backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
              <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={24} tintColor={theme.textSecondary} />
            </View>
          )}
          <View style={[styles.memberNameBadge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ fontSize: 10 }}>{member.nickname || member.firstName}</ThemedText>
          </View>
        </View>

        {/* Info o tech rideru pod fotkou */}
        {(member.instrument || activeTech.length > 0) && (
          <View style={[styles.techBubble, { backgroundColor: 'rgba(76, 175, 80, 0.9)' }]}>
            {member.instrument ? (
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ fontSize: 10, color: '#ffeb3b', textAlign: 'center', marginBottom: activeTech.length > 0 ? 1 : 0, lineHeight: 12 }}
              >
                {member.instrument}
              </ThemedText>
            ) : null}
            {activeTech.map(tech => (
              <ThemedText key={tech} type="smallBold" style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 10 }}>
                {tech}
              </ThemedText>
            ))}
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: 4,
  },
  stageArea: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderColor: 'rgba(150,150,150,0.3)',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    width: '100%',
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
    maxWidth: 400,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingTop: Spacing.four,
  },
  draggableItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80, // Rezervovaný prostor pro člena
    marginLeft: -40, // Vycentrování na bod X
    marginTop: -40, // Vycentrování na bod Y
  },
  memberAvatarContainer: {
    alignItems: 'center',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#333',
  },
  memberNameBadge: {
    position: 'absolute',
    bottom: -8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
  },
  techBubble: {
    marginTop: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    maxWidth: 90,
  }
});