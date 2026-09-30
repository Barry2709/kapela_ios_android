import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, Platform } from 'react-native';
import { PersonalNote } from '@/utils/personalSongSettings';

interface Props {
  note: PersonalNote;
  fontSize: number;
  containerWidth: number;
  onTap: (note: PersonalNote) => void;
  onDragEnd: (noteId: string, newXPercent: number, newYPx: number) => void;
}

export function FloatingNoteItem({ note, fontSize, containerWidth, onTap, onDragEnd }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  // Vždy udržujeme čerstvé reference pro zamezení stale closure v PanResponderu
  const noteRef = useRef(note);
  noteRef.current = note;

  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  const containerWidthRef = useRef(containerWidth);
  containerWidthRef.current = containerWidth;

  // Počáteční X a Y pozice v px
  const initialX = (note.xPercent / 100) * (containerWidth || 300);
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: note.yPx })).current;
  const currentPos = useRef({ x: initialX, y: note.yPx });

  // Aktualizace souřadnic při změně vlastností pozice
  useEffect(() => {
    const newX = (note.xPercent / 100) * (containerWidth || 300);
    currentPos.current = { x: newX, y: note.yPx };
    pan.setValue({ x: newX, y: note.yPx });
  }, [note.xPercent, note.yPx, containerWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        pan.setOffset({
          x: currentPos.current.x,
          y: currentPos.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setIsDragging(false);

        // Krátké klepnutí bez výrazného pohybu (klik na čerstvý objekt poznámky)
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          onTapRef.current(noteRef.current);
          return;
        }

        // Výpočet nových výsledných souřadnic po dokončení tažení
        const finalX = currentPos.current.x + gestureState.dx;
        const finalY = Math.max(0, currentPos.current.y + gestureState.dy);

        currentPos.current = { x: finalX, y: finalY };

        const cWidth = containerWidthRef.current > 0 ? containerWidthRef.current : 300;
        const newXPercent = Math.max(0, Math.min(90, (finalX / cWidth) * 100));

        onDragEndRef.current(noteRef.current.id, newXPercent, finalY);
      },
    })
  ).current;

  // Barva textu a rámečku – Oranžová pro Admin poznámky, Modrá pro osobní poznámky člena
  const noteColor = note.isAdminNote ? '#FF8C00' : '#2196F3';
  const noteBgColor = note.isAdminNote ? 'rgba(255, 140, 0, 0.22)' : 'rgba(33, 150, 243, 0.18)';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.noteContainer,
        {
          left: pan.x,
          top: pan.y,
          opacity: isDragging ? 0.8 : 1,
          transform: [{ scale: isDragging ? 1.08 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.noteBox,
          {
            backgroundColor: noteBgColor,
            borderColor: noteColor,
            ...Platform.select({
              web: {
                boxShadow: `0px 2px 4px ${note.isAdminNote ? 'rgba(255, 140, 0, 0.4)' : 'rgba(33, 150, 243, 0.3)'}`,
              },
              default: {
                shadowColor: noteColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
              },
            }),
          },
        ]}
      >
        <Text
          style={[
            styles.noteText,
            {
              color: noteColor,
              fontSize: Math.max(12, fontSize * 0.9),
              lineHeight: Math.max(16, fontSize * 1.2),
            },
          ]}
        >
          {note.text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  noteContainer: {
    position: 'absolute',
    zIndex: 99,
  },
  noteBox: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    elevation: 3,
  },
  noteText: {
    fontWeight: 'bold',
  },
});
