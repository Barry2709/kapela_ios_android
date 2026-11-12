import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Modal, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { BandMember, Band, Rehearsal, Concert, UserProfile } from '@/types';
import { getBands, getBandMembers, addBandMember, updateBand, updateBandMember, subscribeToBand, getRehearsals, getConcerts, subscribeToRehearsals, subscribeToConcerts, updateRehearsal, updateConcert, saveFanToFirebase, addFanToBand, notifyAdminsAboutAttendance } from '@/services/firebaseService';
import { BandHeader } from '@/components/band-header';
import { AddMemberForm } from '@/components/add-member-form';
import { AddInquiryForm } from '@/components/add-inquiry-form';
import { addInquiry } from '@/services/firebaseService';
import { EditBandForm } from '@/components/edit-band-form';
import { StageplanModal, shareConcertStageplan } from '@/components/stageplan-modal';
import { TunerModal } from '@/components/tuner-modal';
import { useTranslation } from '@/utils/i18n';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activeBand, currentUser, setCurrentUser, setActiveBand, activeRoleView, setActiveRoleView } = useAppStore();
  const { t } = useTranslation();

  const formatDateDisplay = (dateStr?: string): string => {
    if (!dateStr) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[2]}`;
      }
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
      }
    }
    return dateStr;
  };

  const [members, setMembers] = useState<BandMember[]>([]);
  const [upcomingRehearsal, setUpcomingRehearsal] = useState<Rehearsal | null>(null);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [expandedConcerts, setExpandedConcerts] = useState<Record<string, boolean>>({});
  const [expandedAttendance, setExpandedAttendance] = useState<Record<string, boolean>>({});
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showSwitchBandModal, setShowSwitchBandModal] = useState(false);
  const [savedSessions, setSavedSessions] = useState<{user: UserProfile, band: Band}[]>([]);
  const [allBands, setAllBands] = useState<Band[]>([]);
  const [fanFeedRefreshKey, setFanFeedRefreshKey] = useState(0);
  const [showFanInquiryModal, setShowFanInquiryModal] = useState(false);
  const [showEditBandModal, setShowEditBandModal] = useState(false);
  const [editingMember, setEditingMember] = useState<BandMember | null>(null);
  const [selectedConcertForStageplan, setSelectedConcertForStageplan] = useState<Concert | null>(null);
  const [showTunerModal, setShowTunerModal] = useState(false);
  interface AttendanceEditState {
    member: BandMember;
    eventId: string;
    eventType: 'rehearsal' | 'concert';
    status: 'yes' | 'no' | 'pending';
    note: string;
  }

  const [editAttendanceState, setEditAttendanceState] = useState<AttendanceEditState | null>(null);

  const toggleAttendanceExpand = (eventId: string) => {
    setExpandedAttendance(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const getMyMemberId = (): string | null => {
    if (!currentUser) return null;
    const matched = members.find(m =>
      m.id === currentUser.uid ||
      (currentUser.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.displayName && m.nickname && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase()) ||
      (currentUser.displayName && m.nickname && m.nickname.toLowerCase() === currentUser.displayName.toLowerCase()) ||
      (currentUser.displayName && m.firstName && m.firstName.toLowerCase() === currentUser.displayName.toLowerCase())
    );
    return matched ? matched.id : currentUser.uid;
  };

  const getUserStatus = (attendeesRecord?: Record<string, any>) => {
    if (!attendeesRecord) return null;
    const myId = getMyMemberId();
    const resp = (myId && attendeesRecord[myId]) || (currentUser?.uid && attendeesRecord[currentUser.uid]);
    if (!resp) return null;
    return typeof resp === 'string' ? resp : resp.status;
  };

  const handleAnswerAttendance = async (eventId: string, eventType: 'rehearsal' | 'concert', status: 'yes' | 'no') => {
    if (!activeBand?.id) return;
    const targetId = getMyMemberId() || currentUser?.uid;
    if (!targetId) return;

    try {
      let eventTitle = eventType === 'rehearsal' ? t('events.list.rehearsal') : t('events.list.concert');
      if (eventType === 'rehearsal') {
        const rehearsal = upcomingRehearsal;
        if (!rehearsal) return;
        eventTitle = `${t('events.list.rehearsal')} (${rehearsal.date})`;
        const currentAtt = rehearsal.attendees || {};
        const updatedAtt = {
          ...currentAtt,
          [targetId]: {
            ...(typeof currentAtt[targetId] === 'object' ? currentAtt[targetId] : {}),
            status,
            updatedAt: Date.now(),
          }
        };
        await updateRehearsal(activeBand.id, eventId, { attendees: updatedAtt });
        setUpcomingRehearsal({ ...rehearsal, attendees: updatedAtt });
      } else {
        const concert = concerts.find(c => c.id === eventId);
        if (!concert) return;
        eventTitle = concert.title;
        const currentAtt = concert.attendees || {};
        const updatedAtt = {
          ...currentAtt,
          [targetId]: {
            ...(typeof currentAtt[targetId] === 'object' ? currentAtt[targetId] : {}),
            status,
            updatedAt: Date.now(),
          }
        };
        await updateConcert(activeBand.id, eventId, { attendees: updatedAtt });
        setConcerts(prev => prev.map(c => c.id === eventId ? { ...c, attendees: updatedAtt } : c));
      }

      const memberName = members.find(m => m.id === targetId)?.nickname || currentUser?.displayName || t('band.edit.member');
      notifyAdminsAboutAttendance(activeBand.id, memberName, eventTitle, status, eventType);
    } catch (e) {
      console.error("Chyba při ukládání docházky:", e);
      Alert.alert(t('home.attendance.errorTitle'), t('home.attendance.errorMsg'));
    }
  };

  const handleMemberClick = (
    member: BandMember,
    eventId: string,
    eventType: 'rehearsal' | 'concert',
    attendeesRecord?: Record<string, any>
  ) => {
    const isAdmin = activeRoleView === 'admin' || currentUser?.role === 'admin';
    const myId = getMyMemberId();
    const isSelf = member.id === currentUser?.uid || member.id === myId;

    if (!isAdmin && !isSelf) {
      Alert.alert(t('home.attendance'), t('home.attendance.onlyAdmin'));
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
      if (eventType === 'rehearsal') {
        const rehearsal = upcomingRehearsal;
        if (!rehearsal) return;
        const currentAtt = { ...(rehearsal.attendees || {}) };

        if (status === 'pending') {
          delete currentAtt[member.id];
        } else {
          currentAtt[member.id] = {
            status,
            note: note.trim() || undefined,
            updatedAt: Date.now(),
          };
        }

        await updateRehearsal(activeBand.id, eventId, { attendees: currentAtt });
        setUpcomingRehearsal({ ...rehearsal, attendees: currentAtt });
      } else {
        const concert = concerts.find(c => c.id === eventId);
        if (!concert) return;
        const currentAtt = { ...(concert.attendees || {}) };

        if (status === 'pending') {
          delete currentAtt[member.id];
        } else {
          currentAtt[member.id] = {
            status,
            note: note.trim() || undefined,
            updatedAt: Date.now(),
          };
        }

        await updateConcert(activeBand.id, eventId, { attendees: currentAtt });
        setConcerts(prev => prev.map(c => c.id === eventId ? { ...c, attendees: currentAtt } : c));
      }

      setEditAttendanceState(null);
    } catch (e) {
      console.error("Chyba při ukládání docházky člena:", e);
      Alert.alert(t('home.attendance.errorTitle'), t('home.attendance.errorMsg'));
    }
  };

  const renderAttendanceSection = (eventId: string, eventType: 'rehearsal' | 'concert', attendeesRecord?: Record<string, any>) => {
    if (activeRoleView === 'fan') return null;

    const activeNonGuests = members.filter(m => !m.isGuest && m.isActive !== false);
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

    const userStatus = getUserStatus(attendeesRecord);
    const isExpanded = expandedAttendance[eventId] === true;

    const summaryParts = [];
    if (goingMembers.length > 0) summaryParts.push(`${goingMembers.length} ${t('home.attendance.can')}`);
    if (notGoingMembers.length > 0) summaryParts.push(`${notGoingMembers.length} ${t('home.attendance.cannot')}`);
    if (pendingMembers.length > 0) summaryParts.push(`${pendingMembers.length} ${t('home.attendance.waiting')}`);

    // Pokud uživatel JEŠTĚ NEPOTVRDIL (nemá 'yes' ani 'no'), zobrazit rychlé hlasování.
    // Pokud JIŽ POTVRDIL, rychlé hlasování se schová.
    const showQuickVote = !userStatus || (userStatus !== 'yes' && userStatus !== 'no');

    return (
      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)' }}>
        {/* Rychlé hlasování – ZOBRAZIT POUZE POKUD JEŠTĚ NEPOTVRDIL */}
        {showQuickVote && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <ThemedText type="smallBold" themeColor="textSecondary">{t('home.attendance.myAttendance')}</ThemedText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={[styles.attBtn, styles.attBtnYesActive]}
                onPress={() => handleAnswerAttendance(eventId, eventType, 'yes')}
              >
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                  {t('home.attendance.canGo')}
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.attBtn, styles.attBtnNoActive]}
                onPress={() => handleAnswerAttendance(eventId, eventType, 'no')}
              >
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                  {t('home.attendance.cannotGo')}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Přehled docházky s možností rozbalení detailů */}
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
          onPress={() => toggleAttendanceExpand(eventId)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} size={15} tintColor={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ fontSize: 12 }}>
              {t('home.attendance.summary')}{summaryParts.join(' • ') || t('home.attendance.noAnswers')}
            </ThemedText>
          </View>
          <SymbolView
            name={{ ios: isExpanded ? 'chevron.up' : 'chevron.down', android: isExpanded ? 'expand_less' : 'expand_more', web: isExpanded ? 'expand_less' : 'expand_more' }}
            size={14}
            tintColor={theme.textSecondary}
          />
        </Pressable>

        {/* Rozbalený seznam členů - kliknutím na člena lze upravit docházku */}
        {isExpanded && (
          <View style={{ marginTop: 8, gap: 8 }}>
            {goingMembers.length > 0 && (
              <View>
                <ThemedText type="smallBold" style={{ color: '#4caf50', marginBottom: 4 }}>
                  {t('home.attendance.canGoPlural')} ({goingMembers.length}):
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {goingMembers.map(m => {
                    const isSelf = m.id === currentUser?.uid || m.id === getMyMemberId();
                    return (
                      <Pressable
                        key={m.id}
                        style={styles.memberAttendanceBadgeYes}
                        onPress={() => handleMemberClick(m, eventId, eventType, attendeesRecord)}
                      >
                        <ThemedText type="small" style={{ color: '#4caf50', fontSize: 11, fontWeight: 'bold' }}>
                          {m.nickname || m.firstName}{isSelf ? t('home.attendance.you') : ''}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {notGoingMembers.length > 0 && (
              <View style={{ marginTop: 2 }}>
                <ThemedText type="smallBold" style={{ color: '#e91e63', marginBottom: 4 }}>
                  {t('home.attendance.cannotGoPlural')} ({notGoingMembers.length}):
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {notGoingMembers.map(({ member: m, note }) => {
                    const isSelf = m.id === currentUser?.uid || m.id === getMyMemberId();
                    return (
                      <Pressable
                        key={m.id}
                        style={styles.memberAttendanceBadgeNo}
                        onPress={() => handleMemberClick(m, eventId, eventType, attendeesRecord)}
                      >
                        <ThemedText type="small" style={{ color: '#e91e63', fontSize: 11, fontWeight: 'bold' }}>
                          {m.nickname || m.firstName}{note ? ` (${note})` : ''}{isSelf ? t('home.attendance.you') : ''}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {pendingMembers.length > 0 && (
              <View style={{ marginTop: 2 }}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                  {t('home.attendance.waitingForAnswer')} ({pendingMembers.length}):
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {pendingMembers.map(m => {
                    const isSelf = m.id === currentUser?.uid || m.id === getMyMemberId();
                    return (
                      <Pressable
                        key={m.id}
                        style={styles.memberAttendanceBadgePending}
                        onPress={() => handleMemberClick(m, eventId, eventType, attendeesRecord)}
                      >
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                          {m.nickname || m.firstName}{isSelf ? t('home.attendance.you') : ''}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const toIsoDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const getEventStatus = (dateStr: string, startTimeStr?: string, endTimeStr?: string) => {
    if (!dateStr) return 'future';

    try {
      const isoDate = toIsoDate(dateStr);
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (isoDate < todayStr) return 'past';
      if (isoDate > todayStr) return 'future';

      // isoDate === todayStr
      if (!startTimeStr) return 'ongoing';

      const [startH, startM] = startTimeStr.split(':').map(Number);
      const startTotalMin = (startH || 0) * 60 + (startM || 0);

      let endTotalMin: number;
      if (endTimeStr && endTimeStr.includes(':')) {
        const [endH, endM] = endTimeStr.split(':').map(Number);
        endTotalMin = (endH || 0) * 60 + (endM || 0);
      } else {
        endTotalMin = startTotalMin + 180; // výchozí délka 3 hodiny pro dnešní akci
      }

      const nowTotalMin = now.getHours() * 60 + now.getMinutes();

      if (nowTotalMin < startTotalMin) return 'future';
      if (nowTotalMin >= startTotalMin && nowTotalMin <= endTotalMin) return 'ongoing';
      return 'past';
    } catch (e) {
      return 'future';
    }
  };

  const processRehearsals = (data: Rehearsal[]) => {
    const future = data.filter(r => !r.isCancelled && getEventStatus(r.date, r.time) !== 'past');
    future.sort((a, b) => {
      const keyA = `${toIsoDate(a.date)}T${a.time || '00:00'}`;
      const keyB = `${toIsoDate(b.date)}T${b.time || '00:00'}`;
      return keyA.localeCompare(keyB);
    });
    if (future.length > 0) {
      setUpcomingRehearsal(future[0]);
    } else {
      setUpcomingRehearsal(null);
    }
  };

  const processConcerts = (data: Concert[]) => {
    let list = data;
    if (activeRoleView === 'fan') {
      list = data.filter(c => !c.isPrivate);
    }

    const futureConcerts = list.filter(c => !c.isCancelled && getEventStatus(c.date, c.startTime, c.endTime) !== 'past');
    const pastConcerts = list.filter(c => c.isCancelled || getEventStatus(c.date, c.startTime, c.endTime) === 'past');

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
  };

  // Načíst čerstvá data při každém příchodu na domovskou obrazovku (pro členy kapely)
  useFocusEffect(
    React.useCallback(() => {
      if (activeBand?.id && activeRoleView !== 'fan') {
        loadConcerts();
        loadUpcomingRehearsal();
      }
    }, [activeBand?.id, activeRoleView])
  );

  // Načíst členy kapely, příští zkoušku, koncerty a aktualizovat čerstvá data kapely z Firebase
  useEffect(() => {
    if (!activeBand?.id) return;

    loadMembers();
    loadUpcomingRehearsal();

    const unsubs: Array<() => void> = [];

    // Pokud je přihlášen FANOUŠEK, načíst a poslouchat akce ze VŠECH uložených kapel (Agregovaný Feed)
    if (activeRoleView === 'fan') {
      Promise.all([AsyncStorage.getItem('savedSessions'), getBands()]).then(([str, allBands]) => {
        let sessions: Array<{ user: any, band: Band }> = [];
        if (str) {
          try { sessions = JSON.parse(str); } catch (e) {}
        }

        const freshBandsMap = new Map<string, Band>();
        allBands.forEach((b: Band) => freshBandsMap.set(b.id, b));

        // Získat unikátní seznam kapel (buď ze savedSessions nebo aktuální activeBand)
        const fanBandsMap = new Map<string, Band>();
        fanBandsMap.set(activeBand.id, freshBandsMap.get(activeBand.id) || activeBand);
        sessions.forEach(s => {
          if (s.band && s.band.id) {
            const fresh = freshBandsMap.get(s.band.id) || s.band;
            fanBandsMap.set(s.band.id, fresh);
          }
        });

        const allConcertsByBand = new Map<string, Concert[]>();

        fanBandsMap.forEach((bandObj, bId) => {
          if (currentUser?.email) {
            saveFanToFirebase(bId, currentUser);
          }

          const unsub = subscribeToConcerts(bId, (freshConcerts) => {
            // Označit koncerty čerstvým jménem a logem kapely a filtrovat soukromé
            const publicConcerts = freshConcerts
              .filter(c => !c.isPrivate)
              .map(c => ({
                ...c,
                _bandName: bandObj.name,
                _bandLogoUri: bandObj.logoUri || null,
                _bandWeb: bandObj.web || null,
                _bandGenre: bandObj.genre || null,
                _bandCountry: bandObj.country || null,
              }));

            allConcertsByBand.set(bId, publicConcerts);

            // Sloučit koncerty ze všech sledovaných kapel
            const mergedConcerts: Concert[] = [];
            allConcertsByBand.forEach(cList => mergedConcerts.push(...cList));
            processConcerts(mergedConcerts);
          });
          unsubs.push(unsub);
        });
      }).catch(console.error);
    } else {
      // PRO ČLENY: Načíst koncerty pouze pro aktivní kapelu
      loadConcerts();
      const unsubConcerts = subscribeToConcerts(activeBand.id, (freshConcerts) => {
        processConcerts(freshConcerts);
      });
      unsubs.push(unsubConcerts);
    }

    const unsubscribeRehearsals = subscribeToRehearsals(activeBand.id, (freshRehearsals) => {
      processRehearsals(freshRehearsals);
    });
    unsubs.push(unsubscribeRehearsals);

    const unsubscribeBand = subscribeToBand(activeBand.id, (freshBand) => {
      if (freshBand) {
        setActiveBand(freshBand);
        AsyncStorage.setItem('savedBand', JSON.stringify(freshBand));
      }
    });
    unsubs.push(unsubscribeBand);

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, [activeBand?.id, activeRoleView, currentUser?.email, fanFeedRefreshKey]);

  const loadMembers = async () => {
    if (!activeBand) return;
    try {
      const data = await getBandMembers(activeBand.id);
      setMembers(data);
    } catch (e) {
      console.error("Nepodařilo se načíst členy", e);
    }
  };

  const loadUpcomingRehearsal = async () => {
    if (!activeBand) return;
    try {
      const rehearsals = await getRehearsals(activeBand.id);
      processRehearsals(rehearsals);
    } catch (e) {
      console.error("Nepodařilo se načíst příští zkoušku:", e);
    }
  };

  const loadConcerts = async () => {
    if (!activeBand) return;
    try {
      const data = await getConcerts(activeBand.id);
      processConcerts(data);
    } catch (e) {
      console.error("Nepodařilo se načíst koncerty na hlavní stránce:", e);
    }
  };

  const toggleExpandConcert = (id: string) => {
    setExpandedConcerts(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      t('home.misc.logoutTitle'),
      t('home.misc.logoutMsg'),
      [
        { text: t('home.misc.cancel'), style: 'cancel' },
        {
          text: t('home.misc.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              const existingStr = await AsyncStorage.getItem('savedSessions');
              let sessions = existingStr ? JSON.parse(existingStr) : [];
              sessions = sessions.filter((s: any) => !(s.band.id === activeBand?.id && s.user.uid === currentUser?.uid));

              if (sessions.length > 0) {
                await AsyncStorage.setItem('savedSessions', JSON.stringify(sessions));
                // Přepnout na další dostupnou kapelu
                const nextSession = sessions[0];
                await AsyncStorage.setItem('lastActiveBandId', nextSession.band.id);
                setCurrentUser(nextSession.user);
                setActiveRoleView(nextSession.user.role);
                setActiveBand(nextSession.band);
              } else {
                await AsyncStorage.removeItem('savedSessions');
                await AsyncStorage.removeItem('savedUser');
                await AsyncStorage.removeItem('savedBand');
                setCurrentUser(null);
                setActiveBand(null);
                router.replace('/(auth)/onboarding');
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  const handleOpenSwitchModal = async () => {
    try {
      const str = await AsyncStorage.getItem('savedSessions');
      if (str) {
        setSavedSessions(JSON.parse(str));
      }
      const bands = await getBands();
      setAllBands(bands);
      setShowSwitchBandModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFanBand = async (band: Band, isCurrentlyFollowed: boolean) => {
    try {
      const str = await AsyncStorage.getItem('savedSessions');
      let sessions: Array<{ user: UserProfile, band: Band }> = str ? JSON.parse(str) : [];

      if (isCurrentlyFollowed) {
        // Odebrat ze sledovaných
        const updated = sessions.filter(s => s.band.id !== band.id);
        await AsyncStorage.setItem('savedSessions', JSON.stringify(updated));
        setSavedSessions(updated);

        if (updated.length === 0) {
          setShowSwitchBandModal(false);
          await AsyncStorage.removeItem('savedSessions');
          await AsyncStorage.removeItem('savedUser');
          await AsyncStorage.removeItem('savedBand');
          setCurrentUser(null);
          setActiveBand(null);
          router.replace('/(auth)/onboarding');
        } else {
          setFanFeedRefreshKey(prev => prev + 1);
          if (band.id === activeBand?.id) {
            const nextSession = updated[0];
            await AsyncStorage.setItem('lastActiveBandId', nextSession.band.id);
            setCurrentUser(nextSession.user);
            setActiveRoleView(nextSession.user.role);
            setActiveBand(nextSession.band);
          }
        }
      } else {
        // Přidat do sledovaných
        const fanName = currentUser?.displayName || (await AsyncStorage.getItem('savedFanName')) || 'Fanoušek';
        const fanEmail = currentUser?.email || (await AsyncStorage.getItem('savedFanEmail')) || '';
        const fanPhone = (await AsyncStorage.getItem('savedFanPhone')) || undefined;

        const createdFan = await addFanToBand(band.id, {
          name: fanName,
          email: fanEmail,
          phone: fanPhone,
        });

        const newFanUser: UserProfile = {
          uid: createdFan.id,
          email: fanEmail,
          displayName: fanName,
          role: 'fan',
          bandId: band.id,
        };

        const updated = [...sessions.filter(s => s.band.id !== band.id), { user: newFanUser, band }];
        await AsyncStorage.setItem('savedSessions', JSON.stringify(updated));
        await AsyncStorage.setItem('lastActiveBandId', band.id);
        setSavedSessions(updated);
        setFanFeedRefreshKey(prev => prev + 1);

        setCurrentUser(newFanUser);
        setActiveRoleView('fan');
        setActiveBand(band);
      }
    } catch (e) {
      console.error("Chyba při změně sledovaných kapel fanouška:", e);
      Alert.alert(t('home.attendance.errorTitle'), "Nepodařilo se upravit sledování kapely.");
    }
  };

  const handleSwitchToSession = async (session: {user: UserProfile, band: Band}) => {
    await AsyncStorage.setItem('lastActiveBandId', session.band.id);
    setCurrentUser(session.user);
    setActiveRoleView(session.user.role);
    setActiveBand(session.band);
    setShowSwitchBandModal(false);
  };

  const handleAddNewBand = () => {
    setShowSwitchBandModal(false);
    setCurrentUser(null);
    setActiveBand(null);
    router.replace('/(auth)/onboarding');
  };

  const handleSaveMember = async (memberData: Omit<BandMember, 'id'>) => {
    if (!activeBand) return;
    try {
      if (editingMember) {
        await updateBandMember(activeBand.id, editingMember.id, memberData);
      } else {
        await addBandMember(activeBand.id, memberData);
      }
      setShowAddMemberModal(false);
      setEditingMember(null);
      loadMembers(); // Znovunačíst seznam
    } catch (e) {
      console.error("Nepodařilo se uložit člena", e);
    }
  };

  const openAddMember = () => {
    setEditingMember(null);
    setShowAddMemberModal(true);
  };

  const openEditMember = (member: BandMember) => {
    setEditingMember(member);
    setShowAddMemberModal(true);
  };

  const handleSaveBandUpdates = async (updates: Partial<Band>) => {
    if (!activeBand) return;
    try {
      const updatedBand = await updateBand(activeBand.id, updates);

      // Pokud se změnou názvu změnilo i ID kapely, musíme aktualizovat sezení uživatele
      if (updatedBand.id !== activeBand.id && currentUser) {
         const updatedUser = { ...currentUser, bandId: updatedBand.id };
         setCurrentUser(updatedUser);
         await AsyncStorage.setItem('savedUser', JSON.stringify(updatedUser));
      }

      setActiveBand(updatedBand);
      await AsyncStorage.setItem('savedBand', JSON.stringify(updatedBand));

      setShowEditBandModal(false);
    } catch (e: any) {
      Alert.alert(t('band.edit.errorTitle'), e.message || t('band.edit.errorMsg'));
      console.error("Nepodařilo se upravit profil kapely", e);
    }
  };

    // Vypočítat kapelu s nejbližším nadcházejícím koncertem pro hlavičku fanouška
  const upcomingConcert = concerts.find(c => !c.isCancelled && getEventStatus(c.date, c.startTime, c.endTime) !== 'past');
  const earliestBandForFan = (activeRoleView === 'fan' && upcomingConcert) ? {
    name: (upcomingConcert as any)._bandName || activeBand?.name,
    logoUri: (upcomingConcert as any)._bandLogoUri,
    web: (upcomingConcert as any)._bandWeb || activeBand?.web,
    genre: (upcomingConcert as any)._bandGenre || activeBand?.genre,
    country: (upcomingConcert as any)._bandCountry || activeBand?.country,
  } : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <BandHeader overrideBand={earliestBandForFan} />

          <View style={[styles.contentPadding, { marginTop: 3 }]}>
            {/* Rychlý řádek s informací o přihlášení a viditelné tlačítko odhlášení */}
            <View style={styles.loggedInRow}>
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, marginRight: 8 }} numberOfLines={1}>
                {t('home.misc.loggedInAs')} <ThemedText type="smallBold">{currentUser?.displayName}</ThemedText>
              </ThemedText>

              <Pressable onPress={handleOpenSwitchModal} style={[styles.logoutBtnInline, { marginRight: 8, backgroundColor: 'rgba(33, 150, 243, 0.1)', borderColor: 'rgba(33, 150, 243, 0.4)' }]}>
                <ThemedText type="smallBold" style={{ color: '#2196f3' }}>
                  {activeRoleView === 'fan' ? (t('home.misc.addBandFan') || 'Přidat / spravovat kapely') : (t('home.misc.switchBand') || 'Změnit kapelu')}
                </ThemedText>
              </Pressable>

              <Pressable onPress={handleLogout} style={styles.logoutBtnInline}>
                <ThemedText type="smallBold" style={{ color: theme.text }}>
                  {t('home.misc.logout')}
                </ThemedText>
              </Pressable>
            </View>

            {/* Ikony Facebook, Instagram a Bandzone pod informací o přihlášení */}
            {(activeBand?.facebook || activeBand?.instagram || activeBand?.bandzone) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -2, marginBottom: Spacing.two, flexWrap: 'wrap' }}>
                {activeBand?.facebook ? (
                  <Pressable
                    style={styles.socialHeaderBadge}
                    onPress={() => {
                      let url = activeBand.facebook!;
                      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
                      Linking.openURL(url);
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: '#1877f2', justifyContent: 'center', alignItems: 'center', marginRight: 4 }}>
                      <ThemedText style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', lineHeight: 15 }}>f</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: '#1877f2', fontSize: 12 }}>
                      Facebook
                    </ThemedText>
                  </Pressable>
                ) : null}

                {activeBand?.instagram ? (
                  <Pressable
                    style={styles.socialHeaderBadge}
                    onPress={() => {
                      let url = activeBand.instagram!;
                      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
                      Linking.openURL(url);
                    }}
                  >
                    <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'camera' }} size={16} tintColor="#e1306c" />
                    <ThemedText type="smallBold" style={{ color: '#e1306c', fontSize: 12, marginLeft: 4 }}>
                      Instagram
                    </ThemedText>
                  </Pressable>
                ) : null}

                {activeBand?.bandzone ? (
                  <Pressable
                    style={styles.socialHeaderBadge}
                    onPress={() => {
                      let url = activeBand.bandzone!;
                      if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
                      Linking.openURL(url);
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: '#ff5722', justifyContent: 'center', alignItems: 'center', marginRight: 4 }}>
                      <ThemedText style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold', lineHeight: 13 }}>BZ</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: '#ff5722', fontSize: 12 }}>
                      Bandzone
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Karta Příští zkouška - Zobrazit pouze pro Kapelníka a Členy, NE pro fanoušky */}
            {activeRoleView !== ('fan' as any) && upcomingRehearsal && (
              <ThemedView type="backgroundElement" style={styles.nextRehearsalBox}>
                <View style={styles.nextRehearsalHeader}>
                  <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={18} tintColor="#4caf50" />
                  <ThemedText type="smallBold" style={{ color: '#4caf50', marginLeft: 6 }}>
                    {t('home.upcomingRehearsal')}
                  </ThemedText>
                </View>
                <ThemedText type="default" style={{ fontWeight: 'bold', marginTop: 4 }}>
                  📅 {formatDateDisplay(upcomingRehearsal.date)} v {upcomingRehearsal.time}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                  📍 {upcomingRehearsal.location}
                </ThemedText>
                {upcomingRehearsal.whatToPrepare ? (
                  <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)' }}>
                    <ThemedText type="smallBold" themeColor="textSecondary">{t('events.whatToPrepare')}</ThemedText>
                    <ThemedText type="small" style={{ marginTop: 2 }}>{upcomingRehearsal.whatToPrepare}</ThemedText>
                  </View>
                ) : null}

                {/* Prezenční část / docházka pro příští zkoušku */}
                {renderAttendanceSection(upcomingRehearsal.id, 'rehearsal', upcomingRehearsal.attendees)}
              </ThemedView>
            )}

            {/* Sekce Koncerty a akce na hlavní stránce pod zkouškami */}
            {concerts.length > 0 && (
              <View style={{ marginTop: upcomingRehearsal ? -10 : 0 }}>
                <View style={styles.sectionHeaderRow}>
                  <SymbolView name={{ ios: 'music.mic', android: 'confirmation_number', web: 'confirmation_number' }} size={18} tintColor={theme.text} />
                  <ThemedText type="subtitle" style={{ fontSize: 18, marginLeft: 6 }}>
                    {t('home.upcomingConcerts')}
                  </ThemedText>
                </View>

                <View style={{ gap: Spacing.two, marginTop: Spacing.two + 2 }}>
                  {concerts.map(concert => {

                    const status = getEventStatus(concert.date, concert.startTime, concert.endTime);

                    // PRO FANOUŠKY: Zobrazit Pouze Název akce, Datum, Místo a Odlišení kapely
                    if (activeRoleView === 'fan') {
                      const bName = (concert as any)._bandName || activeBand?.name || 'Kapela';
                      const bLogo = (concert as any)._bandLogoUri; // Bez nesprávného fallbacku na activeBand logo!

                      return (
                        <ThemedView
                          key={concert.id}
                          type="backgroundElement"
                          style={[
                            styles.concertCard,
                            status === 'ongoing' ? styles.ongoingCard : (status === 'past' ? styles.pastCard : styles.futureCard)
                          ]}
                        >
                          {/* Odlišení kapely pro fanoušky */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.18)', gap: 8 }}>
                            {bLogo ? (
                              <Image source={{ uri: bLogo }} style={{ width: 22, height: 22, borderRadius: 11 }} />
                            ) : (
                              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                                <ThemedText style={{ fontSize: 11, fontWeight: 'bold' }}>{bName ? bName.charAt(0).toUpperCase() : '?'}</ThemedText>
                              </View>
                            )}
                            <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 13 }}>
                              {bName}
                            </ThemedText>
                          </View>

                          <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                            {concert.title}
                          </ThemedText>
                          <ThemedText type="default" style={{ fontWeight: 'bold', marginTop: 4 }}>
                            📅 {formatDateDisplay(concert.date)} {concert.startTime ? `v ${concert.startTime}` : ''}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                            📍 {concert.location}
                          </ThemedText>
                        </ThemedView>
                      );
                    }

                    const isExpanded = !!expandedConcerts[concert.id];

                    return (
                      <Pressable key={concert.id} onPress={() => toggleExpandConcert(concert.id)}>
                        <ThemedView
                          type="backgroundElement"
                          style={[
                            styles.concertCard,
                            concert.isCancelled
                              ? styles.cancelledCard
                              : (status === 'ongoing' ? styles.ongoingCard : (status === 'past' ? styles.pastCard : styles.futureCard))
                          ]}
                        >
                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                              <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold' }}>
                                {concert.title}
                              </ThemedText>
                              <ThemedText type="default" style={{ fontWeight: 'bold', marginTop: 2, fontSize: 13 }}>
                                📅 {formatDateDisplay(concert.date)} {concert.startTime ? `v ${concert.startTime}` : ''}
                              </ThemedText>
                              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                                📍 {concert.location}
                              </ThemedText>
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <View style={styles.badgeColumn}>
                                {concert.isCancelled && (
                                  <View style={[styles.statusBadge, { backgroundColor: '#e91e63' }]}>
                                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>{t('home.concert.cancelled')}</ThemedText>
                                  </View>
                                )}
                                {concert.isPrivate && (
                                  <View style={[styles.statusBadge, { backgroundColor: '#2196f3' }]}>
                                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 10 }}>{t('home.concert.privateBadge')}</ThemedText>
                                  </View>
                                )}
                              </View>
                              <SymbolView
                                name={{ ios: isExpanded ? 'chevron.up' : 'chevron.down', android: isExpanded ? 'expand_less' : 'expand_more', web: isExpanded ? 'expand_less' : 'expand_more' }}
                                size={18}
                                tintColor={theme.textSecondary}
                              />
                            </View>
                          </View>

                          {/* Podrobnosti zobrazené po rozbalení */}
                          {isExpanded && (
                            <View style={{ marginTop: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)' }}>
                              {concert.price ? (
                                <View style={styles.detailRow}>
                                  <ThemedText type="smallBold" themeColor="textSecondary">{t('home.concert.price')}</ThemedText>
                                  <ThemedText type="small" style={{ fontWeight: 'bold' }}>{concert.price}</ThemedText>
                                </View>
                              ) : null}

                              {(concert.departureTime || concert.departureLocation) && (
                                <View style={styles.detailRow}>
                                  <ThemedText type="smallBold" themeColor="textSecondary">{t('home.concert.departure')}</ThemedText>
                                  <ThemedText type="small">
                                    {concert.departureTime ? `${concert.departureTime} ` : ''}
                                    {concert.departureLocation ? `(${concert.departureLocation})` : ''}
                                  </ThemedText>
                                </View>
                              )}

                              {(concert.soundCheckFrom || concert.soundCheckTo) && (
                                <View style={styles.detailRow}>
                                  <ThemedText type="smallBold" themeColor="textSecondary">{t('home.concert.soundcheck')}</ThemedText>
                                  <ThemedText type="small">
                                    {concert.soundCheckFrom ? `${concert.soundCheckFrom}` : ''}
                                    {concert.soundCheckTo ? ` - ${concert.soundCheckTo}` : ''}
                                  </ThemedText>
                                </View>
                              )}

                              {(concert.organizers && concert.organizers.length > 0) || concert.contacts ? (
                                <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.15)' }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <ThemedText type="smallBold" themeColor="textSecondary">{t('home.concert.contacts')}</ThemedText>
                                    {activeRoleView !== ('fan' as any) && activeBand && (
                                      <Pressable
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(33, 150, 243, 0.15)' }}
                                        onPress={() => shareConcertStageplan({ band: activeBand, concert, members, currentUser })}
                                      >
                                        <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={12} tintColor="#2196f3" />
                                        <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 11 }}>{t('home.concert.share')}</ThemedText>
                                      </Pressable>
                                    )}
                                  </View>
                                  {concert.organizers && concert.organizers.length > 0 ? (
                                    <View style={{ gap: 6, marginTop: 4 }}>
                                      {concert.organizers.map(org => (
                                        <View key={org.id} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                          <View style={[styles.orgBadgeSmall, { backgroundColor: org.role === 'Zvukař' ? 'rgba(255,152,0,0.2)' : (org.role === 'Pořadatel' ? 'rgba(76,175,80,0.2)' : 'rgba(33,150,243,0.2)') }]}>
                                            <ThemedText type="smallBold" style={{ color: org.role === 'Zvukař' ? '#ff9800' : (org.role === 'Pořadatel' ? '#4caf50' : '#2196f3'), fontSize: 10 }}>
                                              {org.role || t('home.concert.contactRole')}
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

                              {concert.whatToTake && concert.whatToTake.length > 0 ? (
                                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)' }}>
                                  <ThemedText type="smallBold" themeColor="textSecondary">{t('home.concert.whatToTake')}</ThemedText>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {concert.whatToTake.map(item => (
                                      <View key={item} style={styles.takeBadge}>
                                        <ThemedText type="small" style={{ fontSize: 11 }}>🧳 {item}</ThemedText>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          )}

                          {/* Prezenční část / docházka pro koncert */}
                          {renderAttendanceSection(concert.id, 'concert', concert.attendees)}
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

        </View>
        </ScrollView>
      
      

      </SafeAreaView>

      
      {/* MODAL PRO PŘEPÍNÁNÍ KAPEL */}
      <Modal visible={showSwitchBandModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalBox}>
            <ThemedText type="subtitle" style={{ marginBottom: 4, textAlign: 'center' }}>
              {activeRoleView === 'fan' ? (t('home.misc.manageBands') || 'Spravovat sledované kapely') : (t('home.misc.myBands') || 'Moje kapely')}
            </ThemedText>

            {activeRoleView === 'fan' && (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 12, textAlign: 'center' }}>
                {t('home.misc.toggleBandHint') || 'Klepnutím na kapelu ji přidáte nebo odeberete ze sledovaných:'}
              </ThemedText>
            )}

            <ScrollView style={{ maxHeight: 320 }}>
              {activeRoleView === 'fan' ? (
                allBands.map((band, index) => {
                  const isFollowed = savedSessions.some(s => s.band.id === band.id);
                  return (
                    <Pressable
                      key={band.id || index}
                      style={[
                        styles.modalMemberItem,
                        isFollowed && { borderColor: '#4caf50', borderWidth: 2, backgroundColor: 'rgba(76, 175, 80, 0.15)' }
                      ]}
                      onPress={() => handleToggleFanBand(band, isFollowed)}
                    >
                      {band.logoUri ? (
                        <Image source={{ uri: band.logoUri }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                      ) : (
                        <View style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: 'rgba(150,150,150,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                          <ThemedText style={{ fontSize: 14, fontWeight: 'bold' }}>{band.name ? band.name.charAt(0).toUpperCase() : '?'}</ThemedText>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <ThemedText type="default" style={{ fontWeight: isFollowed ? 'bold' : 'normal' }}>{band.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {isFollowed ? '✓ Sledováno' : 'Klepnutím sledovat'}
                        </ThemedText>
                      </View>
                      {isFollowed && (
                        <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={24} tintColor="#4caf50" />
                      )}
                    </Pressable>
                  );
                })
              ) : (
                savedSessions.map((session, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.modalMemberItem,
                      session.band.id === activeBand?.id && { borderColor: '#4caf50', borderWidth: 2 }
                    ]}
                    onPress={() => handleSwitchToSession(session)}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="default" style={{ fontWeight: 'bold' }}>{session.band.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {session.user.displayName} • {session.user.role === 'admin' ? t('roles.admin') : (session.user.role === 'member' ? t('roles.member') : t('roles.fan'))}
                      </ThemedText>
                    </View>
                    {session.band.id === activeBand?.id && (
                      <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={24} tintColor="#4caf50" />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>

            {activeRoleView !== 'fan' && (
              <Pressable
                style={[styles.modalSaveBtn, { backgroundColor: '#2196f3', marginTop: 16 }]}
                onPress={handleAddNewBand}
              >
                <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('home.misc.addBand') || '+ Přihlásit další kapelu'}</ThemedText>
              </Pressable>
            )}

            <Pressable
              style={[styles.modalCancelBtn, { marginTop: 12, alignSelf: 'center' }]}
              onPress={() => setShowSwitchBandModal(false)}
            >
              <ThemedText type="smallBold">{t('home.misc.cancel')}</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>


      {/* Modal pro přidání/úpravu člena (pouze pro kapelníka) */}
      <Modal visible={showAddMemberModal} animationType="slide" presentationStyle="pageSheet">
         <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
         <ThemedView style={{flex: 1}}>
            <AddMemberForm initialMember={editingMember || undefined} onSave={handleSaveMember} onCancel={() => setShowAddMemberModal(false)} />
         </ThemedView>
         </KeyboardAvoidingView>
      </Modal>

      {/* Modal pro zobrazení a odeslání Stageplanu z karty koncertu */}
      {selectedConcertForStageplan && activeBand && (
        <StageplanModal
          visible={!!selectedConcertForStageplan}
          onClose={() => setSelectedConcertForStageplan(null)}
          band={activeBand}
          members={members}
          concert={selectedConcertForStageplan}
          onSave={async (updatedStageplan) => {
            const updated = await updateBand(activeBand.id, { stageplan: updatedStageplan });
            setActiveBand(updated);
            AsyncStorage.setItem('savedBand', JSON.stringify(updated));
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
              placeholder={t('home.attendance.notePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={editAttendanceState?.note || ''}
              onChangeText={text => setEditAttendanceState(prev => prev ? { ...prev, note: text } : null)}
            />

            {/* Tlačítka Uložit / Zrušit */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setEditAttendanceState(null)} style={styles.modalCancelBtn}>
                <ThemedText type="smallBold" themeColor="textSecondary">{t('home.misc.cancel')}</ThemedText>
              </Pressable>
              <Pressable onPress={saveMemberAttendance} style={styles.modalSaveBtn}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('setlist.saveBtn')}</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({

  modalMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.3)',
    backgroundColor: 'rgba(150,150,150,0.1)',
    marginBottom: 8
  },

  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six },
  contentPadding: { paddingHorizontal: 3 },
  loggedInRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two, marginTop: 3 },
  socialHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(200,200,200,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.3)',
  },
  logoutBtnInline: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(150,150,150,0.2)' },
  nextRehearsalBox: {
    paddingVertical: Spacing.three,
    paddingHorizontal: 3,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  nextRehearsalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  concertCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: 3,
    borderRadius: Spacing.three,
  },
  futureCard: {
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  ongoingCard: {
    borderWidth: 2,
    borderColor: '#ffc107',
  },
  cancelledCard: {
    borderWidth: 1,
    borderColor: '#e91e63',
    opacity: 0.7,
  },
  pastCard: {
    borderWidth: 1,
    borderColor: '#8b0000',
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeColumn: {
    gap: 4,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  orgBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  takeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.15)',
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
  prepareBox: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  adminInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, backgroundColor: 'rgba(150,150,150,0.2)' },
  attBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  attBtnInactive: {
    backgroundColor: 'rgba(150,150,150,0.15)',
    borderColor: 'transparent',
  },
  attBtnYesActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  attBtnNoActive: {
    backgroundColor: '#e91e63',
    borderColor: '#e91e63',
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

  membersSection: { marginBottom: Spacing.six },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  addButton: { padding: Spacing.two, borderRadius: Spacing.six },
  membersList: { gap: Spacing.three },
  memberCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  memberPhoto: { width: 50, height: 50, borderRadius: 25, marginRight: Spacing.three },
  memberInfo: { flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginRight: Spacing.two },
  editMemberBtn: { padding: Spacing.two, marginLeft: Spacing.two },

  logoutContainer: { alignItems: 'center', marginTop: Spacing.four },
  logoutButton: { padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.six }
});
