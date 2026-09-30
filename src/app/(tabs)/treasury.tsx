import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Modal, Alert, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Transaction, Vehicle, BandMember, Concert, Ride } from '@/types';
import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteAllTransactions,
  uploadReceiptToStorage,
  getVehicles,
  addVehicle,
  deleteVehicle,
  getBandMembers,
  getConcerts,
  getRides,
  addRide,
  updateRide,
  deleteRide
} from '@/services/firebaseService';
import { AddVehicleForm } from '@/components/add-vehicle-form';
import { AddRideForm } from '@/components/add-ride-form';

interface TreasuryItem {
  id: string;
  title: string;
  description: string;
  location?: string;
  amount: number;
  timestamp: number;
  type: 'in' | 'out';
  isAutoConcert: boolean;
  concertStatus?: 'past' | 'ongoing' | 'future';
  concertDate?: string;
  isCancelled?: boolean;
  receiptUrl?: string;
  receiptPath?: string;
  originalTransaction?: Transaction;
}

export default function TreasuryScreen() {
  const theme = useTheme();
  const { activeBand, activeRoleView, treasuryTab, setTreasuryTab } = useAppStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);

  // Sbalovací stavy sekcí
  const [isIncomeCollapsed, setIsIncomeCollapsed] = useState(false);
  const [isExpenseCollapsed, setIsExpenseCollapsed] = useState(false);
  const [isVehiclesCollapsed, setIsVehiclesCollapsed] = useState(false);
  const [isRidesCollapsed, setIsRidesCollapsed] = useState(false);

  // Sbalovací stav pro jednotlivé položky přehledu a jízd
  const expandedItemIdsState = useState<Set<string>>(new Set());
  const expandedItemIds = expandedItemIdsState[0];
  const setExpandedItemIds = expandedItemIdsState[1];

  const expandedRideIdsState = useState<Set<string>>(new Set());
  const expandedRideIds = expandedRideIdsState[0];
  const setExpandedRideIds = expandedRideIdsState[1];

  // Úpravy transakcí a jízd
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingRide, setEditingRide] = useState<Ride | null>(null);

  // Řízení zobrazení formuláře
  const [activeFormType, setActiveFormType] = useState<'in' | 'out' | null>(null);

  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddRideModal, setShowAddRideModal] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'in' | 'out' | 'planned'>('all');

  // Formulářové stavy pro novou transakci
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Prohlížeč celoobrazovkového dokladu
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  const titleMap = {
    overview: 'Přehled pokladny',
    prijem: 'Příjmy pokladny',
    vydej: 'Výdaje pokladny',
    doklady: 'Účetní doklady',
    kniha_jizd: 'Kniha jízd a vozidla',
  };

  // Při každém příchodu / kliknutí na obrazovku Pokladny VŽDY zrušíme formulář a otevřeme hlavní Přehled
  useFocusEffect(
    React.useCallback(() => {
      setActiveFormType(null);
    }, [])
  );

  useEffect(() => {
    if (activeBand) {
      loadTransactions();
      loadConcerts();
      if (treasuryTab === 'kniha_jizd') {
        loadVehicles();
        loadRides();
        loadMembers();
      }
    }
  }, [activeBand, treasuryTab]);

  useEffect(() => {
    if (treasuryTab === 'prijem') {
      openAddTransactionForm('in');
    } else if (treasuryTab === 'vydej') {
      openAddTransactionForm('out');
    } else {
      setActiveFormType(null);
    }
  }, [treasuryTab]);

  const loadTransactions = async () => {
    if (!activeBand) return;
    try {
      const data = await getTransactions(activeBand.id);
      setTransactions(data);
    } catch (e) {
      console.error("Nepodařilo se načíst transakce:", e);
    }
  };

  const loadConcerts = async () => {
    if (!activeBand) return;
    try {
      const data = await getConcerts(activeBand.id);
      setConcerts(data);
    } catch (e) {
      console.error("Nepodařilo se načíst koncerty pro pokladnu:", e);
    }
  };

  const loadVehicles = async () => {
    if (!activeBand) return;
    try {
      const data = await getVehicles(activeBand.id);
      setVehicles(data);
    } catch (e) {
      console.error("Nepodařilo se načíst vozidla:", e);
    }
  };

  const loadRides = async () => {
    if (!activeBand) return;
    try {
      const data = await getRides(activeBand.id);
      setRides(data);
    } catch (e) {
      console.error("Nepodařilo se načíst knihu jízd:", e);
    }
  };

  const loadMembers = async () => {
    if (!activeBand) return;
    try {
      const data = await getBandMembers(activeBand.id);
      setBandMembers(data);
    } catch (e) {
      console.error("Nepodařilo se načíst členy:", e);
    }
  };

  const getEventStatus = (dateStr: string, startTimeStr?: string, endTimeStr?: string) => {
    if (!dateStr) return 'future';

    try {
      let isoDate = dateStr;
      if (dateStr.includes('.')) {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (isoDate < todayStr) return 'past';
      if (isoDate > todayStr) return 'future';

      if (isoDate === todayStr) {
        if (!startTimeStr) return 'ongoing';

        const [startH, startM] = startTimeStr.split(':').map(Number);
        const startTotalMin = startH * 60 + (startM || 0);

        let endTotalMin: number;
        if (endTimeStr) {
          const [endH, endM] = endTimeStr.split(':').map(Number);
          endTotalMin = endH * 60 + (endM || 0);
        } else {
          endTotalMin = startTotalMin + 120;
        }

        const nowTotalMin = now.getHours() * 60 + now.getMinutes();

        if (nowTotalMin < startTotalMin) return 'future';
        if (nowTotalMin >= startTotalMin && nowTotalMin <= endTotalMin) return 'ongoing';
        return 'past';
      }

      return 'future';
    } catch (e) {
      return 'future';
    }
  };

  const parsePriceAmount = (priceStr?: string): number => {
    if (!priceStr) return 0;
    const clean = priceStr.replace(/\s/g, '').replace(/[^0-9.,]/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const concertIncomes: TreasuryItem[] = concerts
    .filter(c => c.price && parsePriceAmount(c.price) > 0)
    .map(c => {
      const amount = parsePriceAmount(c.price);
      const status = getEventStatus(c.date, c.startTime, c.endTime);

      let timestamp = Date.now();
      try {
        if (c.date.includes('.')) {
          const parts = c.date.split('.');
          if (parts.length === 3) {
            timestamp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
          }
        } else if (c.date.includes('-')) {
          const parts = c.date.split('-');
          if (parts.length === 3) {
            timestamp = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
          }
        }
      } catch (e) {}

      return {
        id: `concert_${c.id}`,
        title: c.title || 'Akce',
        description: c.title || 'Akce',
        location: c.location,
        amount,
        timestamp,
        type: 'in',
        isAutoConcert: true,
        concertStatus: status,
        concertDate: c.date,
        isCancelled: !!c.isCancelled,
      };
    });

  const manualItems: TreasuryItem[] = transactions.map(t => ({
    id: t.id,
    title: t.description,
    description: t.description,
    amount: t.amount,
    timestamp: t.timestamp,
    type: t.type,
    isAutoConcert: false,
    concertStatus: 'past',
    receiptUrl: t.receiptUrl,
    receiptPath: t.receiptPath,
    originalTransaction: t,
  }));

  const allTreasuryItems = [...manualItems, ...concertIncomes];
  allTreasuryItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const actualIncome = allTreasuryItems
    .filter(item => item.type === 'in' && item.concertStatus === 'past' && !item.isCancelled)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const plannedIncome = allTreasuryItems
    .filter(item => item.type === 'in' && item.concertStatus !== 'past' && !item.isCancelled)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const totalExpense = allTreasuryItems
    .filter(item => item.type === 'out')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalBalance = actualIncome - totalExpense;

  const formatCurrency = (val: number) => {
    const formatted = Math.abs(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${val < 0 ? '-' : ''}${formatted} Kč`;
  };

  const getCleanTitle = (rawTitle?: string): string => {
    if (!rawTitle) return '';
    let clean = rawTitle;
    clean = clean.replace(/^[📍🚗⛽🏠👥🟢🔴🟡💰📊]\s*/g, '');
    clean = clean.replace(/Cestovné\s*[-:]\s*/gi, '');
    clean = clean.replace(/Honorář\s*(za\s*akce)?\s*[-:]\s*/gi, '');
    clean = clean.replace(/Koncert\s*[-:]\s*/gi, '');
    clean = clean.replace(/\s*\([^)]*\)/g, '');
    clean = clean.replace(/^[📍🚗⛽🏠👥🟢🔴🟡💰📊:\-\s]+/g, '');
    return clean.trim();
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const toggleItemExpand = (id: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleRideExpand = (id: string) => {
    setExpandedRideIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openAddTransactionForm = (type: 'in' | 'out') => {
    setEditingTransaction(null);
    setActiveFormType(type);
    setAmountStr('');
    setDescription('');
    setReceiptImageUri(null);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setActiveFormType(transaction.type);
    setAmountStr(transaction.amount.toString());
    setDescription(transaction.description);
    setReceiptImageUri(transaction.receiptUrl || null);
  };

  const handlePickReceiptImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setReceiptImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Chyba při výběru dokladu z galerie:", e);
      Alert.alert("Chyba", "Nepodařilo se načíst fotografii z galerie.");
    }
  };

  const handleSaveTransaction = async () => {
    if (!activeBand || !activeFormType) return;

    const numAmount = parseFloat(amountStr.replace(',', '.').replace(/\s/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Chyba", "Zadejte platnou kladnou částku v Kč.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Chyba", "Vyplňte prosím důvod / popis transakce.");
      return;
    }

    setIsSaving(true);
    try {
      let receiptUrl: string | undefined = undefined;
      let receiptPath: string | undefined = undefined;

      if (receiptImageUri && !receiptImageUri.startsWith('http')) {
        const uploadRes = await uploadReceiptToStorage(activeBand.id, receiptImageUri);
        receiptUrl = uploadRes.downloadUrl;
        receiptPath = uploadRes.storagePath;
      }

      if (editingTransaction) {
        await updateTransaction(activeBand.id, editingTransaction.id, {
          amount: numAmount,
          description: description.trim(),
          type: activeFormType,
          receiptUrl: receiptUrl || editingTransaction.receiptUrl,
          receiptPath: receiptPath || editingTransaction.receiptPath,
        });
        setEditingTransaction(null);
      } else {
        await addTransaction(activeBand.id, {
          bandId: activeBand.id,
          amount: numAmount,
          description: description.trim(),
          type: activeFormType,
          receiptUrl,
          receiptPath,
          timestamp: Date.now(),
        });
      }

      setIsSaving(false);
      setActiveFormType(null);
      setTreasuryTab('overview');
      loadTransactions();
    } catch (e) {
      setIsSaving(false);
      console.error("Chyba při ukládání transakce:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit transakci.");
    }
  };

  const handleCancelForm = () => {
    setEditingTransaction(null);
    setActiveFormType(null);
    setTreasuryTab('overview');
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    Alert.alert(
      "Potvrdit smazat transakci",
      `Opravdu chcete smazat položku "${transaction.description}"?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteTransaction(activeBand.id, transaction.id, transaction.receiptPath);
            loadTransactions();
          }
        }
      ]
    );
  };

  const handleSaveVehicle = async (vehicleData: Omit<Vehicle, 'id'>) => {
    if (!activeBand) return;
    try {
      await addVehicle(activeBand.id, {
        ...vehicleData,
        bandId: activeBand.id,
      });
      setShowAddVehicleModal(false);
      loadVehicles();
      Alert.alert("Úspěch", "Vozidlo bylo úspěšně přidáno do seznamu.");
    } catch (e) {
      console.error("Chyba při ukládání vozidla:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit vozidlo.");
    }
  };

  const handleDeleteVehicle = (vehicle: Vehicle) => {
    Alert.alert(
      "Potvrdit smazat vozidlo",
      `Opravdu chcete smazat vozidlo ${vehicle.model} (${vehicle.plate}) ze seznamu kapely?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteVehicle(activeBand.id, vehicle.id);
            loadVehicles();
          }
        }
      ]
    );
  };

  const openEditRide = (ride: Ride) => {
    setEditingRide(ride);
    setShowAddRideModal(true);
  };

  const handleSaveRide = async (rideData: Omit<Ride, 'id'>, autoExpense: boolean) => {
    if (!activeBand) return;
    try {
      if (editingRide) {
        await updateRide(activeBand.id, editingRide.id, rideData);
        setEditingRide(null);
      } else {
        await addRide(activeBand.id, {
          ...rideData,
          bandId: activeBand.id,
        });

        // Pokud je zapnutý automatický výdej, vytvoříme odpovídající transakci do Pokladny
        if (autoExpense && rideData.totalCost > 0) {
          await addTransaction(activeBand.id, {
            bandId: activeBand.id,
            type: 'out',
            amount: rideData.totalCost,
            description: rideData.destination,
            timestamp: Date.now(),
          });
          loadTransactions();
        }
      }

      setShowAddRideModal(false);
      loadRides();
      Alert.alert("Úspěch", `Jízda byla uložena.${autoExpense && !editingRide ? ' Částka byla stržena z pokladny.' : ''}`);
    } catch (e) {
      console.error("Chyba při ukládání jízdy:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit jízdu.");
    }
  };

  const handleDeleteRide = (ride: Ride) => {
    Alert.alert(
      "Smazat jízdu",
      `Opravdu chcete smazat záznam jízdy "${ride.destination}"?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteRide(activeBand.id, ride.id);
            loadRides();
          }
        }
      ]
    );
  };

  const handleResetTreasury = () => {
    Alert.alert(
      "Vynulovat pokladnu",
      "Opravdu chcete VYNULOVAT pokladnu? Tato akce smaže všechny evidované příjmy, výdaje a účetní doklady z databáze.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Ano, vynulovat pokladnu",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            try {
              await deleteAllTransactions(activeBand.id);
              setTransactions([]);
              Alert.alert("Pokladna vynulována", "Stav pokladny byl úspěšně resetován na 0 Kč.");
            } catch (e) {
              console.error("Chyba při vynulování pokladny:", e);
              Alert.alert("Chyba", "Nepodařilo se vynulovat pokladnu.");
            }
          }
        }
      ]
    );
  };

  if (activeRoleView === 'fan') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <PageHeader title="Přístup odepřen" />
          <View style={styles.centered}>
             <ThemedText type="default" themeColor="textSecondary" style={{textAlign: 'center', marginTop: 10}}>
                Pokladna je dostupná pouze pro členy kapely.
             </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const filteredOverviewItems = allTreasuryItems.filter(item => {
    if (filterMode === 'in') return item.type === 'in' && item.concertStatus === 'past';
    if (filterMode === 'out') return item.type === 'out';
    if (filterMode === 'planned') return item.type === 'in' && item.concertStatus !== 'past';
    return true;
  });

  const receiptTransactions = transactions.filter(t => !!t.receiptUrl);

  const fuelLabels: Record<string, string> = {
    nafta: '⛽ Nafta',
    benzin: '⛽ Benzín',
    elektro: '⚡ Elektro',
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <PageHeader title={activeFormType ? (activeFormType === 'in' ? 'Zadat nový příjem' : 'Zadat nový výdej') : (titleMap[treasuryTab] || 'Pokladna')} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* AKCE A: ZOBRAZENÍ FORMULÁŘE (Pokud uživatel klikl na Příjem / Výdej dole) */}
          {activeFormType !== null ? (
            <ThemedView type="backgroundElement" style={styles.formCard}>
              <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: Spacing.four }}>
                {activeFormType === 'in' ? '🟢 Zadat nový příjem pokladny' : '🔴 Zadat nový výdej pokladny'}
              </ThemedText>

              {/* Částka */}
              <ThemedText type="smallBold">Částka v Kč *</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: 'rgba(200,200,200,0.18)',
                    borderColor: 'rgba(200,200,200,0.3)',
                    fontSize: 22,
                    fontWeight: 'bold',
                  }
                ]}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                autoFocus
              />

              {/* Důvod / Popis */}
              <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>Důvod / Popis transakce *</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={activeFormType === 'in' ? "Např. Honorář za koncert Klášterec" : "Např. Nákup nových kabely ke zvuku"}
                placeholderTextColor={theme.textSecondary}
              />

              {/* Doklad z galerie */}
              <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>Přiložit účetní doklad (z galerie)</ThemedText>
              {receiptImageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: receiptImageUri }} style={styles.imagePreview} />
                  <Pressable style={styles.removeImageBtn} onPress={() => setReceiptImageUri(null)}>
                    <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor="#e91e63" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[styles.pickGalleryBtn, { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.3)' }]}
                  onPress={handlePickReceiptImage}
                >
                  <SymbolView name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }} size={24} tintColor="#2196f3" />
                  <ThemedText type="smallBold" style={{ marginLeft: 10, color: '#2196f3' }}>
                    Vybrat fotku paragonu z galerie
                  </ThemedText>
                </Pressable>
              )}

              {/* Tlačítka Uložit / Zrušit */}
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#e91e63' }]}
                  onPress={handleCancelForm}
                  disabled={isSaving}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>Zrušit</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.modalBtn, { backgroundColor: activeFormType === 'in' ? '#4caf50' : '#f44336' }]}
                  onPress={handleSaveTransaction}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: '#fff' }}>
                      {activeFormType === 'in' ? 'Uložit příjem' : 'Uložit výdej'}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </ThemedView>
          ) : treasuryTab === 'doklady' ? (
            /* TAB: DOKLADY */
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={{ fontSize: 18 }}>Přiložené účetní doklady ({receiptTransactions.length})</ThemedText>
              </View>

              <View style={styles.receiptGrid}>
                {receiptTransactions.map(t => (
                  <Pressable key={t.id} style={styles.receiptGridCard} onPress={() => setViewReceiptUrl(t.receiptUrl || null)}>
                    {t.receiptUrl ? (
                      <Image source={{ uri: t.receiptUrl }} style={styles.receiptThumbnail} />
                    ) : (
                      <View style={styles.receiptPlaceholder}>
                        <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={32} tintColor={theme.textSecondary} />
                      </View>
                    )}
                    <View style={styles.receiptCardInfo}>
                      <ThemedText type="smallBold" numberOfLines={1}>{t.description}</ThemedText>
                      <ThemedText type="small" style={{ color: t.type === 'in' ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                        {t.type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}

                {receiptTransactions.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20, width: '100%' }}>
                    Zatím nejsou přiloženy žádné fotografie paragonů či účtenek z galerie.
                  </ThemedText>
                )}
              </View>
            </View>
          ) : treasuryTab === 'kniha_jizd' ? (
            /* TAB: KNIHA JÍZD & SEZNAM VOZIDEL */
            <View style={styles.sectionContainer}>
              {/* KNIHA JÍZD - PROJEZDĚNÉ CESTOVNÉ */}
              <View style={styles.sectionHeader}>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setIsRidesCollapsed(!isRidesCollapsed)}
                >
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={18}
                    tintColor={theme.text}
                    style={{ transform: [{ rotate: isRidesCollapsed ? '0deg' : '90deg' }] }}
                  />
                  <ThemedText type="subtitle" style={{ fontSize: 18 }}>Kniha jízd ({rides.length})</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.addBtn, { backgroundColor: '#4caf50', paddingHorizontal: 10 }]}
                  onPress={() => setShowAddRideModal(true)}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={18} tintColor="#fff" />
                </Pressable>
              </View>

              {!isRidesCollapsed && (
                <View style={[styles.list, { marginBottom: Spacing.four }]}>
                  {rides.map(ride => {
                    const isExpanded = expandedRideIds.has(ride.id);

                    return (
                      <ThemedView key={ride.id} type="backgroundElement" style={[styles.card, { borderLeftColor: '#f44336', borderLeftWidth: 4 }]}>
                        {/* ROZBALOVACÍ TLAČÍTKO / ŘÁDEK (Ve sbaleném stavu JEN Cíl a částka) */}
                        <Pressable style={styles.cardRow} onPress={() => toggleRideExpand(ride.id)}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold', color: '#f44336' }}>
                              {getCleanTitle(ride.destination)}
                            </ThemedText>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ThemedText type="subtitle" style={{ color: '#f44336', fontWeight: 'bold', fontSize: 17 }}>
                              - {formatCurrency(ride.totalCost)}
                            </ThemedText>

                            <SymbolView
                              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                              size={16}
                              tintColor={theme.textSecondary}
                              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                            />
                          </View>
                        </Pressable>

                        {/* DETAIL JÍZDY (Zobrazí se AŽ po rozbalení se všemi detaily) */}
                        {isExpanded && (
                          <View style={styles.expandedDetailBox}>
                            <View style={{ gap: 4, marginBottom: 8 }}>
                              <ThemedText type="smallBold">
                                📍 Akce / Cíl: <ThemedText type="small">{ride.destination}</ThemedText>
                              </ThemedText>

                              <ThemedText type="smallBold">
                                🚗 Vozidlo: <ThemedText type="small">{ride.vehicleModel}</ThemedText>
                              </ThemedText>

                              <ThemedText type="smallBold">
                                👤 Řidič / Majitel: <ThemedText type="small">{ride.driverName}</ThemedText>
                              </ThemedText>

                              <ThemedText type="smallBold">
                                📅 Datum jízdy: <ThemedText type="small">{ride.date}</ThemedText>
                              </ThemedText>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                              <View style={styles.paramTag}>
                                <ThemedText type="small" style={{ fontSize: 11, fontWeight: 'bold' }}>
                                  🛣 Ujeto: {ride.distanceKm} km
                                </ThemedText>
                              </View>
                              <View style={styles.paramTag}>
                                <ThemedText type="small" style={{ fontSize: 11 }}>
                                  ⛽ Cena paliva: {ride.fuelPrice} Kč/jednotku
                                </ThemedText>
                              </View>
                              {ride.addedToTreasury && (
                                <View style={[styles.statusBadge, { backgroundColor: 'rgba(244,67,54,0.15)' }]}>
                                  <ThemedText type="smallBold" style={{ color: '#f44336', fontSize: 10 }}>
                                    💰 Strženo z pokladny
                                  </ThemedText>
                                </View>
                              )}
                            </View>

                            {activeRoleView === 'admin' && (
                              <View style={styles.cardFooter}>
                                <Pressable onPress={() => openEditRide(ride)} style={styles.deleteInlineBtn}>
                                  <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#2196f3" />
                                  <ThemedText type="small" style={{ color: '#2196f3' }}>Upravit</ThemedText>
                                </Pressable>

                                <Pressable onPress={() => handleDeleteRide(ride)} style={styles.deleteInlineBtn}>
                                  <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
                                  <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat jízdu</ThemedText>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        )}
                      </ThemedView>
                    );
                  })}

                  {rides.length === 0 && (
                    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 10, marginBottom: 10 }}>
                      Zatím nejsou zaznamenány žádné jízdy.
                    </ThemedText>
                  )}
                </View>
              )}

              {/* SEZNAM VOZIDEL */}
              <View style={styles.sectionHeader}>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setIsVehiclesCollapsed(!isVehiclesCollapsed)}
                >
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={18}
                    tintColor={theme.text}
                    style={{ transform: [{ rotate: isVehiclesCollapsed ? '0deg' : '90deg' }] }}
                  />
                  <ThemedText type="subtitle" style={{ fontSize: 18 }}>Seznam vozidel ({vehicles.length})</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.addBtn, { backgroundColor: '#2196f3' }]}
                  onPress={() => setShowAddVehicleModal(true)}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={18} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', marginLeft: 4 }}>
                    Přidat vozidlo
                  </ThemedText>
                </Pressable>
              </View>

              {!isVehiclesCollapsed && (
                <View style={styles.list}>
                  {vehicles.map(vehicle => (
                    <ThemedView key={vehicle.id} type="backgroundElement" style={styles.card}>
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                              🚗 {vehicle.model}
                            </ThemedText>

                            <View style={styles.plateTag}>
                              <ThemedText type="smallBold" style={{ fontSize: 12, letterSpacing: 1, color: '#000' }}>
                                {vehicle.plate}
                              </ThemedText>
                            </View>
                          </View>

                          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                            👤 Majitel / Řidič: <ThemedText type="smallBold">{vehicle.owner}</ThemedText>
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.vehicleParamsRow}>
                        <View style={styles.paramTag}>
                          <ThemedText type="smallBold" style={{ fontSize: 11, color: theme.text }}>
                            {fuelLabels[vehicle.fuel] || vehicle.fuel}
                          </ThemedText>
                        </View>

                        <View style={styles.paramTag}>
                          <ThemedText type="smallBold" style={{ fontSize: 11, color: theme.text }}>
                            📊 {vehicle.consumption} {vehicle.fuel === 'elektro' ? 'kWh/100km' : 'l/100km'}
                          </ThemedText>
                        </View>

                        <View style={styles.paramTag}>
                          <ThemedText type="smallBold" style={{ fontSize: 11, color: theme.text }}>
                            👥 {vehicle.seats} míst
                          </ThemedText>
                        </View>

                        <View style={[styles.paramTag, { backgroundColor: vehicle.hasTowBar ? 'rgba(76,175,80,0.18)' : 'rgba(200,200,200,0.12)' }]}>
                          <ThemedText type="smallBold" style={{ fontSize: 11, color: vehicle.hasTowBar ? '#4caf50' : theme.textSecondary }}>
                            🧲 Tažné: {vehicle.hasTowBar ? 'Ano' : 'Ne'}
                          </ThemedText>
                        </View>
                      </View>

                      {activeRoleView === 'admin' && (
                        <View style={styles.cardFooter}>
                          <Pressable onPress={() => handleDeleteVehicle(vehicle)} style={styles.deleteInlineBtn}>
                            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
                            <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat vozidlo</ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </ThemedView>
                  ))}

                  {vehicles.length === 0 && (
                    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                      Zatím nemáte zaregistrována žádná vozidla pro cestovné kapely.
                    </ThemedText>
                  )}
                </View>
              )}
            </View>
          ) : (
            /* AKCE B: HLAVNÍ PŘEHLED PŘÍJMŮ A VÝDAJŮ (Rozbalovací položky) */
            <View>
              {/* HLAVNÍ KARTA SE STAVEM POKLADNY */}
              <ThemedView type="backgroundElement" style={styles.balanceBox}>
                 <View style={{ alignItems: 'center' }}>
                   <ThemedText type="smallBold" themeColor="textSecondary">Aktuální stav pokladny kapely</ThemedText>
                   <ThemedText
                     type="title"
                     style={{
                       fontSize: 32,
                       fontWeight: 'bold',
                       color: totalBalance >= 0 ? '#4caf50' : '#f44336',
                       marginTop: 4,
                     }}
                   >
                     {formatCurrency(totalBalance)}
                   </ThemedText>
                 </View>

                 <View style={styles.statsRow}>
                   <View style={styles.statItem}>
                     <ThemedText type="small" themeColor="textSecondary">Příjmy:</ThemedText>
                     <ThemedText type="smallBold" style={{ color: '#4caf50' }}>+ {formatCurrency(actualIncome)}</ThemedText>
                   </View>
                   <View style={styles.statDivider} />
                   <View style={styles.statItem}>
                     <ThemedText type="small" themeColor="textSecondary">Výdaje:</ThemedText>
                     <ThemedText type="smallBold" style={{ color: '#f44336' }}>- {formatCurrency(totalExpense)}</ThemedText>
                   </View>
                   {plannedIncome > 0 && (
                     <>
                       <View style={styles.statDivider} />
                       <View style={styles.statItem}>
                         <ThemedText type="small" themeColor="textSecondary">Plánované:</ThemedText>
                         <ThemedText type="smallBold" style={{ color: '#ffc107' }}>+ {formatCurrency(plannedIncome)}</ThemedText>
                       </View>
                     </>
                   )}
                 </View>

                 {/* Tlačítko Vynulovat pokladnu pro Admina */}
                 {activeRoleView === 'admin' && transactions.length > 0 && (
                   <Pressable style={styles.resetBtn} onPress={handleResetTreasury}>
                     <SymbolView name={{ ios: 'trash', android: 'delete_sweep', web: 'delete_sweep' }} size={16} tintColor="#e91e63" />
                     <ThemedText type="smallBold" style={{ color: '#e91e63', fontSize: 12 }}>
                       Vynulovat pokladnu
                     </ThemedText>
                   </Pressable>
                 )}
              </ThemedView>

              {/* FILTROVACÍ CHIPY PRO PŘEHLED (Vše na 1. místě) */}
              <View style={styles.filterChipRow}>
                {[
                  { key: 'all', label: 'Vše', color: '#2196f3' },
                  { key: 'in', label: 'Příjmy', color: '#4caf50' },
                  { key: 'out', label: 'Výdaje', color: '#f44336' },
                  { key: 'planned', label: 'Plánované', color: '#ffc107' },
                ].map(chip => {
                  const isSelected = filterMode === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSelected ? chip.color : 'rgba(200,200,200,0.18)',
                          borderColor: isSelected ? chip.color : 'rgba(200,200,200,0.3)',
                        }
                      ]}
                      onPress={() => setFilterMode(chip.key as any)}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: isSelected ? '#fff' : theme.text, fontSize: 11 }}
                      >
                        {chip.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* SEZNAM TRANSAKCÍ (Příjmy zeleně, Výdaje červeně, Plánované žlutě, Rozbalovací položky) */}
              <View style={styles.sectionContainer}>
                <ThemedText type="subtitle" style={{ fontSize: 18, marginBottom: Spacing.two }}>
                  Přehled příjmů a výdajů ({filteredOverviewItems.length})
                </ThemedText>

                <View style={styles.list}>
                  {filteredOverviewItems.map(item => {
                    const isExpanded = expandedItemIds.has(item.id);
                    const isPlanned = item.isAutoConcert && item.concertStatus !== 'past';

                    let themeColor = '#4caf50';
                    if (item.isCancelled) {
                      themeColor = '#2196f3'; // Modrá pro zrušené akce
                    } else if (item.type === 'out') {
                      themeColor = '#f44336';
                    } else if (isPlanned) {
                      themeColor = '#ffc107';
                    }

                    return (
                      <ThemedView
                        key={item.id}
                        type="backgroundElement"
                        style={[
                          styles.card,
                          {
                            borderLeftColor: themeColor,
                            borderLeftWidth: 5,
                            backgroundColor: item.isCancelled
                              ? 'rgba(33,150,243,0.08)'
                              : (isPlanned ? 'rgba(255,193,7,0.08)' : undefined),
                          }
                        ]}
                      >
                        {/* ROZBALOVACÍ TLAČÍTKO / ŘÁDEK (Barevný text podle typu transakce) */}
                        <Pressable style={styles.cardRow} onPress={() => toggleItemExpand(item.id)}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <ThemedText
                              type="subtitle"
                              style={{
                                fontSize: 16,
                                fontWeight: 'bold',
                                color: themeColor,
                                textDecorationLine: item.isCancelled ? 'line-through' : 'none',
                              }}
                            >
                              {getCleanTitle(item.title)}
                            </ThemedText>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ThemedText
                              type="subtitle"
                              style={{
                                color: themeColor,
                                fontWeight: 'bold',
                                fontSize: 17,
                                textDecorationLine: item.isCancelled ? 'line-through' : 'none',
                              }}
                            >
                              {item.type === 'in' ? '+' : '-'}{formatCurrency(item.amount)}
                            </ThemedText>

                            <SymbolView
                              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                              size={16}
                              tintColor={theme.textSecondary}
                              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                            />
                          </View>
                        </Pressable>

                        {/* DETAIL POLOŽKY (Zobrazí se AŽ po rozbalení) */}
                        {isExpanded && (
                          <View style={styles.expandedDetailBox}>
                            <View style={{ gap: 4, marginBottom: 8 }}>
                              {item.description && (
                                <ThemedText type="smallBold">
                                  📌 Popis: <ThemedText type="small">{item.description}</ThemedText>
                                </ThemedText>
                              )}

                              {item.location && (
                                <ThemedText type="smallBold">
                                  📍 Místo konání: <ThemedText type="small">{item.location}</ThemedText>
                                </ThemedText>
                              )}

                              <ThemedText type="smallBold">
                                📅 Datum: <ThemedText type="small">{item.concertDate ? item.concertDate : formatDate(item.timestamp)}</ThemedText>
                              </ThemedText>

                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={[styles.statusBadge, { backgroundColor: themeColor }]}>
                                  <ThemedText type="smallBold" style={{ color: (isPlanned || item.isCancelled) ? '#000' : '#fff', fontSize: 10 }}>
                                    {item.isCancelled
                                      ? '🔵 Zrušená akce (Nezapočteno)'
                                      : (isPlanned ? '🟡 Plánovaný (Budoucí akce)' : (item.type === 'in' ? '🟢 Skutečný příjem' : '🔴 Výdej'))}
                                  </ThemedText>
                                </View>
                              </View>
                            </View>

                            {item.isCancelled && (
                              <ThemedText type="small" style={{ color: '#2196f3', fontStyle: 'italic', marginBottom: 6 }}>
                                ⚠️ Tato akce byla zrušena – částka se nezapočítává do stavu pokladny.
                              </ThemedText>
                            )}

                            {isPlanned && !item.isCancelled && (
                              <ThemedText type="small" style={{ color: '#ffc107', fontStyle: 'italic', marginBottom: 6 }}>
                                ⚠️ Tento příjem z akce se započítá do stavu pokladny automaticky až po skončení akce.
                              </ThemedText>
                            )}

                            {item.receiptUrl && (
                              <Pressable style={styles.receiptDetailBtn} onPress={() => setViewReceiptUrl(item.receiptUrl || null)}>
                                <SymbolView name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} size={16} tintColor="#2196f3" />
                                <ThemedText type="smallBold" style={{ color: '#2196f3', marginLeft: 6 }}>
                                  Zobrazit účetní doklad (fotka z galerie)
                                </ThemedText>
                              </Pressable>
                            )}

                            {!item.isAutoConcert && activeRoleView === 'admin' && item.originalTransaction && (
                              <View style={styles.cardFooter}>
                                <Pressable onPress={() => openEditTransaction(item.originalTransaction!)} style={styles.deleteInlineBtn}>
                                  <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#2196f3" />
                                  <ThemedText type="small" style={{ color: '#2196f3' }}>Upravit</ThemedText>
                                </Pressable>

                                <Pressable onPress={() => handleDeleteTransaction(item.originalTransaction!)} style={styles.deleteInlineBtn}>
                                  <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
                                  <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat</ThemedText>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        )}
                      </ThemedView>
                    );
                  })}

                  {filteredOverviewItems.length === 0 && (
                    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                      Žádné odpovídající položky nebyly nalezeny.
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* MODAL PRO PŘIDÁNÍ VOZIDLA */}
      <Modal visible={showAddVehicleModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={{ flex: 1 }}>
          <AddVehicleForm
            members={bandMembers}
            onSave={handleSaveVehicle}
            onCancel={() => setShowAddVehicleModal(false)}
          />
        </ThemedView>
      </Modal>

      {/* MODAL PRO ZAZNAMENÁNÍ / ÚPRAVU JÍZDY */}
      <Modal visible={showAddRideModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={{ flex: 1 }}>
          <AddRideForm
            initialRide={editingRide}
            vehicles={vehicles}
            concerts={concerts}
            onSave={handleSaveRide}
            onCancel={() => {
              setShowAddRideModal(false);
              setEditingRide(null);
            }}
          />
        </ThemedView>
      </Modal>

      {/* MODAL PRO CELOOBRAZOVKOVÝ NÁHLED DOKLADU */}
      <Modal visible={!!viewReceiptUrl} transparent animationType="fade">
        <View style={styles.fullImageOverlay}>
          <Pressable style={styles.fullImageCloseBtn} onPress={() => setViewReceiptUrl(null)}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={28} tintColor="#fff" />
          </Pressable>

          {viewReceiptUrl && (
            <Image source={{ uri: viewReceiptUrl }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 4,
    paddingBottom: Spacing.six,
  },
  balanceBox: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(233,30,99,0.12)',
    marginTop: 4,
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  sectionContainer: {
    marginTop: Spacing.four,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expandedDetailBox: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  receiptDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33,150,243,0.12)',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  plateTag: {
    backgroundColor: '#ffeb3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  vehicleParamsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  paramTag: {
    backgroundColor: 'rgba(200,200,200,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  deleteInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  receiptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  receiptGridCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(200,200,200,0.12)',
  },
  receiptThumbnail: {
    width: '100%',
    height: 120,
  },
  receiptPlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(200,200,200,0.2)',
  },
  receiptCardInfo: {
    padding: 8,
  },
  modalContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 16,
  },
  pickGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.one,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: Spacing.one,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: Spacing.two,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.five,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
});
