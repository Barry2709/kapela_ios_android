import React, { useRef, useState } from 'react';
import { View, StyleSheet, Pressable, PanResponder } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  items: string[];
  onReorder: (newItems: string[]) => void;
  onRemove: (item: string) => void;
  onDragStart?: () => void;
  onDragEnd?: (finalItems: string[]) => void;
  emptyText?: string;
}

export function DraggableChips({ items, onReorder, onRemove, onDragStart, onDragEnd, emptyText }: Props) {
  const theme = useTheme();
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);

  // Měření pozic a středů jednotlivých štítků
  const layoutsRef = useRef<Record<number, { pageX: number; pageY: number; width: number; height: number; centerX: number; centerY: number }>>({});
  const chipRefs = useRef<Record<number, View | null>>({});

  const itemsRef = useRef<string[]>(items);
  itemsRef.current = items;

  const dragIndexRef = useRef<number | null>(null);
  dragIndexRef.current = activeDragIndex;

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= itemsRef.current.length) return;
    const updated = [...itemsRef.current];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    dragIndexRef.current = toIdx;
    setActiveDragIndex(toIdx);
    onReorder(updated);
  };

  // Změříme přesný střed a hranice všech štítků na obrazovce na začátku tažení
  const measureAllLayouts = () => {
    Object.keys(chipRefs.current).forEach((key) => {
      const idx = Number(key);
      const ref = chipRefs.current[idx];
      if (ref && ref.measureInWindow) {
        ref.measureInWindow((pageX, pageY, width, height) => {
          layoutsRef.current[idx] = {
            pageX,
            pageY,
            width,
            height,
            centerX: pageX + width / 2,
            centerY: pageY + height / 2,
          };
        });
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => dragIndexRef.current !== null,
      onStartShouldSetPanResponderCapture: () => dragIndexRef.current !== null,
      onMoveShouldSetPanResponder: () => dragIndexRef.current !== null,
      onMoveShouldSetPanResponderCapture: () => dragIndexRef.current !== null,

      onPanResponderGrant: () => {
        onDragStart?.();
        measureAllLayouts();
      },

      onPanResponderMove: (evt, gestureState) => {
        const currentDrag = dragIndexRef.current;
        if (currentDrag === null) return;

        const touchX = gestureState.moveX;
        const touchY = gestureState.moveY;

        let closestIdx = currentDrag;
        let minDistanceSq = Infinity;

        // Vypočteme euklidovskou vzdálenost k prstu pro plynulý přesun
        for (const [idxStr, layout] of Object.entries(layoutsRef.current)) {
          const idx = Number(idxStr);
          const dx = touchX - layout.centerX;
          const dy = touchY - layout.centerY;
          const distSq = dx * dx + dy * dy;

          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestIdx = idx;
          }
        }

        if (closestIdx !== currentDrag && closestIdx >= 0 && closestIdx < itemsRef.current.length) {
          moveItem(currentDrag, closestIdx);
        }
      },

      onPanResponderRelease: () => {
        const finalItems = itemsRef.current;
        dragIndexRef.current = null;
        setActiveDragIndex(null);
        onDragEnd?.(finalItems);
      },

      onPanResponderTerminate: () => {
        const finalItems = itemsRef.current;
        dragIndexRef.current = null;
        setActiveDragIndex(null);
        onDragEnd?.(finalItems);
      },
    })
  ).current;

  if (items.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 8 }}>
        {emptyText || 'Zatím nebyly přidané žádné položky.'}
      </ThemedText>
    );
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {items.map((item, index) => {
        const isDragging = activeDragIndex === index;

        return (
          <View
            key={item}
            ref={(ref) => {
              chipRefs.current[index] = ref;
            }}
            onLayout={() => {
              if (activeDragIndex === null) {
                measureAllLayouts();
              }
            }}
            style={styles.chipWrapper}
          >
            <Pressable
              delayLongPress={180}
              onLongPress={() => {
                measureAllLayouts();
                dragIndexRef.current = index;
                setActiveDragIndex(index);
                onDragStart?.();
              }}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isDragging ? '#4caf50' : 'rgba(150,150,150,0.18)',
                  borderColor: isDragging ? '#388e3c' : 'transparent',
                  borderWidth: isDragging ? 1 : 0,
                  zIndex: isDragging ? 99 : 1,
                }
              ]}
            >
              <ThemedText
                type="smallBold"
                style={{ fontSize: 12, color: isDragging ? '#fff' : theme.text }}
                numberOfLines={1}
              >
                {item}
              </ThemedText>

              <Pressable onPress={() => onRemove(item)} hitSlop={6} style={{ marginLeft: 6 }}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={16}
                  tintColor={isDragging ? '#fff' : theme.textSecondary}
                />
              </Pressable>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  chipWrapper: {
    alignSelf: 'flex-start',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
});