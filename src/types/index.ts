import { PersonalNote } from '@/utils/personalSongSettings';

// Role uživatele v kapele
export type Role = 'admin' | 'member' | 'fan';

export interface StageplanMember {
  memberId: string;
  x: number; // Procentuální pozice (0-100) pro responzivitu
  y: number; // Procentuální pozice (0-100) pro responzivitu
}

export interface Band {
  id: string;
  name: string;
  logoUri?: string;
  genre?: string;
  description?: string;
  web?: string; // Odkaz na web kapely
  facebook?: string; // Odkaz na Facebook
  instagram?: string; // Odkaz na Instagram
  techRiderPresets?: string[]; // Předvolby pro technický rider
  whatToTakePresets?: string[]; // Předvolby pro co vzít s sebou
  stageplan?: StageplanMember[]; // Rozmístění členů na stage
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
  customTech?: Record<string, boolean>; // Dynamické štítky z nastavení tech rideru
  mic?: boolean;
  instrumentMic?: boolean;
  xlr?: boolean;
  comboXlr?: boolean;
  jack?: boolean;
  comboJack?: boolean;
  monitor?: boolean;
  wirelessMonitor?: boolean;
  power230V?: boolean;
  pedalboard?: boolean;
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
  pushToken?: string; // Expo Push Token pro doručování notifikací
  tech: TechSpecs;
}

export type AttendanceStatus = 'yes' | 'no' | 'maybe';

export interface AttendanceRecord {
  status: AttendanceStatus;
  note?: string;
  updatedAt?: number;
}

export interface Concert {
  id: string;
  bandId: string;
  title: string;
  isPrivate?: boolean; // Soukromá akce
  isCancelled?: boolean; // Zrušená akce
  date: string; // Datum YYYY-MM-DD nebo DD.MM.YYYY
  startTime: string; // Začátek (HH:MM)
  endTime?: string; // Konec (HH:MM)
  location: string; // Místo konání
  price?: string; // Cena / Honorář (např. 15 000 Kč)
  departureTime?: string; // Čas odjezdu
  departureLocation?: string; // Místo odjezdu
  soundCheckFrom?: string; // Zvukovka od
  soundCheckTo?: string; // Zvukovka do
  contacts?: string; // Kontakty na pořadatele
  whatToTake?: string[]; // Dynamické položky co vzít s sebou (např. ["Banner", "Merch"])
  notes?: string;
  attendees?: Record<string, AttendanceStatus | AttendanceRecord>;
  setlist?: string[]; // IDs skladeb v setlistu
  createdAt?: number;
}

export interface Rehearsal {
  id: string;
  bandId: string;
  date: string; // Formát YYYY-MM-DD nebo DD.MM.YYYY
  time: string; // Např. 18:00
  location: string; // Např. Zkušebna
  whatToPrepare?: string; // Co připravit (místo poznámky)
  attendees?: Record<string, AttendanceStatus | AttendanceRecord>;
  isCancelled?: boolean;
  createdAt?: number;
}

export interface Inquiry {
  id: string;
  bandId: string;
  title: string; // Název akce (povinné)
  eventType: string; // Druh akce (Festival, Zábava, Country bál, Městská akce, Soukromá, Jiné)
  location: string; // Místo konání (povinné)
  date: string; // Datum DD.MM.YYYY (povinné)
  startTime: string; // Čas od (povinné)
  endTime: string; // Čas do (povinné)
  phone?: string; // Telefon
  email?: string; // E-mail
  offeredPrice?: string; // Nabízená cena
  notes?: string; // Poznámka
  createdByUid?: string; // UID uživatele který poptávku vytvořil
  status?: 'pending' | 'accepted' | 'declined';
  attendees?: Record<string, AttendanceStatus | AttendanceRecord>;
  createdAt?: number;
}

export interface Absence {
  id: string;
  bandId: string;
  memberId: string;
  memberName: string;
  dateFrom: string; // DD.MM.YYYY
  dateTo: string; // DD.MM.YYYY
  reason: string; // Důvod (Dovolená, Nemoc, ...)
  note?: string;
  createdAt?: number;
}

export interface Song {
  id: string;
  bandId: string;
  title: string;
  artist?: string;
  lyrics?: string; // Text písně / Akordy
  tempo?: string; // BPM / Tempo
  timeSignature?: '4/4' | '3/4'; // Takt (4/4 nebo 3/4)
  duration?: string; // Délka
  key?: string; // Tónina (např. C dur)
  isLive?: boolean; // true = Hrajeme (v aktivním repertoáru), false = Nehrajeme
  isPreferred?: boolean; // true = Preferovaná píseň (žluté srdíčko)
  isFirst?: boolean; // Hodí se jako první (Otvírák)
  isLast?: boolean; // Hodí se jako poslední (Zavírák / Finále)
  isEncore?: boolean; // Hodí se jako přídavek
  singers?: string[]; // Seznam ID nebo jmen členů kapely, kteří v písni zpívají
  fileUri?: string; // Odkaz na soubor
  fileName?: string; // Název přiloženého souboru
  fileSource?: 'local' | 'gdrive' | 'icloud'; // Zdroj souboru
  adminNotes?: PersonalNote[]; // Poznámky správy kapely (Admin) sdílené všem členům
  createdAt?: number;
}

export interface Transaction {
  id: string;
  bandId: string;
  description: string;
  amount: number;
  timestamp: number;
  type: 'in' | 'out';
  receiptUrl?: string;
  receiptPath?: string;
}

export interface Vehicle {
  id: string;
  bandId: string;
  model: string; // Model vozidla (např. Octavia Combi)
  owner: string; // Majitel (např. Jan Novák)
  plate: string; // SPZ (např. 1U2 3456)
  fuel: 'benzin' | 'nafta' | 'elektro'; // Palivo
  consumption: string; // Spotřeba (např. 6.5)
  hasTowBar: boolean; // Tažné zařízení
  seats: number; // Max počet míst (např. 5)
  createdAt?: number;
}

export interface Ride {
  id: string;
  bandId: string;
  vehicleId: string;
  vehicleModel: string;
  driverName: string;
  destination: string; // Místo / Akce (např. Koncert Klášterec)
  distanceKm: number; // Počet km (tam a zpět)
  fuelPrice: number; // Cena paliva Kč/l nebo Kč/kWh
  totalCost: number; // Vypočítané náklady v Kč
  date: string; // Datum
  timestamp: number;
  addedToTreasury?: boolean;
}

export interface LiveSessionPayload {
  bandId: string;
  activeSongId: string;
  adminUid: string;
  adminName?: string;
  isActive: boolean;
  updatedAt: number;
  transpose?: number;
  deviceId?: string; // Unikátní ID zařízení pro rozlišení Master/Slave na stejných účtech
}

export interface AudioRecord {
  id: string;
  bandId: string;
  title: string;
  durationMillis?: number; // Délka v milisekundách
  downloadUrl: string; // URL z Firebase Storage
  storagePath: string; // Cesta k souboru ve Storage
  createdAt: number;
  isPublic?: boolean; // Zda je nahrávka přístupná fanouškům
}
