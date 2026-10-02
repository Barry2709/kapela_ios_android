import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, TextInput, ScrollView } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/useAppStore';
import { Concert, Rehearsal, Inquiry, BandMember, AttendanceStatus, AttendanceRecord } from '@/types';
import {
  getBandMembers,
  updateConcert,
  updateRehearsal,
  updateInquiryStatus,
  subscribeToConcerts,
  subscribeToRehearsals,
  subscribeToInquiries,
} from '@/services/firebaseService';
import { sendExpoPushNotifications, updateAppBadgeCount, triggerLocalSystemNotification } from '@/services/notificationService';

export interface PendingEventItem {
  id: string;
  type: 'concert' | 'rehearsal' | 'inquiry';
  title: string;
  date: string;
  time?: string;
  location?: string;
  details?: string;
  rawEvent: Concert | Rehearsal | Inquiry;
}

export function AttendanceQueueModal() {
  const theme = useTheme();
  const { activeBand, currentUser, activeRoleView } = useAppStore();

  const [pendingQueue, setPendingQueue] = useState<PendingEventItem[]>([]);
  const [currentMember, setCurrentMember] = useState<BandMember | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const knownPendingIdsRef = React.useRef<Set<string> | null>(null);

  // Načtení dat a živé naslouchání na změny docházky
  useEffect(() => {
    if (!activeBand?.id) {
      setPendingQueue([]);
      updateAppBadgeCount(0);
      return;
    }

    let latestConcerts: Concert[] = [];
    let latestRehearsals: Rehearsal[] = [];
    let latestInquiries: Inquiry[] = [];
    let currentMem: BandMember | null = null;

    const recomputeQueue = () => {
      if (!currentMem || currentMem.isGuest || currentMem.isActive === false) {
        setPendingQueue([]);
        updateAppBadgeCount(0);
        return;
      }

      const memberId = currentMem.id;
      const queue: PendingEventItem[] = [];

      // A) Kontrola koncertů
      latestConcerts.forEach(c => {
        if (!c.isCancelled) {
          const userResponse = c.attendees?.[memberId];
          if (!userResponse) {
            queue.push({
              id: c.id,
              type: 'concert',
              title: c.title,
              date: c.date,
              time: c.startTime,
              location: c.location,
              details: c.price ? `Honorář: ${c.price}` : c.notes,
              rawEvent: c,
            });
          }
        }
      });

      // B) Kontrola zkoušek
      latestRehearsals.forEach(r => {
        if (!r.isCancelled) {
          const userResponse = r.attendees?.[memberId];
          if (!userResponse) {
            queue.push({
              id: r.id,
              type: 'rehearsal',
              title: `Zkouška ${r.location ? `- ${r.location}` : ''}`,
              date: r.date,
              time: r.time,
              location: r.location,
              details: r.whatToPrepare ? `Co připravit: ${r.whatToPrepare}` : undefined,
              rawEvent: r,
            });
          }
        }
      });

      // C) Kontrola poptávek
      latestInquiries.forEach(i => {
        if (i.status !== 'declined') {
          const userResponse = i.attendees?.[memberId];
          if (!userResponse) {
            queue.push({
              id: i.id,
              type: 'inquiry',
              title: `Poptávka: ${i.title}`,
              date: i.date,
              time: `${i.startTime} - ${i.endTime}`,
              location: i.location,
              details: i.notes ? `Poznámka: ${i.notes}` : undefined,
              rawEvent: i,
            });
          }
        }
      });

      // Detekce nově přidaných událostí přes Firebase a vyvolání lokální systémové notifikace
      const currentIds = new Set(queue.map(q => q.id));
      if (knownPendingIdsRef.current !== null) {
        const newlyAdded = queue.filter(item => !knownPendingIdsRef.current?.has(item.id));
        if (newlyAdded.length > 0) {
          const firstNew = newlyAdded[0];
          triggerLocalSystemNotification(
            `🔔 Nová výzva: ${firstNew.title}`,
            `Datum: ${firstNew.date} ${firstNew.time ? `v ${firstNew.time}` : ''}. Potvrďte docházku.`,
            queue.length
          );
        }
      }
      knownPendingIdsRef.current = currentIds;

      setPendingQueue(queue);
      updateAppBadgeCount(queue.length);
    };

    // Načteme členy kapely
    getBandMembers(activeBand.id).then(members => {
      setBandMembers(members);
      const member = members.find(m =>
        m.id === currentUser?.memberId ||
        (m.email && currentUser?.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        m.id === currentUser?.uid
      );
      currentMem = member || null;
      setCurrentMember(member || null);
      recomputeQueue();
    });

    const unsubConcerts = subscribeToConcerts(activeBand.id, (fresh) => {
      latestConcerts = fresh;
      recomputeQueue();
    });

    const unsubRehearsals = subscribeToRehearsals(activeBand.id, (fresh) => {
      latestRehearsals = fresh;
      recomputeQueue();
    });

    const unsubInquiries = subscribeToInquiries(activeBand.id, (fresh) => {
      latestInquiries = fresh;
      recomputeQueue();
    });

    return () => {
      unsubConcerts();
      unsubRehearsals();
      unsubInquiries();
    };
  }, [activeBand?.id, currentUser?.uid, activeRoleView]);

  // Pokud je fronta prázdná nebo chybí člen, okno nezobrazujeme
  if (pendingQueue.length === 0 || !currentMember) {
    return null;
  }

  const currentItem = pendingQueue[0];
  const memberName = currentMember.nickname || `${currentMember.firstName} ${currentMember.lastName || ''}`.trim();

  // Zpracování odpovědi (Můžu / Nemůžu)
  const handleResponse = async (status: 'yes' | 'no') => {
    if (!activeBand?.id || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const responseRecord: Record<string, any> = {
        status,
        updatedAt: Date.now(),
      };

      const memberId = currentMember.id;

      // 1. Zápis odpovědi do databáze Firestore
      if (currentItem.type === 'concert') {
        const concert = currentItem.rawEvent as Concert;
        const updatedAttendees = {
          ...(concert.attendees || {}),
          [memberId]: responseRecord,
        };
        await updateConcert(activeBand.id, concert.id, { attendees: updatedAttendees });
      } else if (currentItem.type === 'rehearsal') {
        const rehearsal = currentItem.rawEvent as Rehearsal;
        const updatedAttendees = {
          ...(rehearsal.attendees || {}),
          [memberId]: responseRecord,
        };
        await updateRehearsal(activeBand.id, rehearsal.id, { attendees: updatedAttendees });
      } else if (currentItem.type === 'inquiry') {
        const inquiry = currentItem.rawEvent as Inquiry;
        const updatedAttendees = {
          ...(inquiry.attendees || {}),
          [memberId]: responseRecord,
        };
        await updateInquiryStatus(activeBand.id, inquiry.id, inquiry.status || 'pending', updatedAttendees);
      }

      // 2. Odeslání Push Notifikace Adminům kapely
      const adminTokens = bandMembers
        .filter(m => (m.isAdmin || (m as any).role === 'admin') && m.pushToken && m.pushToken.trim().length > 0)
        .map(m => m.pushToken as string);

      if (adminTokens.length > 0) {
        const typeLabel = currentItem.type === 'concert' ? 'koncert' : (currentItem.type === 'rehearsal' ? 'zkoušku' : 'poptávku');
        const statusLabel = status === 'yes' ? '✅ potvrdil/a' : '❌ odmítl/a';

        sendExpoPushNotifications(
          adminTokens,
          `Docházka: ${memberName}`,
          `${memberName} ${statusLabel} účast na ${typeLabel}: ${currentItem.title}`,
          { eventId: currentItem.id, eventType: currentItem.type }
        );
      }

      // 3. Posun ve frontě a aktualizace odznaku
      const newQueue = pendingQueue.slice(1);
      setPendingQueue(newQueue);
      updateAppBadgeCount(newQueue.length);
    } catch (error) {
      console.error("Chyba při ukládání docházky:", error);
      Alert.alert("Chyba", "Nepodařilo se uložit vaši odpověď. Zkuste to prosím znovu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeColorMap = {
    concert: '#e91e63',
    rehearsal: '#4caf50',
    inquiry: '#ff9800',
  };

  const typeNameMap = {
    concert: 'Koncert',
    rehearsal: 'Zkouška',
    inquiry: 'Poptávka',
  };

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <ThemedView type="backgroundElement" style={styles.cardModal}>
          {/* Hlavička modálu */}
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: typeColorMap[currentItem.type] }]}>
              <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 11 }}>
                {typeNameMap[currentItem.type]}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Zbývá k potvzení: {pendingQueue.length}
            </ThemedText>
          </View>

          {/* Název události */}
          <ThemedText type="subtitle" style={styles.eventTitle}>
            {currentItem.title}
          </ThemedText>

          {/* Detaily události */}
          <ScrollView style={{ maxHeight: 180, marginVertical: Spacing.two }}>
            <ThemedText type="default" style={{ fontWeight: 'bold' }}>
              📅 Datum: {currentItem.date} {currentItem.time ? `v ${currentItem.time}` : ''}
            </ThemedText>

            {currentItem.location ? (
              <ThemedText type="small" style={{ marginTop: 4 }}>
                📍 Místo: {currentItem.location}
              </ThemedText>
            ) : null}

            {currentItem.details ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 6 }}>
                📝 {currentItem.details}
              </ThemedText>
            ) : null}
          </ScrollView>

          {/* Akční tlačítka Můžu / Nemůžu */}
          <View style={[styles.buttonRow, { marginTop: Spacing.two }]}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#e91e63', opacity: isSubmitting ? 0.6 : 1 }]}
              onPress={() => handleResponse('no')}
              disabled={isSubmitting}
            >
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={20} tintColor="#fff" />
              <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 15 }}>
                Nemůžu
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#4caf50', opacity: isSubmitting ? 0.6 : 1 }]}
              onPress={() => handleResponse('yes')}
              disabled={isSubmitting}
            >
              <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={20} tintColor="#fff" />
              <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 15 }}>
                Můžu
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  cardModal: {
    width: '100%',
    maxWidth: 420,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Spacing.two,
    gap: 6,
  },
});
