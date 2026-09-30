import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ride, Vehicle, Concert } from '@/types';
import { fetchCurrentFuelPrices, FuelPrices } from '@/services/fuelPriceService';

interface Props {
  initialRide?: Ride | null;
  vehicles: Vehicle[];
  concerts: Concert[];
  onSave: (ride: Omit<Ride, 'id'>, autoExpense: boolean) => void;
  onCancel: () => void;
}

const FUEL_PRICE_PRESETS = {
  ccs: { label: '⛽ Průměr ČR (Kurzy.cz)', benzin: 45.63, nafta: 50.20, elektro: 8.50 },
  discount: { label: '💰 Slevové pumpy', benzin: 42.50, nafta: 46.50, elektro: 7.50 },
  highway: { label: '🛣 Dálnice / ORLEN', benzin: 46.50, nafta: 51.50, elektro: 10.50 },
};

// Speciální pravidlo zaokrouhlování na stovky:
// 1 - 20 Kč -> zaokrouhlit dolů (např. 119 -> 100 Kč, 120 -> 100 Kč)
// 21 - 99 Kč -> zaokrouhlit nahoru (např. 121 -> 200 Kč, 123 -> 200 Kč)
const roundCustomHundreds = (amount: number): number => {
  if (amount <= 0) return 0;
  const roundedAmount = Math.round(amount);
  const h = Math.floor(roundedAmount / 100) * 100;
  const r = roundedAmount % 100;
  if (r === 0) return h;
  if (r >= 1 && r <= 20) return h;
  return h + 100;
};

export function AddRideForm({ initialRide, vehicles, concerts, onSave, onCancel }: Props) {
  const theme = useTheme();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialRide?.vehicleId || vehicles[0]?.id || '');
  const [destination, setDestination] = useState(initialRide?.destination || '');
  const [driverName, setDriverName] = useState(initialRide?.driverName || vehicles[0]?.owner || 'Řidič');
  const [distanceKmStr, setDistanceKmStr] = useState(initialRide?.distanceKm ? initialRide.distanceKm.toString() : '100');
  const [selectedPreset, setSelectedPreset] = useState<'ccs' | 'discount' | 'highway'>('ccs');
  const [fuelPriceStr, setFuelPriceStr] = useState(initialRide?.fuelPrice ? initialRide.fuelPrice.toString() : '50.20');
  const [autoExpense, setAutoExpense] = useState(initialRide?.addedToTreasury ?? true);

  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [priceSourceInfo, setPriceSourceInfo] = useState<string>('Nahrávám živé ceny z webu...');

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];

  const loadLivePrices = async () => {
    setIsFetchingPrices(true);
    try {
      const prices = await fetchCurrentFuelPrices();
      setPriceSourceInfo(`${prices.source}`);
      if (selectedVehicle) {
        const fuelType = selectedVehicle.fuel as 'benzin' | 'nafta' | 'elektro';
        const fallbackPrice = fuelType === 'nafta' ? 50.20 : (fuelType === 'benzin' ? 45.63 : 8.50);
        const livePrice = (prices[fuelType] && prices[fuelType] >= 32.0 && prices[fuelType] <= 65.0) ? prices[fuelType] : fallbackPrice;
        setFuelPriceStr(livePrice.toFixed(2));
      }
    } catch (e) {
      console.error("Chyba při nahrávání cen:", e);
    } finally {
      setIsFetchingPrices(false);
    }
  };

  useEffect(() => {
    loadLivePrices();
  }, []);

  // Při změně vozidla nebo přednastavení aktualizujeme předvyplněnou cenu paliva
  useEffect(() => {
    if (selectedVehicle) {
      setDriverName(selectedVehicle.owner || 'Řidič');
      const preset = FUEL_PRICE_PRESETS[selectedPreset];
      const fuelType = selectedVehicle.fuel as 'benzin' | 'nafta' | 'elektro';
      const defaultPrice = preset[fuelType] || 37.50;
      setFuelPriceStr(defaultPrice.toFixed(2));
    }
  }, [selectedVehicleId, selectedPreset]);

  const consumptionNum = parseFloat(selectedVehicle?.consumption.replace(',', '.') || '6.5') || 6.5;
  const distanceKmNum = parseFloat(distanceKmStr.replace(',', '.')) || 0;
  const fuelPriceNum = parseFloat(fuelPriceStr.replace(',', '.')) || 0;

  // Výpočet: (km * spotřeba / 100) * cena_paliva
  const consumedUnits = (distanceKmNum * consumptionNum) / 100;
  const rawCost = consumedUnits * fuelPriceNum;
  const totalCostNum = roundCustomHundreds(rawCost);

  const formatDateDDMMYYYY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const handleSave = () => {
    if (!selectedVehicle) {
      Alert.alert('Chyba', 'Nejprve zaregistrujte v seznamu alespoň jedno vozidlo.');
      return;
    }

    if (!destination.trim()) {
      Alert.alert('Chyba', 'Vyplňte prosím cíl / název akce.');
      return;
    }

    if (distanceKmNum <= 0) {
      Alert.alert('Chyba', 'Zadejte platný počet ujetých kilometrů.');
      return;
    }

    onSave(
      {
        bandId: '',
        vehicleId: selectedVehicle.id,
        vehicleModel: selectedVehicle.model,
        driverName: driverName.trim() || selectedVehicle.owner,
        destination: destination.trim(),
        distanceKm: distanceKmNum,
        fuelPrice: fuelPriceNum,
        totalCost: totalCostNum,
        date: formatDateDDMMYYYY(new Date()),
        timestamp: Date.now(),
        addedToTreasury: autoExpense,
      },
      autoExpense
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={styles.title}>Zaznamenat jízdu & cestovné</ThemedText>

      {/* Vybrané vozidlo */}
      <ThemedText type="smallBold">Vyberte vozidlo *</ThemedText>
      {vehicles.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6, marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          {vehicles.map(v => {
            const isSelected = v.id === selectedVehicleId;
            return (
              <Pressable
                key={v.id}
                style={[
                  styles.vehicleChip,
                  {
                    backgroundColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.18)',
                    borderColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.3)',
                  }
                ]}
                onPress={() => setSelectedVehicleId(v.id)}
              >
                <ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 13 }}>
                  🚗 {v.model} ({v.plate})
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <ThemedText type="small" style={{ color: '#e91e63', marginBottom: 12 }}>
          ⚠️ Nejprve přidejte do seznamu vozidel alespoň jedno auto.
        </ThemedText>
      )}

      {/* Cíl / Akce */}
      <ThemedText type="smallBold">Cíl jízdy / Akce *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={destination}
        onChangeText={setDestination}
        placeholder="Např. Koncert Festival Klášterec"
        placeholderTextColor={theme.textSecondary}
      />

      {/* Rychlý výběr z koncertů */}
      {concerts.length > 0 && (
        <View style={{ marginTop: 6, marginBottom: 12 }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 4 }}>
            Rychlý výběr z akcí:
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {concerts.slice(0, 5).map(c => (
              <Pressable
                key={c.id}
                style={[styles.miniChip, { backgroundColor: 'rgba(200,200,200,0.15)' }]}
                onPress={() => setDestination(c.title)}
              >
                <ThemedText type="small" style={{ fontSize: 11 }}>{c.title}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Řidič */}
      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Řidič / Majitel *</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
        value={driverName}
        onChangeText={setDriverName}
        placeholder="Jan Novák"
        placeholderTextColor={theme.textSecondary}
      />

      {/* ŽIVÝ WEBOVÝ CENÍK PALIV */}
      <ThemedView type="backgroundElement" style={styles.webPriceBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <ThemedText type="smallBold" style={{ color: '#2196f3' }}>
              🌐 Živé ceny paliv z webu:
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 2 }}>
              {priceSourceInfo}
            </ThemedText>
          </View>

          <Pressable style={styles.refreshBtn} onPress={loadLivePrices} disabled={isFetchingPrices}>
            {isFetchingPrices ? (
              <ActivityIndicator size="small" color="#2196f3" />
            ) : (
              <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={16} tintColor="#2196f3" />
            )}
          </Pressable>
        </View>

        {/* Ceníkové chipy */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
          {[
            { key: 'ccs', label: FUEL_PRICE_PRESETS.ccs.label },
            { key: 'discount', label: FUEL_PRICE_PRESETS.discount.label },
            { key: 'highway', label: FUEL_PRICE_PRESETS.highway.label },
          ].map(p => {
            const isSelected = selectedPreset === p.key;
            return (
              <Pressable
                key={p.key}
                style={[
                  styles.miniChip,
                  {
                    backgroundColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.18)',
                    borderColor: isSelected ? '#2196f3' : 'rgba(200,200,200,0.3)',
                    borderWidth: 1,
                  }
                ]}
                onPress={() => setSelectedPreset(p.key as any)}
              >
                <ThemedText type="smallBold" style={{ fontSize: 11, color: isSelected ? '#fff' : theme.text }}>
                  {p.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </ThemedView>

      {/* Počet ujetých km & Aktuální cena paliva */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Ujeto km (tam a zpět) *</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            value={distanceKmStr}
            onChangeText={setDistanceKmStr}
            placeholder="120"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Cena paliva za l/kWh *</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
            value={fuelPriceStr}
            onChangeText={setFuelPriceStr}
            placeholder="36.50"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* VÝPOČET SPOTŘEBY & NÁKLADŮ */}
      <ThemedView type="backgroundElement" style={styles.calcBox}>
        <ThemedText type="small" themeColor="textSecondary">
          Spotřeba vozidla: {consumptionNum} {selectedVehicle?.fuel === 'elektro' ? 'kWh/100km' : 'l/100km'} • Odhadem {consumedUnits.toFixed(2)} {selectedVehicle?.fuel === 'elektro' ? 'kWh' : 'litrů'}
        </ThemedText>

        <View style={styles.calcTotalRow}>
          <ThemedText type="subtitle" style={{ fontWeight: 'bold', fontSize: 18 }}>
            Vyplatit:
          </ThemedText>
          <ThemedText type="subtitle" style={{ fontWeight: 'bold', color: '#4caf50', fontSize: 24 }}>
            {totalCostNum} Kč
          </ThemedText>
        </View>
      </ThemedView>

      {/* Automaticky strhnout jako výdej z pokladny */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <ThemedText type="smallBold">Zaevidovat jako výdej z pokladny</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Automaticky strhne {totalCostNum} Kč z pokladny kapely jako cestovné.
          </ThemedText>
        </View>
        <Switch
          value={autoExpense}
          onValueChange={setAutoExpense}
          trackColor={{ false: 'rgba(200,200,200,0.2)', true: '#f44336' }}
        />
      </View>

      {/* Tlačítka */}
      <View style={styles.buttons}>
        <Pressable style={[styles.button, { backgroundColor: '#e91e63' }]} onPress={onCancel}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#4caf50' }]} onPress={handleSave}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit jízdu</ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six * 2 },
  title: { marginBottom: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 16,
  },
  vehicleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  miniChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  webPriceBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.3)',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(33,150,243,0.12)',
  },
  calcBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  calcTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
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
