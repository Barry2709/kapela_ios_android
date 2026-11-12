import React from 'react';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';
import { TunerModal } from './tuner-modal';
import { useTranslation } from '@/utils/i18n';

export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Stav role uživatele a aktivní pod-záložky pro správu kapely, akce, zpěvník a pokladnu
  const { activeRoleView, manageBandTab, setManageBandTab, eventsTab, setEventsTab, repertoireTab, setRepertoireTab, treasuryTab, setTreasuryTab, showTunerModal, setShowTunerModal } = useAppStore();

  const renderCustomTabBar = (props: any) => {
    const currentRoute = props.state.routes[props.state.index].name;

    // VZHLED PRO FANOUŠKY: Spodní lišta -> Domů, Poptávky, Kapela
    if (activeRoleView === 'fan') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundElement,
              height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}
        >
          {/* Domů */}
          <Pressable
            style={styles.tabItem}
            onPress={() => props.navigation.navigate('index')}
          >
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={currentRoute === 'index' ? theme.text : theme.textSecondary}
              size={24}
            />
            <ThemedText
              type="smallBold"
              style={{ color: currentRoute === 'index' ? theme.text : theme.textSecondary, fontSize: 11, marginTop: 3 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.home')}
            </ThemedText>
          </Pressable>

          {/* Poptávky */}
          <Pressable
            style={styles.tabItem}
            onPress={() => {
              setEventsTab('poptavky');
              props.navigation.navigate('events');
            }}
          >
            <SymbolView
              name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              tintColor={currentRoute === 'events' ? theme.text : theme.textSecondary}
              size={24}
            />
            <ThemedText
              type="smallBold"
              style={{ color: currentRoute === 'events' ? theme.text : theme.textSecondary, fontSize: 11, marginTop: 3 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.inquiries')}
            </ThemedText>
          </Pressable>

          {/* Kapela */}
          <Pressable
            style={styles.tabItem}
            onPress={() => props.navigation.navigate('manage-band')}
          >
            <SymbolView
              name={{ ios: 'music.note.house.fill', android: 'domain', web: 'domain' }}
              tintColor={currentRoute === 'manage-band' ? theme.text : theme.textSecondary}
              size={24}
            />
            <ThemedText
              type="smallBold"
              style={{ color: currentRoute === 'manage-band' ? theme.text : theme.textSecondary, fontSize: 11, marginTop: 3 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.band')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 1: Stránka Akce ("events") -> Domů, Koncerty, Zkoušky, Poptávky, Rezervace, Absence
    if (currentRoute === 'events') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundElement,
              height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}
        >
          {/* Přehled */}
          {/* Domů */}
          <Pressable
            style={styles.tabItem}
            onPress={() => props.navigation.navigate('index')}
          >
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.home')}
            </ThemedText>
          </Pressable>

          {/* Akce Zkoušky (sloučené Koncerty a Zkoušky) */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('akce')}
          >
            <SymbolView
              name={{ ios: 'calendar', android: 'event', web: 'event' }}
              tintColor={eventsTab === 'akce' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'akce' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.eventsRehearsals')}
            </ThemedText>
          </Pressable>

          {/* Poptávky */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('poptavky')}
          >
            <SymbolView
              name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              tintColor={eventsTab === 'poptavky' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'poptavky' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.inquiries')}
            </ThemedText>
          </Pressable>

          {/* Rezervace */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('rezervace')}
          >
            <SymbolView
              name={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }}
              tintColor={eventsTab === 'rezervace' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'rezervace' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.reservations')}
            </ThemedText>
          </Pressable>

          {/* Absence */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('absence')}
          >
            <SymbolView
              name={{ ios: 'person.crop.circle.badge.xmark', android: 'event_busy', web: 'event_busy' }}
              tintColor={eventsTab === 'absence' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'absence' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.absences')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 2: Stránka Zpěvník ("repertoire") -> Domů, Naše písně, Zpěvník +, Audio zápisník
    if (currentRoute === 'repertoire') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundElement,
              height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}
        >
          {/* Přehled */}
          {/* Domů */}
          <Pressable
            style={styles.tabItem}
            onPress={() => props.navigation.navigate('index')}
          >
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.home')}
            </ThemedText>
          </Pressable>

          {/* Naše písně */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setRepertoireTab('nase_pisne')}
          >
            <SymbolView
              name={{ ios: 'music.note.list', android: 'library_music', web: 'library_music' }}
              tintColor={repertoireTab === 'nase_pisne' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: repertoireTab === 'nase_pisne' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.ourSongs')}
            </ThemedText>
          </Pressable>

          {/* Zpěvník + */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setRepertoireTab('zpevnik_plus')}
          >
            <SymbolView
              name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
              tintColor={repertoireTab === 'zpevnik_plus' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: repertoireTab === 'zpevnik_plus' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.songbookPlus')}
            </ThemedText>
          </Pressable>

          {/* Audio zápisník */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setRepertoireTab('audio_zapisnik')}
          >
            <SymbolView
              name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              tintColor={repertoireTab === 'audio_zapisnik' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: repertoireTab === 'audio_zapisnik' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.audioNotepad')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 3: Stránka Pokladna ("treasury") -> Domů, Příjem, Výdej, Doklady, Kniha jízd
    if (currentRoute === 'treasury') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundElement,
              height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}
        >
          {/* Přehled */}
          {/* Domů */}
          <Pressable
            style={styles.tabItem}
            onPress={() => props.navigation.navigate('index')}
          >
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.home')}
            </ThemedText>
          </Pressable>

          {/* Příjem */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('prijem')}
          >
            <SymbolView
              name={{ ios: 'arrow.down.circle.fill', android: 'add_circle', web: 'add_circle' }}
              tintColor={treasuryTab === 'prijem' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'prijem' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.income')}
            </ThemedText>
          </Pressable>

          {/* Výdej */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('vydej')}
          >
            <SymbolView
              name={{ ios: 'arrow.up.circle.fill', android: 'remove_circle', web: 'remove_circle' }}
              tintColor={treasuryTab === 'vydej' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'vydej' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.expense')}
            </ThemedText>
          </Pressable>

          {/* Doklady */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('doklady')}
          >
            <SymbolView
              name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }}
              tintColor={treasuryTab === 'doklady' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'doklady' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.receipts')}
            </ThemedText>
          </Pressable>

          {/* Kniha jízd */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('kniha_jizd')}
          >
            <SymbolView
              name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
              tintColor={treasuryTab === 'kniha_jizd' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'kniha_jizd' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.logbook')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 4: Stránka Kapela ("manage-band") -> Zobrazujeme ikony Domů, Profil, Členové, Technika, Nastavení
    if (currentRoute === 'manage-band') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundElement,
              height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}
        >
          {/* Tlačítko Domů */}
          <Pressable
            style={styles.tabItem}
            onPress={() => props.navigation.navigate('index')}
          >
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.home')}
            </ThemedText>
          </Pressable>

          {/* Tlačítko Profil */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('band')}
          >
            <SymbolView
              name={{ ios: 'building.2.fill', android: 'domain', web: 'domain' }}
              tintColor={manageBandTab === 'band' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'band' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.profile')}
            </ThemedText>
          </Pressable>

          {/* Tlačítko Členové */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('members')}
          >
            <SymbolView
              name={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
              tintColor={manageBandTab === 'members' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'members' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.members')}
            </ThemedText>
          </Pressable>

          {/* Tlačítko Fanoušci */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('fans')}
          >
            <SymbolView
              name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }}
              tintColor={manageBandTab === 'fans' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'fans' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.fans')}
            </ThemedText>
          </Pressable>

          {/* Tlačítko Technika */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('tech')}
          >
            <SymbolView
              name={{ ios: 'speaker.wave.2.fill', android: 'speaker', web: 'speaker' }}
              tintColor={manageBandTab === 'tech' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'tech' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.tech')}
            </ThemedText>
          </Pressable>

          {/* Tlačítko Ladička */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setShowTunerModal(true)}
          >
            <SymbolView
              name={{ ios: 'tuningfork', android: 'graphic_eq', web: 'graphic_eq' }}
              tintColor={showTunerModal ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: showTunerModal ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.tuner')}
            </ThemedText>
          </Pressable>

          {/* Tlačítko Nastavení */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('settings')}
          >
            <SymbolView
              name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              tintColor={manageBandTab === 'settings' ? theme.text : theme.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'settings' ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 2 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('nav.settings')}
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 5: Všechny ostatní stránky (Domů, Zpěvník, Pokladna) -> Standardní lišta
    return (
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.backgroundElement,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
            paddingBottom: Math.max(insets.bottom, 8),
          }
        ]}
      >
        {props.state.routes.map((route: any, index: number) => {
          const { options } = props.descriptors[route.key];

          if (options.href === null) return null;

          const isFocused = props.state.index === index;
          const color = isFocused ? theme.text : theme.textSecondary;

          const onPress = () => {
            const event = props.navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              props.navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPress={onPress}
            >
              {options.tabBarIcon ? (
                options.tabBarIcon({ color })
              ) : null}
              <ThemedText
              type="smallBold"
              style={{ color, fontSize: 11, marginTop: 3 , textAlign: 'center', lineHeight: 12}}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
                {options.title || route.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <>
    <Tabs
      tabBar={renderCustomTabBar}
      screenOptions={{
        headerShown: false,
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          title: t('nav.events'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="repertoire"
        options={{
          title: t('nav.repertoire'),
          href: activeRoleView === 'fan' ? null : '/repertoire',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'music.note.list', android: 'library_music', web: 'library_music' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="treasury"
        options={{
          title: t('nav.treasury'),
          href: activeRoleView === 'fan' ? null : '/treasury',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'banknote.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' }} tintColor={color} size={24} />
          ),
        }}
      />

            <Tabs.Screen
        name="gallery"
        options={{
          title: t('nav.gallery') || 'Fotogalerie',
          href: '/gallery' as any,
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="manage-band"
        options={{
          title: t('nav.band'),
          href: '/manage-band',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'music.note.house.fill', android: 'domain', web: 'domain' }} tintColor={color} size={24} />
          ),
        }}
      />

    </Tabs>

    {showTunerModal && (
      <TunerModal
        visible={showTunerModal}
        onClose={() => setShowTunerModal(false)}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});