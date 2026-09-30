import { create } from 'zustand';
import { Band, UserProfile, Role } from '../types';

interface AppState {
  // Aktuální uživatel
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;

  // Aktivní kapela
  activeBand: Band | null;
  setActiveBand: (band: Band | null) => void;

  // Nastavení role pro účely testování UI (přepínání pohledů)
  activeRoleView: Role;
  setActiveRoleView: (role: Role) => void;

  // Aktivní podzáložka na stránce Správa kapely ('band' | 'members' | 'tech' | 'settings')
  manageBandTab: 'band' | 'members' | 'tech' | 'settings';
  setManageBandTab: (tab: 'band' | 'members' | 'tech' | 'settings') => void;

  // Aktivní podzáložka na stránce Akce ('akce' | 'poptavky' | 'rezervace' | 'absence')
  eventsTab: 'akce' | 'poptavky' | 'rezervace' | 'absence';
  setEventsTab: (tab: 'akce' | 'poptavky' | 'rezervace' | 'absence') => void;

  // Aktivní podzáložka na stránce Zpěvník ('nase_pisne' | 'zpevnik_plus' | 'audio_zapisnik')
  repertoireTab: 'nase_pisne' | 'zpevnik_plus' | 'audio_zapisnik';
  setRepertoireTab: (tab: 'nase_pisne' | 'zpevnik_plus' | 'audio_zapisnik') => void;

  // Aktivní podzáložka na stránce Pokladna ('prijem' | 'vydej' | 'doklady' | 'kniha_jizd')
  treasuryTab: 'overview' | 'prijem' | 'vydej' | 'doklady' | 'kniha_jizd';
  setTreasuryTab: (tab: 'overview' | 'prijem' | 'vydej' | 'doklady' | 'kniha_jizd') => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  activeBand: {
    id: 'naplech',
    name: 'Naplech',
    genre: 'Country / Rock',
    description: 'Kapela Naplech'
  }, // Zatím hardcodováno pro ukázku
  setActiveBand: (band) => set({ activeBand: band }),

  activeRoleView: 'admin', // Výchozí pohled je Kapelník (Admin)
  setActiveRoleView: (role) => set({ activeRoleView: role }),

  manageBandTab: 'band',
  setManageBandTab: (tab) => set({ manageBandTab: tab }),

  eventsTab: 'akce',
  setEventsTab: (tab) => set({ eventsTab: tab }),

  repertoireTab: 'nase_pisne',
  setRepertoireTab: (tab) => set({ repertoireTab: tab }),

  treasuryTab: 'overview',
  setTreasuryTab: (tab) => set({ treasuryTab: tab }),
}));
