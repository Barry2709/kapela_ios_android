import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Modal, Alert, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Rehearsal, Concert, Inquiry, Absence, BandMember } from '@/types';
import {
  getRehearsals,
  getConcerts,
  getInquiries,
  getAbsences,
  deleteRehearsal,
  updateRehearsal,
  deleteConcert,
  updateInquiryStatus,
  deleteInquiry,
  deleteAbsence,
  getBandMembers,
  addConcert,
  updateConcert,
  addRehearsal,
  addAbsence,
  notifyAdminsAboutAttendance
} from '@/services/firebaseService';
import { AddConcertForm } from '@/components/add-concert-form';
import { AddRehearsalForm } from '@/components/add-rehearsal-form';
import { AddAbsenceForm } from '@/components/add-absence-form';
import { SetlistEditorModal } from '@/components/setlist-editor-modal';
import { StageplanModal } from '@/components/stageplan-modal';
import { EventsCalendar } from '@/components/calendar/EventsCalendar';

export default function EventsScreen() {
  const theme = useTheme();
  const { activeBand, activeRoleView, eventsTab } = useAppStore();

  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);

  // Přepínač mezi Koncerty a Zkouškami v záložce Akce ('all' | 'koncerty' | 'zkousky')
  const [actionFilterMode, setActionFilterMode] = useState<'all' | 'koncerty' | 'zkousky'>('all');

  const [showAddConcertModal, setShowAddConcertModal] = useState(false);
  const [showAddRehearsalModal, setShowAddRehearsalModal] = useState(false);
  const [showAddAbsenceModal, setShowAddAbsenceModal] = useState(false);

  const [editingRehearsal, setEditingRehearsal] = useState<Rehearsal | null>(null);
  const [editingConcert, setEditingConcert] = useState<Concert | null>(null);
  const [selectedConcertForSetlist, setSelectedConcertForSetlist] = useState<Concert | null>(null);
  const [selectedConcertForStageplan, setSelectedConcertForStageplan] = useState<Concert | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const [showCalendar, setShowCalendar] = useState(false);
  const [showFreeTerms, setShowFreeTerms] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const show2sToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  // Kontrola pro záložku Akce
  const isAkceTab = eventsTab === 'akce' || (eventsTab as string) === 'koncerty' || (eventsTab as string) === 'zkousky' || !eventsTab;

  useEffect(() => {
    if (activeBand) {
      if (isAkceTab) {
        loadConcerts();
        loadRehearsals();
        loadAbsences();
      } else if (eventsTab === 'poptavky') {
        loadInquiries();
      } else if (eventsTab === 'absence') {
        loadAbsences();
        loadBandMembers();
      }
    }
  }, [activeBand, eventsTab]);

  const loadRehearsals = async () => {
    if (!activeBand) return;
    try {
      const data = await getRehearsals(activeBand.id);

      const toIsoDate = (dateStr: string) => {
        if (dateStr.includes('.')) {
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        return dateStr;
      };

      // Zrušené zkoušky se berou rovnou jako proběhlé (minulost)
      const futureRehearsals = data.filter(r => !r.isCancelled && getEventStatus(r.date, r.time) !== 'past');
      const pastRehearsals = data.filter(r => r.isCancelled || getEventStatus(r.date, r.time) === 'past');

      futureRehearsals.sort((a, b) => {
        const keyA = `${toIsoDate(a.date)}T${a.time || '00:00'}`;
        const keyB = `${toIsoDate(b.date)}T${b.time || '00:00'}`;
        return keyA.localeCompare(keyB);
      });

      pastRehearsals.sort((a, b) => {
        const keyA = `${toIsoDate(a.date)}T${a.time || '00:00'}`;
        const keyB = `${toIsoDate(b.date)}T${b.time || '00:00'}`;
        return keyB.localeCompare(keyA);
      });

      setRehearsals([...futureRehearsals, ...pastRehearsals]);
    } catch (e) {
      console.error("Nepodařilo se načíst zkoušky:", e);
    }
  };

  const loadConcerts = async () => {
    if (!activeBand) return;
    try {
      const data = await getConcerts(activeBand.id);

      const toIsoDate = (dateStr: string) => {
        if (dateStr.includes('.')) {
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        return dateStr;
      };

      // Zrušené koncerty se berou rovnou jako proběhlé (minulost)
      const futureConcerts = data.filter(c => !c.isCancelled && getEventStatus(c.date, c.startTime, c.endTime) !== 'past');
      const pastConcerts = data.filter(c => c.isCancelled || getEventStatus(c.date, c.startTime, c.endTime) === 'past');

      futureConcerts.sort((a, b) => {
        const keyA = `${toIsoDate(a.date)}T${a.startTime || '00:00'}`;
        const keyB = `${toIsoDate(b.date)}T${b.startTime || '00:00'}`;
        return keyA.localeCompare(keyB);
      });

      pastConcerts.sort((a, b) => {
        const keyA = `${toIsoDate(a.date)}T${a.startTime || '00:00'}`;
        const keyB = `${toIsoDate(b.date)}T${b.startTime || '00:00'}`;
        return keyB.localeCompare(keyA);
      });

      setConcerts([...futureConcerts, ...pastConcerts]);
    } catch (e) {
      console.error("Nepodařilo se načíst koncerty:", e);
    }
  };

  const loadInquiries = async () => {
    if (!activeBand) return;
    try {
      const data = await getInquiries(activeBand.id);
      setInquiries(data);
    } catch (e) {
      console.error("Nepodařilo se načíst poptávky:", e);
    }
  };

  const loadAbsences = async () => {
    if (!activeBand) return;
    try {
      const data = await getAbsences(activeBand.id);
      setAbsences(data);
    } catch (e) {
      console.error("Nepodařilo se načíst absence:", e);
    }
  };

  const loadBandMembers = async () => {
    if (!activeBand) return;
    try {
      const data = await getBandMembers(activeBand.id);
      setBandMembers(data);
    } catch (e) {
      console.error("Nepodařilo se načíst členy kapely:", e);
    }
  };

  const openAddConcert = () => {
    setEditingConcert(null);
    setShowAddConcertModal(true);
  };

  const openEditConcert = (concert: Concert) => {
    setEditingConcert(concert);
    setShowAddConcertModal(true);
  };

  const handleSaveConcert = async (concertData: Omit<Concert, 'id'>) => {
    if (!activeBand) return;
    try {
      const myMemberId = bandMembers.find(m =>
        (currentUser?.memberId && m.id === currentUser.memberId) ||
        (currentUser?.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.displayName && m.nickname && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase())
      )?.id || currentUser?.id;

      if (editingConcert) {
        await updateConcert(activeBand.id, editingConcert.id, concertData, editingConcert, myMemberId);
        show2sToast("Koncert byl úspěšně upraven.");
      } else {
        await addConcert(activeBand.id, {
          ...concertData,
          bandId: activeBand.id,
        }, myMemberId);
        show2sToast("Koncert byl úspěšně uložen.");
      }
      setShowAddConcertModal(false);
      setEditingConcert(null);
      loadConcerts();
    } catch (e) {
      console.error("Chyba při ukládání koncertu:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit koncert.");
    }
  };

  const handleDeleteConcert = (concert: Concert) => {
    Alert.alert(
      "Smazat koncert",
      `Opravdu chcete smazat koncert "${concert.title}"?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteConcert(activeBand.id, concert.id);
            loadConcerts();
          }
        }
      ]
    );
  };

  const handleSaveSetlistFromCard = async (setlistIds: string[]) => {
    if (!activeBand || !selectedConcertForSetlist) return;
    try {
      await updateConcert(activeBand.id, selectedConcertForSetlist.id, {
        setlist: setlistIds
      });
      setSelectedConcertForSetlist(null);
      loadConcerts();
      Alert.alert("Úspěch", "Setlist byl úspěšně uložen na akce.");
    } catch (e) {
      console.error("Chyba při ukládání setlistu:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit setlist.");
    }
  };

  const openAddRehearsal = () => {
    setEditingRehearsal(null);
    setShowAddRehearsalModal(true);
  };

  const openEditRehearsal = (rehearsal: Rehearsal) => {
    setEditingRehearsal(rehearsal);
    setShowAddRehearsalModal(true);
  };

  const handleSaveRehearsal = async (rehearsalData: Omit<Rehearsal, 'id'>) => {
    if (!activeBand) return;
    try {
      const myMemberId = bandMembers.find(m =>
        (currentUser?.memberId && m.id === currentUser.memberId) ||
        (currentUser?.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.displayName && m.nickname && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase())
      )?.id || currentUser?.id;

      if (editingRehearsal) {
        await updateRehearsal(
          activeBand.id,
          editingRehearsal.id,
          {
            ...rehearsalData,
            bandId: activeBand.id,
          },
          editingRehearsal,
          myMemberId
        );
        show2sToast("Zkouška byla úspěšně upravena.");
      } else {
        await addRehearsal(
          activeBand.id,
          {
            ...rehearsalData,
            bandId: activeBand.id,
          },
          myMemberId
        );
        show2sToast("Zkouška byla úspěšně uložena.");
      }
      setShowAddRehearsalModal(false);
      setEditingRehearsal(null);
      loadRehearsals();
    } catch (e) {
      console.error("Chyba při ukládání zkoušky:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit zkoušku.");
    }
  };
      loadRehearsals();
      Alert.alert("Úspěch", "Zkouška byla úspěšně uložena.");
    } catch (e) {
      console.error("Chyba při ukládání zkoušky:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit zkoušku.");
    }
  };

  const handleToggleCancelRehearsal = async (rehearsal: Rehearsal) => {
    if (!activeBand) return;
    const newCancelled = !rehearsal.isCancelled;
    try {
      await updateRehearsal(activeBand.id, rehearsal.id, { isCancelled: newCancelled });
      loadRehearsals();
    } catch (e) {
      console.error("Chyba při změně stavu zkoušky:", e);
      Alert.alert("Chyba", "Nepodařilo se změnit stav zkoušky.");
    }
  };

  const handleDeleteRehearsal = (rehearsal: Rehearsal) => {
    Alert.alert(
      "Smazat zkoušku",
      `Opravdu chcete smazat zkoušku dne ${rehearsal.date}?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteRehearsal(activeBand.id, rehearsal.id);
            loadRehearsals();
          }
        }
      ]
    );
  };

  const handleInquiryStatusChange = async (inquiry: Inquiry, status: 'accepted' | 'declined') => {
    if (!activeBand) return;
    try {
      await updateInquiryStatus(activeBand.id, inquiry.id, status);
      loadInquiries();
    } catch (e) {
      console.error("Chyba při změně stavu poptávky:", e);
    }
  };

  const handleDeleteInquiry = (inquiry: Inquiry) => {
    Alert.alert(
      "Smazat poptávku",
      `Opravdu chcete smazat poptávku "${inquiry.title}"?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteInquiry(activeBand.id, inquiry.id);
            loadInquiries();
          }
        }
      ]
    );
  };

  const handleSaveAbsence = async (absenceData: Omit<Absence, 'id'>) => {
    if (!activeBand) return;
    try {
      await addAbsence(activeBand.id, absenceData);
      setShowAddAbsenceModal(false);
      loadAbsences();
      Alert.alert("Úspěch", "Absence byla úspěšně zaznamenána.");
    } catch (e) {
      console.error("Chyba při ukládání absence:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit absenci.");
    }
  };

  const handleDeleteAbsence = (absence: Absence) => {
    Alert.alert(
      "Smazat absenci",
      `Opravdu chcete smazat absenci pro člena ${absence.memberName}?`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            if (!activeBand) return;
            await deleteAbsence(activeBand.id, absence.id);
            loadAbsences();
          }
        }
      ]
    );
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

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  const getSortableDateKey = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const renderFreeTerms = () => {
    const today = new Date();
    const months: { monthName: string; dates: { dateStr: string; dayName: string; isFree: boolean; eventTitle?: string }[] }[] = [];

    const monthNames = [
      'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červení',
      'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    for (let m = 0; m < 12; m++) {
      const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
      const mName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const monthDates: { dateStr: string; dayName: string; isFree: boolean; eventTitle?: string }[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const checkDate = new Date(d.getFullYear(), d.getMonth(), day);
        const dayOfWeek = checkDate.getDay();

        if (dayOfWeek === 5 || dayOfWeek === 6) {
          const dayStr = String(day).padStart(2, '0');
          const monthStr = String(d.getMonth() + 1).padStart(2, '0');
          const dateFormatted = `${dayStr}.${monthStr}.${d.getFullYear()}`;

          const existingEvent = existingEvents.find(e => e.date === dateFormatted);
          monthDates.push({
            dateStr: dateFormatted,
            dayName: dayOfWeek === 5 ? 'Pátek' : 'Sobota',
            isFree: !existingEvent,
            eventTitle: existingEvent?.title,
          });
        }
      }

      if (monthDates.length > 0) {
        months.push({ monthName: mName, dates: monthDates });
      }
    }

    return (
      <View style={styles.freeTermsContainer}>
        {months.map((m, idx) => (
          <ThemedView key={idx} type="backgroundElement" style={styles.freeTermsMonthCard}>
            <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold', marginBottom: Spacing.two }}>
              📅 {m.monthName}
            </ThemedText>

            <View style={styles.freeTermsGrid}>
              {m.dates.map((d, dIdx) => (
                <View
                  key={dIdx}
                  style={[
                    styles.freeTermBadge,
                    { backgroundColor: d.isFree ? 'rgba(76,175,80,0.18)' : 'rgba(244,67,54,0.15)', borderColor: d.isFree ? '#4caf50' : '#f44336' }
                  ]}
                >
                  <ThemedText type="smallBold" style={{ color: d.isFree ? '#4caf50' : '#f44336', fontSize: 13 }}>
                    {d.dayName} {d.dateStr}
                  </ThemedText>
                  <ThemedText type="small" style={{ fontSize: 11, color: d.isFree ? '#4caf50' : '#f44336' }}>
                    {d.isFree ? '🟢 Volno' : `🔴 ${d.eventTitle}`}
                  </ThemedText>
                </View>
              ))}
            </View>
          </ThemedView>
        ))}
      </View>
    );
  };

  const existingEvents = [
    ...concerts.map(c => ({ date: c.date, title: c.title })),
    ...rehearsals.map(r => ({ date: r.date, title: `Zkouška ${r.location}` })),
  ];

  const titleMap = {
    akce: 'Přehled akcí a zkoušek',
    poptavky: 'Poptávky hraní',
    rezervace: 'Rezervace termínů',
    absence: 'Absence členů',
  };

  interface AttendanceEditState {
    member: BandMember;
    eventId: string;
    eventType: 'rehearsal' | 'concert' | 'inquiry';
    status: 'yes' | 'no' | 'pending';
    note: string;
  }

  const [editAttendanceState, setEditAttendanceState] = useState<AttendanceEditState | null>(null);

  const handleMemberClick = (
    member: BandMember,
    eventId: string,
    eventType: 'rehearsal' | 'concert' | 'inquiry',
    attendeesRecord?: Record<string, any>
  ) => {
    const isAdmin = activeRoleView === 'admin' || currentUser?.role === 'admin';
    const isSelf = member.id === currentUser?.id;

    if (!isAdmin && !isSelf) {
      Alert.alert("Docházka", "Účast ostatních členů může upravovat pouze kapelník.");
      return;
    }

    const resp = attendeesRecord?.[member.id];
    let currentStatus: 'yes' | 'no' | 'pending' = 'pending';
    let currentNote = '';

    if (resp) {
      if (typeof resp === 'string') {
        currentStatus = resp as any;
      } else {
        currentStatus = resp.status || 'pending';
        currentNote = resp.note || '';
      }
    }

    setEditAttendanceState({
      member,
      eventId,
      eventType,
      status: currentStatus,
      note: currentNote,
    });
  };

  const saveMemberAttendance = async () => {
    if (!editAttendanceState || !activeBand?.id) return;
    const { member, eventId, eventType, status, note } = editAttendanceState;

    try {
      let eventTitle = 'Akce';
      if (eventType === 'rehearsal') {
        const rehearsal = rehearsals.find(r => r.id === eventId);
        if (!rehearsal) return;
        eventTitle = `Zkouška (${rehearsal.date})`;
        const currentAtt = { ...(rehearsal.attendees || {}) };

        if (status === 'pending') {
          delete currentAtt[member.id];
        } else {
          currentAtt[member.id] = {
            status,
            note: note.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };
        }

        await updateRehearsal(activeBand.id, eventId, { attendees: currentAtt });
        loadRehearsals();
      } else if (eventType === 'concert') {
        const concert = concerts.find(c => c.id === eventId);
        if (!concert) return;
        eventTitle = concert.title;
        const currentAtt = { ...(concert.attendees || {}) };

        if (status === 'pending') {
          delete currentAtt[member.id];
        } else {
          currentAtt[member.id] = {
            status,
            note: note.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };
        }

        await updateConcert(activeBand.id, eventId, { attendees: currentAtt });
        loadConcerts();
      } else if (eventType === 'inquiry') {
        const inquiry = inquiries.find(i => i.id === eventId);
        if (!inquiry) return;
        eventTitle = inquiry.title;
        const currentAtt = { ...(inquiry.attendees || {}) };

        if (status === 'pending') {
          delete currentAtt[member.id];
        } else {
          currentAtt[member.id] = {
            status,
            note: note.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };
        }

        await updateInquiryStatus(activeBand.id, eventId, inquiry.status || 'pending', currentAtt);
        loadInquiries();
      }

      const memberName = member.nickname || member.firstName;
      notifyAdminsAboutAttendance(activeBand.id, memberName, eventTitle, status, eventType, note);

      setEditAttendanceState(null);
    } catch (e) {
      console.error("Chyba při ukládání docházky člena:", e);
      Alert.alert("Chyba", "Nepodařilo se uložit docházku.");
    }
  };

  const renderAttendanceBreakdown = (
    eventId: string,
    attendeesRecord?: Record<string, any>,
    eventType: 'rehearsal' | 'concert' | 'inquiry' = 'concert'
  ) => {
    const activeNonGuests = bandMembers.filter(m => !m.isGuest && m.isActive !== false);
    if (activeNonGuests.length === 0) return null;

    const goingMembers: BandMember[] = [];
    const notGoingMembers: { member: BandMember; note?: string }[] = [];
    const pendingMembers: BandMember[] = [];

    activeNonGuests.forEach(m => {
      const resp = attendeesRecord?.[m.id];

      if (!resp) {
        pendingMembers.push(m);
      } else {
        const status = typeof resp === 'string' ? resp : resp.status;
        const note = typeof resp === 'object' ? resp.note : undefined;

        if (status === 'yes') {
          goingMembers.push(m);
        } else if (status === 'no') {
          notGoingMembers.push({ member: m, note });
        } else {
          pendingMembers.push(m);
        }
      }
    });

    const isExpanded = expandedEvents[eventId] === true;

    const summaryParts = [];
    if (goingMembers.length > 0) summaryParts.push(`${goingMembers.length} můžou`);
    if (notGoingMembers.length > 0) summaryParts.push(`${notGoingMembers.length} nemůžou`);
    if (pendingMembers.length > 0) summaryParts.push(`${pendingMembers.length} čeká`);

    return (
      <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.15)' }}>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
          onPress={() => toggleEventExpanded(eventId)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} size={16} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ fontSize: 12 }}>
              Docházka: {summaryParts.join(' • ') || 'Zatím bez odpovědí'}
            </ThemedText>
          </View>
          <SymbolView
            name={{ ios: isExpanded ? 'chevron.up' : 'chevron.down', android: isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
            size={16}
            tintColor={theme.textSecondary}
          />
        </Pressable>

        {isExpanded && (
          <View style={{ marginTop: 8, gap: 8 }}>
            {goingMembers.length > 0 && (
              <View>
                <ThemedText type="smallBold" style={{ color: '#4caf50', marginBottom: 4 }}>
                  🟢 Můžou ({goingMembers.length}):
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {goingMembers.map(m => (
                    <Pressable
                      key={m.id}
                      style={styles.memberAttendanceBadgeYes}
                      onPress={() => handleMemberClick(m, eventId, eventType, attendeesRecord)}
                    >
                      <ThemedText type="small" style={{ color: '#4caf50', fontSize: 11, fontWeight: 'bold' }}>
                        {m.nickname || m.firstName}{m.id === currentUser?.id ? ' (Vy)' : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {notGoingMembers.length > 0 && (
              <View style={{ marginTop: 2 }}>
                <ThemedText type="smallBold" style={{ color: '#e91e63', marginBottom: 4 }}>
                  🔴 Nemůžou ({notGoingMembers.length}):
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {notGoingMembers.map(({ member: m, note }) => (
                    <Pressable
                      key={m.id}
                      style={styles.memberAttendanceBadgeNo}
                      onPress={() => handleMemberClick(m, eventId, eventType, attendeesRecord)}
                    >
                      <ThemedText type="small" style={{ color: '#e91e63', fontSize: 11, fontWeight: 'bold' }}>
                        {m.nickname || m.firstName}{note ? ` (${note})` : ''}{m.id === currentUser?.id ? ' (Vy)' : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {pendingMembers.length > 0 && (
              <View style={{ marginTop: 2 }}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                  ⚪ Čeká na odpověď ({pendingMembers.length}):
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {pendingMembers.map(m => (
                    <Pressable
                      key={m.id}
                      style={styles.memberAttendanceBadgePending}
                      onPress={() => handleMemberClick(m, eventId, eventType, attendeesRecord)}
                    >
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                        {m.nickname || m.firstName}{m.id === currentUser?.id ? ' (Vy)' : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Renderování karty koncertu
  const renderConcertCard = (concert: Concert) => {
    const status = getEventStatus(concert.date, concert.startTime, concert.endTime);

    return (
      <ThemedView
        key={`concert_${concert.id}`}
        type="backgroundElement"
        style={[
          styles.card,
          concert.isCancelled
            ? styles.cancelledCard
            : (status === 'ongoing' ? styles.ongoingCard : (status === 'past' ? styles.pastCard : styles.futureCard))
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                {concert.title}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: '#e91e63' }]}>
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>Koncert</ThemedText>
              </View>
            </View>

            <ThemedText type="default" style={{ fontWeight: 'bold', marginTop: 2 }}>
              📅 {formatDateDisplay(concert.date)} {concert.startTime ? `v ${concert.startTime}` : ''} {concert.endTime ? `- ${concert.endTime}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
              📍 {concert.location}
            </ThemedText>
          </View>

          <View style={styles.badgeColumn}>
            {concert.isCancelled && (
              <View style={[styles.statusBadge, { backgroundColor: '#e91e63' }]}>
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>Zrušeno</ThemedText>
              </View>
            )}
            {concert.isPrivate && (
              <View style={[styles.statusBadge, { backgroundColor: '#2196f3' }]}>
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>Soukromá</ThemedText>
              </View>
            )}
          </View>
        </View>

        {concert.price ? (
          <View style={styles.detailRow}>
            <ThemedText type="smallBold" themeColor="textSecondary">Cena: </ThemedText>
            <ThemedText type="small" style={{ fontWeight: 'bold' }}>{concert.price}</ThemedText>
          </View>
        ) : null}

        {/* Setlist tlačítko na kartě koncertu pro přístup všem členům */}
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: 'rgba(255,152,0,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255,152,0,0.3)',
          }}
          onPress={() => setSelectedConcertForSetlist(concert)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <SymbolView name={{ ios: 'music.note.list', android: 'queue_music', web: 'queue_music' }} size={16} tintColor="#ff9800" />
            <ThemedText type="smallBold" style={{ color: '#ff9800', fontSize: 12 }}>
              Setlist ({concert.setlist?.length || 0} skladeb)
            </ThemedText>
          </View>
          <ThemedText type="smallBold" style={{ color: '#ff9800', fontSize: 11 }}>
            {concert.setlist?.length ? 'Zobrazit / Upravit ➔' : '+ Sestavit ➔'}
          </ThemedText>
        </Pressable>

        {/* Kontakty na pořadatele */}
        {(concert.organizers && concert.organizers.length > 0) || concert.contacts ? (
          <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.15)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText type="smallBold" themeColor="textSecondary">Kontakty na pořadatele:</ThemedText>
              {activeRoleView !== 'fan' && (
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(33, 150, 243, 0.15)' }}
                  onPress={() => setSelectedConcertForStageplan(concert)}
                >
                  <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={13} tintColor="#2196f3" />
                  <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 11 }}>Odeslat Stageplan</ThemedText>
                </Pressable>
              )}
            </View>
            {concert.organizers && concert.organizers.length > 0 ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                {concert.organizers.map(org => (
                  <View key={org.id} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <View style={[styles.orgBadgeSmall, { backgroundColor: org.role === 'Zvukař' ? 'rgba(255,152,0,0.2)' : (org.role === 'Pořadatel' ? 'rgba(76,175,80,0.2)' : 'rgba(33,150,243,0.2)') }]}>
                      <ThemedText type="smallBold" style={{ color: org.role === 'Zvukař' ? '#ff9800' : (org.role === 'Pořadatel' ? '#4caf50' : '#2196f3'), fontSize: 10 }}>
                        {org.role || 'Kontakt'}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ fontSize: 12 }}>{org.name}</ThemedText>
                    {org.phone ? (
                      <Pressable onPress={() => Linking.openURL(`tel:${org.phone}`)}>
                        <ThemedText type="small" style={{ color: '#2196f3', fontSize: 12 }}>📞 {org.phone}</ThemedText>
                      </Pressable>
                    ) : null}
                    {org.email ? (
                      <Pressable onPress={() => Linking.openURL(`mailto:${org.email}`)}>
                        <ThemedText type="small" style={{ color: '#2196f3', fontSize: 12 }}>✉️ {org.email}</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText type="small" style={{ marginTop: 2 }}>{concert.contacts}</ThemedText>
            )}
          </View>
        ) : null}

        {/* Rozpis docházky na kartě koncertu */}
        {renderAttendanceBreakdown(concert.id, concert.attendees, 'concert')}

        {activeRoleView === 'admin' && (
          <View style={styles.cardFooter}>
            <Pressable onPress={() => openEditConcert(concert)} style={styles.actionBtnInline}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#2196f3" />
              <ThemedText type="small" style={{ color: '#2196f3' }}>Upravit</ThemedText>
            </Pressable>
            <Pressable onPress={() => handleDeleteConcert(concert)} style={styles.actionBtnInline}>
              <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
              <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat</ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>
    );
  };

  // Renderování karty zkoušky
  const renderRehearsalCard = (rehearsal: Rehearsal) => {
    const status = getEventStatus(rehearsal.date, rehearsal.time);

    return (
      <ThemedView
        key={`rehearsal_${rehearsal.id}`}
        type="backgroundElement"
        style={[
          styles.card,
          rehearsal.isCancelled
            ? styles.cancelledCard
            : (status === 'ongoing' ? styles.ongoingCard : (status === 'past' ? styles.pastCard : styles.futureCard))
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                Zkouška {rehearsal.location ? `- ${rehearsal.location}` : ''}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: '#4caf50' }]}>
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>Zkouška</ThemedText>
              </View>
            </View>

            <ThemedText type="default" style={{ fontWeight: 'bold', marginTop: 2 }}>
              📅 {formatDateDisplay(rehearsal.date)} {rehearsal.time ? `v ${rehearsal.time}` : ''}
            </ThemedText>
            {rehearsal.whatToPrepare ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                📝 {rehearsal.whatToPrepare}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.badgeColumn}>
            {rehearsal.isCancelled && (
              <View style={[styles.statusBadge, { backgroundColor: '#e91e63' }]}>
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>Zrušeno</ThemedText>
              </View>
            )}
          </View>
        </View>

        {/* Rozpis docházky na kartě zkoušky */}
        {renderAttendanceBreakdown(rehearsal.id, rehearsal.attendees, 'rehearsal')}

        {activeRoleView === 'admin' && (
          <View style={styles.cardFooter}>
            <Pressable onPress={() => handleToggleCancelRehearsal(rehearsal)} style={styles.actionBtnInline}>
              <SymbolView
                name={{ ios: 'xmark.circle', android: 'cancel', web: 'cancel' }}
                size={16}
                tintColor={rehearsal.isCancelled ? '#4caf50' : '#e91e63'}
              />
              <ThemedText type="small" style={{ color: rehearsal.isCancelled ? '#4caf50' : '#e91e63' }}>
                {rehearsal.isCancelled ? 'Obnovit' : 'Zrušit'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => openEditRehearsal(rehearsal)} style={styles.actionBtnInline}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#2196f3" />
              <ThemedText type="small" style={{ color: '#2196f3' }}>Upravit</ThemedText>
            </Pressable>
            <Pressable onPress={() => handleDeleteRehearsal(rehearsal)} style={styles.actionBtnInline}>
              <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
              <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat</ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>
    );
  };

  // Kombinovaný chronologický seznam všech akcí (koncerty + zkoušky)
  const combinedEvents = [
    ...concerts.map(c => ({
      id: `c_${c.id}`,
      type: 'concert' as const,
      sortKey: `${getSortableDateKey(c.date)}T${c.startTime || '00:00'}`,
      concert: c,
    })),
    ...rehearsals.map(r => ({
      id: `r_${r.id}`,
      type: 'rehearsal' as const,
      sortKey: `${getSortableDateKey(r.date)}T${r.time || '00:00'}`,
      rehearsal: r,
    })),
  ];

  combinedEvents.sort((a, b) => {
    const statusA = a.type === 'concert' ? getEventStatus(a.concert!.date, a.concert!.startTime, a.concert!.endTime) : getEventStatus(a.rehearsal!.date, a.rehearsal!.time);
    const statusB = b.type === 'concert' ? getEventStatus(b.concert!.date, b.concert!.startTime, b.concert!.endTime) : getEventStatus(b.rehearsal!.date, b.rehearsal!.time);

    const isPastA = statusA === 'past' || (a.type === 'concert' ? a.concert!.isCancelled : a.rehearsal!.isCancelled);
    const isPastB = statusB === 'past' || (b.type === 'concert' ? b.concert!.isCancelled : b.rehearsal!.isCancelled);

    if (!isPastA && isPastB) return -1;
    if (isPastA && !isPastB) return 1;

    if (!isPastA && !isPastB) {
      // Nadcházející a dnešní akce: nejbližší nahoře
      return a.sortKey.localeCompare(b.sortKey);
    } else {
      // Proběhlé a zrušené akce: nejnovější minulost nahoře
      return b.sortKey.localeCompare(a.sortKey);
    }
  });

  return (
    <ThemedView style={styles.container}>
      {/* 2-sekundová oznamovací hláška po uložení */}
      {toastMessage && (
        <View style={styles.toastBanner}>
          <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={20} tintColor="#fff" />
          <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 14 }}>
            {toastMessage}
          </ThemedText>
        </View>
      )}

      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <PageHeader title={titleMap[eventsTab] || 'Akce'} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* SEKCE AKCE (SLOUČENÉ KONCERTY A ZKOUŠKY) */}
          {isAkceTab && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8 }} numberOfLines={1}>
                  Přehled akcí a zkoušek
                </ThemedText>

                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Pressable
                    style={[styles.addBtn, { backgroundColor: '#e91e63', paddingHorizontal: 10, paddingVertical: 6 }]}
                    onPress={openAddConcert}
                  >
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>+ K</ThemedText>
                  </Pressable>

                  <Pressable
                    style={[styles.addBtn, { backgroundColor: '#4caf50', paddingHorizontal: 10, paddingVertical: 6 }]}
                    onPress={openAddRehearsal}
                  >
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>+ Z</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* PŘEPÍNAČ: Koncerty a Zkoušky přímo pod Přehledem */}
              <View style={styles.actionToggleRow}>
                {[
                  { key: 'all', label: `Vše (${concerts.length + rehearsals.length})`, color: '#2196f3' },
                  { key: 'koncerty', label: `Koncerty (${concerts.length})`, color: '#e91e63' },
                  { key: 'zkousky', label: `Zkoušky (${rehearsals.length})`, color: '#4caf50' },
                ].map(item => {
                  const isSelected = actionFilterMode === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.actionToggleChip,
                        {
                          backgroundColor: isSelected ? item.color : 'rgba(200,200,200,0.18)',
                          borderColor: isSelected ? item.color : 'rgba(200,200,200,0.3)',
                        }
                      ]}
                      onPress={() => setActionFilterMode(item.key as any)}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: isSelected ? '#fff' : theme.text, fontSize: 12 }}
                      >
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Tlačítka pro přepínání Kalendáře akcí a Volných termínů */}
              <View style={styles.filterRow}>
                <Pressable
                  style={[styles.filterChip, showCalendar ? { backgroundColor: '#4caf50', borderColor: '#388e3c' } : { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.4)' }]}
                  onPress={() => {
                    setShowCalendar(!showCalendar);
                    setShowFreeTerms(false);
                  }}
                >
                  <ThemedText type="smallBold" style={{ color: showCalendar ? '#fff' : theme.text, fontSize: 13, textAlign: 'center' }}>Kalendář akcí</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.filterChip, showFreeTerms ? { backgroundColor: '#2196f3', borderColor: '#1976d2' } : { backgroundColor: 'rgba(200,200,200,0.18)', borderColor: 'rgba(200,200,200,0.4)' }]}
                  onPress={() => {
                    setShowFreeTerms(!showFreeTerms);
                    setShowCalendar(false);
                  }}
                >
                  <ThemedText type="smallBold" style={{ color: showFreeTerms ? '#fff' : theme.text, fontSize: 13, textAlign: 'center' }}>Volné termíny</ThemedText>
                </Pressable>
              </View>

              {/* Zobrazení Kalendáře akcí */}
              {showCalendar && (
                <View style={{ marginBottom: Spacing.four }}>
                   <EventsCalendar
                      concerts={concerts}
                      rehearsals={rehearsals}
                      rawAbsences={absences}
                   />
                </View>
              )}

              {/* Zobrazení Volných termínů */}
              {showFreeTerms && (
                <View style={{ marginBottom: Spacing.four }}>
                  {renderFreeTerms()}
                </View>
              )}

              {/* SEZNAM AKCÍ PODLE VYBRANÉHO PŘEPÍNAČE */}
              <View style={styles.list}>
                {actionFilterMode === 'koncerty' ? (
                  concerts.map(c => renderConcertCard(c))
                ) : actionFilterMode === 'zkousky' ? (
                  rehearsals.map(r => renderRehearsalCard(r))
                ) : (
                  combinedEvents.map(item =>
                    item.type === 'concert' ? renderConcertCard(item.concert!) : renderRehearsalCard(item.rehearsal!)
                  )
                )}

                {((actionFilterMode === 'koncerty' && concerts.length === 0) ||
                  (actionFilterMode === 'zkousky' && rehearsals.length === 0) ||
                  (actionFilterMode === 'all' && combinedEvents.length === 0)) && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                    Zatím nejsou evidovány žádné akce.
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* SEKCE POPTÁVKY */}
          {eventsTab === 'poptavky' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={{ fontSize: 18 }}>Poptávky hraní</ThemedText>
              </View>

              <View style={styles.list}>
                {inquiries.map(inquiry => (
                  <ThemedView key={inquiry.id} type="backgroundElement" style={styles.card}>
                    <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold' }}>
                      👤 {inquiry.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                      📅 {inquiry.date} • 📍 {inquiry.location}
                    </ThemedText>
                    {inquiry.notes ? (
                      <ThemedText type="small" style={{ marginTop: 4 }}>
                        💬 {inquiry.notes}
                      </ThemedText>
                    ) : null}

                    {/* Rozpis docházky na kartě poptávky */}
                    {renderAttendanceBreakdown(inquiry.id, inquiry.attendees, 'inquiry')}

                    {activeRoleView === 'admin' && (
                      <View style={styles.cardFooter}>
                        {inquiry.status === 'pending' && (
                          <>
                            <Pressable
                              style={[styles.actionBtnInline, { backgroundColor: '#4caf50' }]}
                              onPress={() => handleInquiryStatusChange(inquiry, 'accepted')}
                            >
                              <ThemedText type="smallBold" style={{ color: '#fff' }}>Potvrdit</ThemedText>
                            </Pressable>
                            <Pressable
                              style={[styles.actionBtnInline, { backgroundColor: '#f44336' }]}
                              onPress={() => handleInquiryStatusChange(inquiry, 'declined')}
                            >
                              <ThemedText type="smallBold" style={{ color: '#fff' }}>Odmítnout</ThemedText>
                            </Pressable>
                          </>
                        )}
                        <Pressable onPress={() => handleDeleteInquiry(inquiry)} style={styles.actionBtnInline}>
                          <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
                          <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat</ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </ThemedView>
                ))}

                {inquiries.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                    Zatím nemáte žádné poptávky hraní.
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* SEKCE ABSENCE */}
          {eventsTab === 'absence' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={{ fontSize: 18 }}>Absence členů kapely</ThemedText>
                <Pressable
                  style={[styles.addBtn, { backgroundColor: '#2196f3' }]}
                  onPress={() => setShowAddAbsenceModal(true)}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', marginLeft: 4 }}>+ Nahlásit absenci</ThemedText>
                </Pressable>
              </View>

              <View style={styles.list}>
                {absences.map(absence => (
                  <ThemedView key={absence.id} type="backgroundElement" style={[styles.card, { borderLeftColor: '#ffc107', borderLeftWidth: 4 }]}>
                    <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold' }}>
                      👤 {absence.memberName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                      📅 Od: {absence.dateFrom} • Do: {absence.dateTo}
                    </ThemedText>
                    {absence.reason ? (
                      <ThemedText type="small" style={{ marginTop: 4 }}>
                        📝 Důvod: {absence.reason}
                      </ThemedText>
                    ) : null}

                    {activeRoleView === 'admin' && (
                      <View style={styles.cardFooter}>
                        <Pressable onPress={() => handleDeleteAbsence(absence)} style={styles.actionBtnInline}>
                          <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor="#e91e63" />
                          <ThemedText type="small" style={{ color: '#e91e63' }}>Smazat absenci</ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </ThemedView>
                ))}

                {absences.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                    Žádný člen kapely nemá nahlášenou absenci.
                  </ThemedText>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* MODAL PRO PŘIDÁNÍ/ÚPRAVU KONCERTU */}
      <Modal visible={showAddConcertModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={{ flex: 1 }}>
          <AddConcertForm
            initialConcert={editingConcert || undefined}
            onSave={handleSaveConcert}
            onCancel={() => {
              setShowAddConcertModal(false);
              setEditingConcert(null);
            }}
          />
        </ThemedView>
      </Modal>

      {/* MODAL PRO PŘIDÁNÍ/ÚPRAVU ZKOUŠKY */}
      <Modal visible={showAddRehearsalModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={{ flex: 1 }}>
          <AddRehearsalForm
            initialRehearsal={editingRehearsal || undefined}
            onSave={handleSaveRehearsal}
            onCancel={() => {
              setShowAddRehearsalModal(false);
              setEditingRehearsal(null);
            }}
          />
        </ThemedView>
      </Modal>

      {/* MODAL PRO NAHLÁŠENÍ ABSENCE */}
      <Modal visible={showAddAbsenceModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={{ flex: 1 }}>
          <AddAbsenceForm
            members={bandMembers}
            onSave={handleSaveAbsence}
            onCancel={() => setShowAddAbsenceModal(false)}
          />
        </ThemedView>
      </Modal>

      {/* MODAL PRO ZOBRAZENÍ / ÚPRAVU SETLISTU KARTA AKCE */}
      {selectedConcertForSetlist && (
        <SetlistEditorModal
          visible={!!selectedConcertForSetlist}
          onClose={() => setSelectedConcertForSetlist(null)}
          concert={selectedConcertForSetlist}
          initialSetlist={selectedConcertForSetlist.setlist}
          onSaveSetlist={handleSaveSetlistFromCard}
        />
      )}

      {/* Modal pro zobrazení a odeslání Stageplanu z karty koncertu */}
      {selectedConcertForStageplan && activeBand && (
        <StageplanModal
          visible={!!selectedConcertForStageplan}
          onClose={() => setSelectedConcertForStageplan(null)}
          band={activeBand}
          members={bandMembers}
          concert={selectedConcertForStageplan}
          onSave={async (updatedStageplan) => {
            const updated = await updateBand(activeBand.id, { stageplan: updatedStageplan });
            setActiveBand(updated);
          }}
        />
      )}

      {/* Modal pro úpravu docházky člena */}
      <Modal visible={!!editAttendanceState} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditAttendanceState(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: theme.backgroundElement }]} onPress={e => e.stopPropagation()}>
            <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
              Docházka: {editAttendanceState?.member.nickname || editAttendanceState?.member.firstName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 12 }}>
              Vyberte stav a případně zadejte poznámku:
            </ThemedText>

            {/* Přepínače stavu */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Pressable
                style={[
                  styles.statusChoiceBtn,
                  editAttendanceState?.status === 'yes' ? { backgroundColor: '#4caf50', borderColor: '#4caf50' } : styles.statusChoiceBtnInactive
                ]}
                onPress={() => setEditAttendanceState(prev => prev ? { ...prev, status: 'yes' } : null)}
              >
                <ThemedText type="smallBold" style={{ color: editAttendanceState?.status === 'yes' ? '#fff' : theme.text }}>
                  ✓ Můžu
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.statusChoiceBtn,
                  editAttendanceState?.status === 'no' ? { backgroundColor: '#e91e63', borderColor: '#e91e63' } : styles.statusChoiceBtnInactive
                ]}
                onPress={() => setEditAttendanceState(prev => prev ? { ...prev, status: 'no' } : null)}
              >
                <ThemedText type="smallBold" style={{ color: editAttendanceState?.status === 'no' ? '#fff' : theme.text }}>
                  ✕ Nemůžu
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.statusChoiceBtn,
                  editAttendanceState?.status === 'pending' ? { backgroundColor: '#757575', borderColor: '#757575' } : styles.statusChoiceBtnInactive
                ]}
                onPress={() => setEditAttendanceState(prev => prev ? { ...prev, status: 'pending' } : null)}
              >
                <ThemedText type="smallBold" style={{ color: editAttendanceState?.status === 'pending' ? '#fff' : theme.text }}>
                  ⚪ Čeká
                </ThemedText>
              </Pressable>
            </View>

            {/* Input pro poznámku */}
            <TextInput
              style={[styles.noteInput, { color: theme.text, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.1)' }]}
              placeholder="Poznámka (volitelná - např. zpoždění)..."
              placeholderTextColor={theme.textSecondary}
              value={editAttendanceState?.note || ''}
              onChangeText={text => setEditAttendanceState(prev => prev ? { ...prev, note: text } : null)}
            />

            {/* Tlačítka Uložit / Zrušit */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setEditAttendanceState(null)} style={styles.modalCancelBtn}>
                <ThemedText type="smallBold" themeColor="textSecondary">Zrušit</ThemedText>
              </Pressable>
              <Pressable onPress={saveMemberAttendance} style={styles.modalSaveBtn}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Uložit</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toastBanner: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 9999,
  },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 2, paddingBottom: Spacing.six },
  sectionContainer: { marginTop: Spacing.two },
  orgBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  actionToggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
  },
  actionToggleChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  circleAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three },
  cancelledCard: { borderLeftWidth: 4, borderLeftColor: '#f44336', opacity: 0.6 },
  ongoingCard: { borderLeftWidth: 4, borderLeftColor: '#ffeb3b' },
  pastCard: { opacity: 0.8 },
  futureCard: { borderLeftWidth: 4, borderLeftColor: '#4caf50' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badgeColumn: { gap: 4, alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  detailRow: { flexDirection: 'row', marginTop: 4 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  actionBtnInline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 6 },
  freeTermsContainer: { gap: Spacing.two },
  freeTermsMonthCard: { padding: Spacing.three, borderRadius: Spacing.two },
  freeTermsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  freeTermBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
  },
  memberAttendanceBadgeYes: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  memberAttendanceBadgeNo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.4)',
  },
  memberAttendanceBadgePending: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 18,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statusChoiceBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusChoiceBtnInactive: {
    backgroundColor: 'rgba(150,150,150,0.15)',
    borderColor: 'transparent',
  },
  noteInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2196f3',
  },
});
