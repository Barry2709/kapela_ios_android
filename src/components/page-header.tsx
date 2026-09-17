import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';

interface Props {
  title: string;
}

export function PageHeader({ title }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 16) }]}>
      <ThemedText type="subtitle" style={styles.titleText}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  titleText: {
    textAlign: 'center',
    width: '100%',
  },
});