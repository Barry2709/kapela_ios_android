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

  // Aktivní podzáložka na stránce Správa kapely ('band' | 'members')
  manageBandTab: 'band' | 'members';
  setManageBandTab: (tab: 'band' | 'members') => void;

  // Aktivní podzáložka na stránce Akce ('koncerty' | 'zkousky' | 'poptavky' | 'rezervace' | 'absence')
  eventsTab: 'koncerty' | 'zkousky' | 'poptavky' | 'rezervace' | 'absence';
  setEventsTab: (tab: 'koncerty' | 'zkousky' | 'poptavky' | 'rezervace' | 'absence') => void;

  // Aktivní podzáložka na stránce Zpěvník ('nase_pisne' | 'zpevnik_plus' | 'audio_zapisnik')
  repertoireTab: 'nase_pisne' | 'zpevnik_plus' | 'audio_zapisnik';
  setRepertoireTab: (tab: 'nase_pisne' | 'zpevnik_plus' | 'audio_zapisnik') => void;

  // Aktivní podzáložka na stránce Pokladna ('prijem' | 'vydej' | 'doklady' | 'kniha_jizd')
  treasuryTab: 'prijem' | 'vydej' | 'doklady' | 'kniha_jizd';
  setTreasuryTab: (tab: 'prijem' | 'vydej' | 'doklady' | 'kniha_jizd') => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  activeBand: {
    id: 'naplech-demo',
    name: 'Naplech',
    genre: 'Country / Rock',
    description: 'Kapela Naplech - demo profil'
  }, // Zatím hardcodováno pro ukázku
  setActiveBand: (band) => set({ activeBand: band }),

  activeRoleView: 'admin', // Výchozí pohled je Kapelník (Admin)
  setActiveRoleView: (role) => set({ activeRoleView: role }),

  manageBandTab: 'band',
  setManageBandTab: (tab) => set({ manageBandTab: tab }),

  eventsTab: 'koncerty',
  setEventsTab: (tab) => set({ eventsTab: tab }),

  repertoireTab: 'nase_pisne',
  setRepertoireTab: (tab) => set({ repertoireTab: tab }),

  treasuryTab: 'prijem',
  setTreasuryTab: (tab) => set({ treasuryTab: tab }),
}));
