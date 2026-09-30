import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, addMonths, startOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { cs } from 'date-fns/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Concert, Rehearsal, Absence } from '@/types';
import { SymbolView } from 'expo-symbols';

// Nastavení češtiny pro kalendář
LocaleConfig.locales['cs'] = {
  monthNames: [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
  ],
  monthNamesShort: [
    'Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer',
    'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'
  ],
  dayNames: [
    'Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'
  ],
  dayNamesShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
  today: 'Dnes'
};
LocaleConfig.defaultLocale = 'cs';

interface EventsCalendarProps {
  concerts?: Concert[];
  rehearsals?: Rehearsal[];
  absences?: Record<string, Record<string, boolean>>; // Tohle je starý formát, přidáme i čisté pole absencí
  rawAbsences?: Absence[]; // Nově přidané prop pro snadné vyhledání detailů
}

export function EventsCalendar({ concerts = [], rehearsals = [], absences = {}, rawAbsences = [] }: EventsCalendarProps) {
  const theme = useTheme();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const today = new Date();

  // Vygenerujeme 12 měsíců počínaje aktuálním
  const months = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const date = addMonths(startOfMonth(today), i);
      return format(date, 'yyyy-MM-dd');
    });
  }, []);

  const formatAnyDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }

  // Vytvoříme marked dates pro kalendář
  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};

    // 1. Zpracování absencí (žlutá) z původní mapy (fallback)
    Object.keys(absences).forEach(date => {
      marks[date] = {
        customStyles: {
          container: { backgroundColor: '#FFD700', borderRadius: 4 }, // Žlutá pro absence
          text: { color: '#000000' }
        },
        hasAbsence: true
      };
    });

    // Zpracujeme i rozmezí absencí z rawAbsences, pokud existují, a vyznačíme je (doporučeno)
    rawAbsences.forEach(absence => {
      const start = parseISO(formatAnyDate(absence.dateFrom));
      const end = parseISO(formatAnyDate(absence.dateTo));

      let curr = new Date(start);
      while(curr <= end) {
          const dateStr = format(curr, 'yyyy-MM-dd');
          if(!marks[dateStr]) {
               marks[dateStr] = {
                  customStyles: {
                    container: { backgroundColor: '#FFD700', borderRadius: 4 }, // Žlutá pro absence
                    text: { color: '#000000' }
                  },
                  hasAbsence: true
               };
          } else {
              marks[dateStr].hasAbsence = true;
          }
          curr.setDate(curr.getDate() + 1);
      }
    });

    // 2. Zpracování zkoušek (modrá)
    rehearsals.forEach(rehearsal => {
      if(rehearsal.isCancelled) return;

      const date = formatAnyDate(rehearsal.date);
      const hasAbsence = marks[date]?.hasAbsence;

      marks[date] = {
        customStyles: {
          container: {
            backgroundColor: hasAbsence ? '#FFA500' : '#4169E1', // Oranžová pro konflikt, modrá pro zkoušku
            borderRadius: 4
          },
          text: { color: '#FFFFFF' }
        }
      };
    });

    // 3. Zpracování koncertů/akcí (červená)
    concerts.forEach(concert => {
      if(concert.isCancelled) return;

      const date = formatAnyDate(concert.date);
      const hasAbsence = marks[date]?.hasAbsence;

      marks[date] = {
        customStyles: {
          container: {
            backgroundColor: hasAbsence ? '#FFA500' : '#DC143C', // Oranžová pro konflikt, červená pro koncert
            borderRadius: 4
          },
          text: { color: '#FFFFFF', fontWeight: 'bold' }
        }
      };
    });

    // 4. Označení dnešního dne červeným písmem (pokud nemá vlastní barevné pozadí)
    const todayStr = format(today, 'yyyy-MM-dd');
    if (!marks[todayStr]) {
      marks[todayStr] = {
        customStyles: {
          text: { color: '#DC143C', fontWeight: 'bold' }
        }
      };
    }

    return marks;
  }, [concerts, rehearsals, absences, rawAbsences]);

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setIsModalVisible(true);
  };

  const getEventsForDate = (dateStr: string) => {
      const parsedDate = parseISO(dateStr);

      const dayConcerts = concerts.filter(c => !c.isCancelled && formatAnyDate(c.date) === dateStr);
      const dayRehearsals = rehearsals.filter(r => !r.isCancelled && formatAnyDate(r.date) === dateStr);
      const dayAbsences = rawAbsences.filter(a => {
          const start = parseISO(formatAnyDate(a.dateFrom));
          const end = parseISO(formatAnyDate(a.dateTo));

          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);

          return isWithinInterval(parsedDate, { start, end });
      });

      return { concerts: dayConcerts, rehearsals: dayRehearsals, absences: dayAbsences };
  };

  const renderModalContent = () => {
    if (!selectedDate) return null;

    const { concerts: dayConcerts, rehearsals: dayRehearsals, absences: dayAbsences } = getEventsForDate(selectedDate);
    const dateObj = parseISO(selectedDate);
    const displayDate = format(dateObj, 'd. MMMM yyyy', { locale: cs });

    const hasEvents = dayConcerts.length > 0 || dayRehearsals.length > 0 || dayAbsences.length > 0;

    return (
      <Pressable style={styles.modalOverlay} onPress={() => setIsModalVisible(false)}>
        <Pressable style={{ width: '100%' }} onPress={(e) => e.stopPropagation()}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
               <ThemedText type="subtitle" style={{fontWeight: 'bold', textTransform: 'capitalize'}}>{displayDate}</ThemedText>
               <Pressable onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                  <SymbolView name="xmark" size={24} tintColor={theme.text} />
               </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
               {!hasEvents && (
                   <ThemedText type="default" themeColor="textSecondary" style={{textAlign: 'center', marginTop: 20}}>
                      Na tento den nejsou plánovány žádné akce.
                   </ThemedText>
               )}

               {dayConcerts.length > 0 && (
                  <View style={styles.eventSection}>
                      <ThemedText type="smallBold" style={{color: '#DC143C', marginBottom: Spacing.two, fontSize: 16}}>Koncerty a akce</ThemedText>
                      {dayConcerts.map(c => (
                          <View key={c.id} style={styles.eventItem}>
                             <ThemedText type="default" style={{fontWeight: 'bold'}}>{c.title}</ThemedText>
                             <ThemedText type="small">📍 {c.location}</ThemedText>
                             {c.startTime && <ThemedText type="small">⏰ Od {c.startTime} {c.endTime ? `- do ${c.endTime}` : ''}</ThemedText>}
                             {c.soundCheckFrom && <ThemedText type="small">🎛 Zvukovka: {c.soundCheckFrom}</ThemedText>}
                             {c.contacts && <ThemedText type="small" themeColor="textSecondary">Pozn.: {c.contacts}</ThemedText>}
                          </View>
                      ))}
                  </View>
               )}

               {dayRehearsals.length > 0 && (
                  <View style={styles.eventSection}>
                      <ThemedText type="smallBold" style={{color: '#4169E1', marginBottom: Spacing.two, fontSize: 16}}>Zkoušky</ThemedText>
                      {dayRehearsals.map(r => (
                          <View key={r.id} style={styles.eventItem}>
                             <ThemedText type="default" style={{fontWeight: 'bold'}}>Zkouška v: {r.location}</ThemedText>
                             <ThemedText type="small">⏰ {r.time}</ThemedText>
                             {r.whatToPrepare && <ThemedText type="small">Co připravit: {r.whatToPrepare}</ThemedText>}
                          </View>
                      ))}
                  </View>
               )}

               {dayAbsences.length > 0 && (
                  <View style={styles.eventSection}>
                      <ThemedText type="smallBold" style={{color: '#B8860B', marginBottom: Spacing.two, fontSize: 16}}>Absence</ThemedText>
                      {dayAbsences.map(a => (
                          <View key={a.id} style={[styles.eventItem, {borderLeftColor: '#FFD700'}]}>
                             <ThemedText type="default" style={{fontWeight: 'bold'}}>{a.memberName}</ThemedText>
                             <ThemedText type="small">Důvod: {a.reason}</ThemedText>
                             <ThemedText type="small" themeColor="textSecondary">Od {a.dateFrom} do {a.dateTo}</ThemedText>
                          </View>
                      ))}
                  </View>
               )}
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Pressable>
    );
  };

  const renderMonth = ({ item }: { item: string }) => {
    return (
      <View style={[styles.calendarWrapper, { borderColor: theme.backgroundElement }]}>
        <Calendar
          current={item}
          hideArrows={true}
          disableMonthChange={true}
          hideExtraDays={true}
          firstDay={1}
          markingType={'custom'}
          markedDates={markedDates}
          onDayPress={handleDayPress}
          theme={{
            calendarBackground: theme.backgroundElement,
            textSectionTitleColor: theme.textSecondary,
            dayTextColor: theme.text,
            todayTextColor: '#DC143C',
            monthTextColor: theme.text,
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '500',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13,
            // @ts-ignore
            'stylesheet.calendar.header': {
              header: {
                flexDirection: 'row',
                justifyContent: 'center',
                paddingLeft: 10,
                paddingRight: 10,
                marginTop: 6,
                alignItems: 'center'
              },
              monthText: {
                fontSize: 16,
                fontWeight: 'bold',
                color: theme.text,
                margin: 10,
                textTransform: 'capitalize'
              }
            }
          }}
          renderHeader={(date: any) => {
             const dateObj = new Date(date.getTime());
             const monthName = format(dateObj, 'LLLL', { locale: cs });
             const year = format(dateObj, 'yyyy');
             return (
               <ThemedText style={styles.monthHeader}>
                 {monthName.charAt(0).toUpperCase() + monthName.slice(1)} {year}
               </ThemedText>
             );
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#DC143C' }]} />
          <ThemedText type="small">Akce</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4169E1' }]} />
          <ThemedText type="small">Zkouška</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFD700' }]} />
          <ThemedText type="small">Absence</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFA500' }]} />
          <ThemedText type="small">Konflikt</ThemedText>
        </View>
      </View>

      <View style={styles.listContent}>
        {months.map(item => <React.Fragment key={item}>{renderMonth({item})}</React.Fragment>)}
      </View>

      <Modal visible={isModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
         {renderModalContent()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing.six,
  },
  calendarWrapper: {
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  monthHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.two,
    marginBottom: Spacing.one,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four
  },
  modalContent: {
    borderRadius: Spacing.three,
    maxHeight: '80%',
    minHeight: 200,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)'
  },
  closeBtn: {
    padding: Spacing.one
  },
  modalBody: {
    padding: Spacing.four
  },
  eventSection: {
    marginBottom: Spacing.four
  },
  eventItem: {
    backgroundColor: 'rgba(150,150,150,0.1)',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(150,150,150,0.3)'
  }
});
