import React from 'react';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useColorScheme, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import { ThemedText } from './themed-text';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];
  const insets = useSafeAreaInsets();

  // Stav role uživatele a aktivní pod-záložky pro správu kapely, akce, zpěvník a pokladnu
  const { activeRoleView, manageBandTab, setManageBandTab, eventsTab, setEventsTab, repertoireTab, setRepertoireTab, treasuryTab, setTreasuryTab } = useAppStore();

  const renderCustomTabBar = (props: any) => {
    const currentRoute = props.state.routes[props.state.index].name;

    // SCÉNÁR 1: Stránka Akce ("events") -> Domů, Koncerty, Zkoušky, Poptávky, Rezervace, Absence
    if (currentRoute === 'events') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.backgroundElement,
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
              tintColor={colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Domů
            </ThemedText>
          </Pressable>

          {/* Koncerty */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('koncerty')}
          >
            <SymbolView
              name={{ ios: 'music.mic', android: 'confirmation_number', web: 'confirmation_number' }}
              tintColor={eventsTab === 'koncerty' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'koncerty' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Koncerty
            </ThemedText>
          </Pressable>

          {/* Zkoušky */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('zkousky')}
          >
            <SymbolView
              name={{ ios: 'calendar', android: 'event', web: 'event' }}
              tintColor={eventsTab === 'zkousky' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'zkousky' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Zkoušky
            </ThemedText>
          </Pressable>

          {/* Poptávky */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('poptavky')}
          >
            <SymbolView
              name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              tintColor={eventsTab === 'poptavky' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'poptavky' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Poptávky
            </ThemedText>
          </Pressable>

          {/* Rezervace */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('rezervace')}
          >
            <SymbolView
              name={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }}
              tintColor={eventsTab === 'rezervace' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'rezervace' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Rezervace
            </ThemedText>
          </Pressable>

          {/* Absence */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setEventsTab('absence')}
          >
            <SymbolView
              name={{ ios: 'person.crop.circle.badge.xmark', android: 'event_busy', web: 'event_busy' }}
              tintColor={eventsTab === 'absence' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: eventsTab === 'absence' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Absence
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
              backgroundColor: colors.background,
              borderTopColor: colors.backgroundElement,
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
              tintColor={colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Domů
            </ThemedText>
          </Pressable>

          {/* Naše písně */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setRepertoireTab('nase_pisne')}
          >
            <SymbolView
              name={{ ios: 'music.note.list', android: 'library_music', web: 'library_music' }}
              tintColor={repertoireTab === 'nase_pisne' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: repertoireTab === 'nase_pisne' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Naše písně
            </ThemedText>
          </Pressable>

          {/* Zpěvník + */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setRepertoireTab('zpevnik_plus')}
          >
            <SymbolView
              name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
              tintColor={repertoireTab === 'zpevnik_plus' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: repertoireTab === 'zpevnik_plus' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Zpěvník +
            </ThemedText>
          </Pressable>

          {/* Audio zápisník */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setRepertoireTab('audio_zapisnik')}
          >
            <SymbolView
              name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              tintColor={repertoireTab === 'audio_zapisnik' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: repertoireTab === 'audio_zapisnik' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Audio zápisník
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
              backgroundColor: colors.background,
              borderTopColor: colors.backgroundElement,
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
              tintColor={colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Domů
            </ThemedText>
          </Pressable>

          {/* Příjem */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('prijem')}
          >
            <SymbolView
              name={{ ios: 'arrow.down.circle.fill', android: 'add_circle', web: 'add_circle' }}
              tintColor={treasuryTab === 'prijem' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'prijem' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Příjem
            </ThemedText>
          </Pressable>

          {/* Výdej */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('vydej')}
          >
            <SymbolView
              name={{ ios: 'arrow.up.circle.fill', android: 'remove_circle', web: 'remove_circle' }}
              tintColor={treasuryTab === 'vydej' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'vydej' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Výdej
            </ThemedText>
          </Pressable>

          {/* Doklady */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('doklady')}
          >
            <SymbolView
              name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }}
              tintColor={treasuryTab === 'doklady' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'doklady' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Doklady
            </ThemedText>
          </Pressable>

          {/* Kniha jízd */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setTreasuryTab('kniha_jizd')}
          >
            <SymbolView
              name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
              tintColor={treasuryTab === 'kniha_jizd' ? colors.text : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="smallBold"
              style={{ color: treasuryTab === 'kniha_jizd' ? colors.text : colors.textSecondary, fontSize: 10, marginTop: 2 }}
              numberOfLines={1}
            >
              Kniha jízd
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 2: Stránka Kapela ("manage-band") -> Zobrazujeme ikony Domů, Profil, Členové
    if (currentRoute === 'manage-band') {
      return (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.backgroundElement,
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
              tintColor={colors.textSecondary}
              size={24}
            />
            <ThemedText
              type="smallBold"
              style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}
            >
              Domů
            </ThemedText>
          </Pressable>

          {/* Tlačítko Profil */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('band')}
          >
            <SymbolView
              name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              tintColor={manageBandTab === 'band' ? colors.text : colors.textSecondary}
              size={24}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'band' ? colors.text : colors.textSecondary, fontSize: 11, marginTop: 3 }}
            >
              Profil
            </ThemedText>
          </Pressable>

          {/* Tlačítko Členové */}
          <Pressable
            style={styles.tabItem}
            onPress={() => setManageBandTab('members')}
          >
            <SymbolView
              name={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
              tintColor={manageBandTab === 'members' ? colors.text : colors.textSecondary}
              size={24}
            />
            <ThemedText
              type="smallBold"
              style={{ color: manageBandTab === 'members' ? colors.text : colors.textSecondary, fontSize: 11, marginTop: 3 }}
            >
              Členové
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // SCÉNÁŘ 3: Všechny ostatní stránky (Domů, Zpěvník, Pokladna) -> Standardní lišta
    return (
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.backgroundElement,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
            paddingBottom: Math.max(insets.bottom, 8),
          }
        ]}
      >
        {props.state.routes.map((route: any, index: number) => {
          const { options } = props.descriptors[route.key];

          // Pokud má route 'href: null', nezobrazujeme v liště
          if (options.href === null) return null;

          const isFocused = props.state.index === index;
          const color = isFocused ? colors.text : colors.textSecondary;

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
                style={{ color, fontSize: 11, marginTop: 3 }}
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
    <Tabs
      tabBar={renderCustomTabBar}
      screenOptions={{
        headerShown: false,
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: 'Domů',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          title: 'Akce',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="repertoire"
        options={{
          title: 'Zpěvník',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'music.note.list', android: 'library_music', web: 'library_music' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="treasury"
        options={{
          title: 'Pokladna',
          href: activeRoleView === 'fan' ? null : '/treasury', // Schová tab pro fanoušky
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'banknote.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' }} tintColor={color} size={24} />
          ),
        }}
      />

      <Tabs.Screen
        name="manage-band"
        options={{
          title: 'Kapela',
          href: activeRoleView === 'admin' ? '/manage-band' : null, // Zobrazí pouze pro kapelníka/admina
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={color} size={24} />
          ),
        }}
      />

    </Tabs>
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