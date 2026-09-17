// Role uživatele v kapele
export type Role = 'admin' | 'member' | 'fan';

export interface Band {
  id: string;
  name: string;
  logoUri?: string;
  genre?: string;
  description?: string;
  web?: string; // Odkaz na web kapely
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bandId?: string;
  role: Role;
  memberId?: string; // Odkaz na konkrétní profil člena, pokud je role 'member'
}

export interface TechSpecs {
  mic: boolean;
  xlr: boolean;
  comboXlr: boolean;
  jack: boolean;
  comboJack: boolean;
  monitor: boolean;
  wirelessMonitor: boolean;
  power230V: boolean;
  pedalboard: boolean;
}

export interface BandMember {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  instrument: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  isActive?: boolean; // Zda je člen aktivní (true) nebo neaktivní (false)
  photoUri?: string | null;
  password?: string;
  isGuest?: boolean; // Zda je to stálý člen (false) nebo host (true)
  isAdmin?: boolean; // Zda má členský účet admin práva
  tech: TechSpecs;
}

export interface Concert {
  id: string;
  bandId: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  soundCheckTime?: string;
  notes?: string;
  isPublic: boolean;
  attendees: Record<string, 'yes' | 'no' | 'maybe'>;
}

export interface Rehearsal {
  id: string;
  bandId: string;
  date: string;
  time: string;
  location: string;
  notes?: string;
  attendees: Record<string, 'yes' | 'no' | 'maybe'>;
}

export interface Song {
  id: string;
  bandId: string;
  title: string;
  artist?: string;
  lyrics?: string;
  tempo?: string;
  duration?: string;
}

export interface Transaction {
  id: string;
  bandId: string;
  description: string;
  amount: number;
  timestamp: number;
  type: 'in' | 'out';
}
