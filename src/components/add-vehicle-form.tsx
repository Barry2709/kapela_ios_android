import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Vehicle, BandMember } from '@/types';
import { useTranslation } from '@/utils/i18n';

interface Props {
  members: BandMember[];
  onSave: (vehicle: Omit<Vehicle, 'id'>) => void;
  onCancel: () => void;
}

export function AddVehicleForm({ members, onSave, onCancel }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [model, setModel] = useState('');
  const [owner, setOwner] = useState('');
  const [plate, setPlate] = useState('');
  const [fuel, setFuel] = useState<'benzin' | 'nafta' | 'elektro'>('nafta');
  const [consumption, setConsumption] = useState('6.5');
  const [hasTowBar, setHasTowBar] = useState(false);
  const [seats, setSeats] = useState('5');

  const fuelOptions: { key: 'benzin' | 'nafta' | 'elektro'; label: string; icon: string }[] = [
    { key: 'nafta', label: 'Nafta', icon: 'fuelpump' },
    { key: 'benzin', label: 'Benzín', icon: 'fuelpump.fill' },
    { key: 'elektro', label: 'Elektro', icon: 'bolt.car' },
  ];

  const handleSave = () => {
    if (!model.trim()) {
      Alert.alert(t('home.attendance.errorTitle'), t('form.vehicle.errorModel'));
      return;
    }

    if (!plate.trim()) {
      Alert.alert(t('home.attendance.errorTitle'), t('form.vehicle.errorPlate'));
      return;
    }

    const numSeats = parseInt(seats, 10);
    if (isNaN(numSeats) || numSeats <= 0) {
      Alert.alert(t('home.attendance.errorTitle'), t('form.vehicle.errorSeats'));
      return;
    }

    onSave({
      bandId: '',
      model: model.trim(),
      owner: owner.trim() || 'Kapela',
      plate: plate.trim().toUpperCase(),
      fuel,
      consumption: consumption.trim() || '6.0',
      hasTowBar,
      seats: numSeats,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>{t('form.vehicle.title')}</ThemedText>

      {/* Model vozidla */}
      <ThemedText type="smallBold">{t('form.vehicle.model')}</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={model}
        onChangeText={setModel}
        placeholder={t('form.vehicle.modelPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        autoFocus
      />

      {/* SPZ */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>{t('form.vehicle.plate')}</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', textTransform: 'uppercase' }]}
        value={plate}
        onChangeText={(val) => setPlate(val.toUpperCase())}
        placeholder={t('form.vehicle.platePlaceholder')}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
      />

      {/* Majitel / Řidič */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>{t('form.vehicle.owner')}</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={owner}
        onChangeText={setOwner}
        placeholder={t('form.vehicle.ownerPlaceholder')}
        placeholderTextColor={theme.textSecondary}
      />

      {/* Rychlé předvolby členů pro majitele */}
      {members.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
          <Pressable
            style={[styles.miniChip, { backgroundColor: 'rgba(200,200,200,0.15)' }]}
            onPress={() => setOwner('Kapela')}
          >
            <ThemedText type="small" style={{ fontSize: 11 }}>{t('form.vehicle.ownerBand')}</ThemedText>
          </Pressable>
          {members.map(m => {
            const name = `${m.firstName} ${m.lastName}`.trim() || m.nickname;
            return (
              <Pressable
                key={m.id}
                style={[styles.miniChip, { backgroundColor: 'rgba(200,200,200,0.15)' }]}
                onPress={() => setOwner(name)}
              >
                <ThemedText type="small" style={{ fontSize: 11 }}>{name}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Druh paliva */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>{t('form.vehicle.fuelType')} *</ThemedText>
      <View style={styles.fuelRow}>
        {fuelOptions.map(opt => {
          const isSelected = fuel === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[
                styles.fuelChip,
                {
                  backgroundColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.18)',
                  borderColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.3)',
                }
              ]}
              onPress={() => setFuel(opt.key)}
            >
              <ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 13 }}>
                {opt.key === 'nafta' ? t('form.vehicle.fuelDiesel') : opt.key === 'benzin' ? t('form.vehicle.fuelGas') : t('form.vehicle.fuelElectric')}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Spotřeba a Počet míst v řádku */}
      <View style={styles.row}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>{t('form.vehicle.consumption')}</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginTop: 0 }]}
            value={consumption}
            onChangeText={setConsumption}
            placeholder="6.5"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>{t('form.vehicle.seats')} *</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)', marginTop: 0 }]}
            value={seats}
            onChangeText={setSeats}
            placeholder="5"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Tažné zařízení */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{t('form.vehicle.towbar')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('form.vehicle.towbarDesc')}</ThemedText>
        </View>
        <Switch
          value={hasTowBar}
          onValueChange={setHasTowBar}
          trackColor={{ false: 'rgba(200,200,200,0.2)', true: '#4caf50' }}
        />
      </View>

      {/* Tlačítka */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('form.common.cancel')}</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('form.vehicle.saveBtn')}</ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six * 2 },
  title: { marginBottom: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 16,
  },
  miniChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  fuelRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  fuelChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    paddingVertical: 8,
  },
  buttons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.five },
  button: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
