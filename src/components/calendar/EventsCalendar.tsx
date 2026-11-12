import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, addMonths, startOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { cs, sk, enUS, de, pl, es, fr } from 'date-fns/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Concert, Rehearsal, Absence } from '@/types';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from '@/utils/i18n';

// Mapa date-fns lokalizací
const dateFnsLocales: Record<string, any> = {
  cs,
  sk,
  en: enUS,
  de,
  pl,
  es,
  fr,
};

// Nastavení češtiny pro kalendář
LocaleConfig.locales['cs'] = {
  monthNames: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
  monthNamesShort: ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'],
  dayNames: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
  dayNamesShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
  today: 'Dnes'
};

// Nastavení slovenštiny pro kalendář
LocaleConfig.locales['sk'] = {
  monthNames: ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
  dayNames: ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'],
  dayNamesShort: ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'],
  today: 'Dnes'
};

// Nastavení angličtiny pro kalendář
LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  today: 'Today'
};

// Nastavení němčiny pro kalendář
LocaleConfig.locales['de'] = {
  monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  monthNamesShort: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  dayNames: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  dayNamesShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  today: 'Heute'
};

// Nastavení polštiny pro kalendář
LocaleConfig.locales['pl'] = {
  monthNames: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
  monthNamesShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
  dayNames: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
  dayNamesShort: ['Nie', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'],
  today: 'Dzisiaj'
};

// Nastavení španělštiny pro kalendář
LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};

// Nastavení francouzštiny pro kalendář
LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  monthNamesShort: ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'],
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  today: "Aujourd'hui"
};

LocaleConfig.defaultLocale = 'cs';

interface EventsCalendarProps {
  concerts?: Concert[];
  rehearsals?: Rehearsal[];
  absences?: Record<string, Record<string, boolean>>;
  rawAbsences?: Absence[];
}

export function EventsCalendar({ concerts = [], rehearsals = [], absences = {}, rawAbsences = [] }: EventsCalendarProps) {
  const theme = useTheme();
  const { t, currentLang } = useTranslation();

  // Bezpečné nastavení výchozího jazyka pro react-native-calendars
  const safeLang = LocaleConfig.locales[currentLang] ? currentLang : 'cs';
  LocaleConfig.defaultLocale = safeLang;

  const currentDateFnsLocale = dateFnsLocales[currentLang] || cs;

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
  };

  // Vytvoříme marked dates pro kalendář
  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};

    // 1. Zpracování absencí (žlutá)
    Object.keys(absences).forEach(date => {
      marks[date] = {
        customStyles: {
          container: { backgroundColor: '#FFD700', borderRadius: 4 },
          text: { color: '#000000' }
        },
        hasAbsence: true
      };
    });

    rawAbsences.forEach(absence => {
      const start = parseISO(formatAnyDate(absence.dateFrom));
      const end = parseISO(formatAnyDate(absence.dateTo));

      let curr = new Date(start);
      while (curr <= end) {
        const dateStr = format(curr, 'yyyy-MM-dd');
        if (!marks[dateStr]) {
          marks[dateStr] = {
            customStyles: {
              container: { backgroundColor: '#FFD700', borderRadius: 4 },
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
      if (rehearsal.isCancelled) return;

      const date = formatAnyDate(rehearsal.date);
      const hasAbsence = marks[date]?.hasAbsence;

      marks[date] = {
        customStyles: {
          container: {
            backgroundColor: hasAbsence ? '#FFA500' : '#4169E1',
            borderRadius: 4
          },
          text: { color: '#FFFFFF' }
        }
      };
    });

    // 3. Zpracování koncertů/akcí (červená)
    concerts.forEach(concert => {
      if (concert.isCancelled) return;

      const date = formatAnyDate(concert.date);
      const hasAbsence = marks[date]?.hasAbsence;

      marks[date] = {
        customStyles: {
          container: {
            backgroundColor: hasAbsence ? '#FFA500' : '#DC143C',
            borderRadius: 4
          },
          text: { color: '#FFFFFF', fontWeight: 'bold' }
        }
      };
    });

    // 4. Označení dnešního dne
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

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      return isWithinInterval(parsedDate, { start, end });
    });

    return { concerts: dayConcerts, rehearsals: dayRehearsals, absences: dayAbsences };
  };

  const renderModalContent = () => {
    if (!selectedDate) return null;

    const { concerts: dayConcerts, rehearsals: dayRehearsals, absences: dayAbsences } = getEventsForDate(selectedDate);
    const dateObj = parseISO(selectedDate);
    const displayDate = format(dateObj, 'd. MMMM yyyy', { locale: currentDateFnsLocale });

    const hasEvents = dayConcerts.length > 0 || dayRehearsals.length > 0 || dayAbsences.length > 0;

    return (
      <Pressable style={styles.modalOverlay} onPress={() => setIsModalVisible(false)}>
        <Pressable style={{ width: '100%' }} onPress={(e) => e.stopPropagation()}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                {displayDate}
              </ThemedText>
              <Pressable onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <SymbolView name="xmark" size={24} tintColor={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {!hasEvents && (
                <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                  {t('calendar.noEvents')}
                </ThemedText>
              )}

              {dayConcerts.length > 0 && (
                <View style={styles.eventSection}>
                  <ThemedText type="smallBold" style={{ color: '#DC143C', marginBottom: Spacing.two, fontSize: 16 }}>
                    {t('calendar.section.concerts')}
                  </ThemedText>
                  {dayConcerts.map(c => (
                    <View key={c.id} style={styles.eventItem}>
                      <ThemedText type="default" style={{ fontWeight: 'bold' }}>{c.title}</ThemedText>
                      <ThemedText type="small">📍 {c.location}</ThemedText>
                      {c.startTime && <ThemedText type="small">⏰ {c.startTime} {c.endTime ? `- ${c.endTime}` : ''}</ThemedText>}
                      {c.soundCheckFrom && <ThemedText type="small">🎛 {c.soundCheckFrom}</ThemedText>}
                      {c.contacts && <ThemedText type="small" themeColor="textSecondary">{c.contacts}</ThemedText>}
                    </View>
                  ))}
                </View>
              )}

              {dayRehearsals.length > 0 && (
                <View style={styles.eventSection}>
                  <ThemedText type="smallBold" style={{ color: '#4169E1', marginBottom: Spacing.two, fontSize: 16 }}>
                    {t('calendar.section.rehearsals')}
                  </ThemedText>
                  {dayRehearsals.map(r => (
                    <View key={r.id} style={styles.eventItem}>
                      <ThemedText type="default" style={{ fontWeight: 'bold' }}>
                        {t('events.rehearsalIn')} {r.location}
                      </ThemedText>
                      <ThemedText type="small">⏰ {r.time}</ThemedText>
                      {r.whatToPrepare && (
                        <ThemedText type="small">
                          {t('events.whatToPrepare')} {r.whatToPrepare}
                        </ThemedText>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {dayAbsences.length > 0 && (
                <View style={styles.eventSection}>
                  <ThemedText type="smallBold" style={{ color: '#B8860B', marginBottom: Spacing.two, fontSize: 16 }}>
                    {t('calendar.section.absences')}
                  </ThemedText>
                  {dayAbsences.map(a => (
                    <View key={a.id} style={[styles.eventItem, { borderLeftColor: '#FFD700' }]}>
                      <ThemedText type="default" style={{ fontWeight: 'bold' }}>{a.memberName}</ThemedText>
                      <ThemedText type="small">{t('events.reason')} {a.reason}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{a.dateFrom} - {a.dateTo}</ThemedText>
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
            const monthName = format(dateObj, 'LLLL', { locale: currentDateFnsLocale });
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
          <ThemedText type="small">{t('calendar.legend.action')}</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4169E1' }]} />
          <ThemedText type="small">{t('calendar.legend.rehearsal')}</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFD700' }]} />
          <ThemedText type="small">{t('calendar.legend.absence')}</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFA500' }]} />
          <ThemedText type="small">{t('calendar.legend.conflict')}</ThemedText>
        </View>
      </View>

      {months.map(item => (
        <View key={item}>
          {renderMonth({ item })}
        </View>
      ))}

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        {renderModalContent()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  calendarWrapper: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: Spacing.two,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    maxHeight: '80%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
  },
  eventSection: {
    marginBottom: Spacing.four,
  },
  eventItem: {
    padding: Spacing.two,
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    borderLeftWidth: 4,
    borderLeftColor: '#DC143C',
    gap: 2,
  },
});
