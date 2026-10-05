import 'expo-blob';
import { collection, doc, setDoc, getDoc, getDocs, addDoc, deleteDoc, updateDoc, onSnapshot, getDocFromCache, getDocsFromCache, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { Band, BandMember, Rehearsal, Concert, Inquiry, Song, Absence, LiveSessionPayload, Transaction, Vehicle, Ride } from '@/types';
import { fixCzechDiacritics, capitalizeFirstLetter } from '@/utils/diacritics';
import { sendExpoPushNotifications } from './notificationService';

const BANDS_COLLECTION = 'kapela_ios_android';

// --- POMOCNÉ FUNKCE PRO NAHRÁVÁNÍ OBRÁZKŮ ---
export const uploadImageToStorage = async (uri: string, path: string): Promise<string> => {
  try {
    if (uri.startsWith('http')) return uri;

    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error("Chyba při nahrávání obrázku:", error);
    throw error;
  }
};

// Zkopíruje obrázek ze staré cesty na novou tím, že ho stáhne jako blob a znova nahraje
const copyStorageFile = async (oldUrl: string, newPath: string): Promise<string> => {
  try {
    if (!oldUrl || oldUrl === '') return '';

    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", oldUrl, true);
      xhr.send(null);
    });

    const newStorageRef = ref(storage, newPath);
    await uploadBytes(newStorageRef, blob);
    return await getDownloadURL(newStorageRef);
  } catch (error) {
    console.error(`Chyba při kopírování souboru na ${newPath}:`, error);
    return oldUrl; // Fallback: Ponecháme starou URL, pokud kopie selže
  }
};

// Pokusí se smazat původní soubor ze Storage pomocí jeho URL adresy
const deleteStorageFile = async (url: string): Promise<void> => {
  try {
    if (!url || url === '') return;
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (e) {
    console.log("Nelze smazat starý soubor (možná už neexistuje):", e);
  }
};

// --- KAPELY ---

export const createBand = async (
  name: string,
  genre: string,
  web: string,
  adminPasswordHash: string,
  logoUri: string | null
): Promise<Band> => {
  const bandId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  let finalLogoUrl = '';
  if (logoUri) {
    const filename = `logo_${Date.now()}.jpg`;
    finalLogoUrl = await uploadImageToStorage(logoUri, `${BANDS_COLLECTION}/${bandId}/${filename}`);
  }

  const newBand = {
    id: bandId,
    name,
    genre,
    web,
    logoUri: finalLogoUrl,
    adminPassword: adminPasswordHash,
    createdAt: Date.now()
  };

  await setDoc(doc(db, BANDS_COLLECTION, bandId), newBand);
  return newBand;
};

// Úprava existující kapely (s podporou přejmenování a migrace struktury)
export const updateBand = async (bandId: string, updates: Partial<Band>): Promise<Band> => {
  const newName = updates.name;
  let newBandId = bandId;

  if (newName) {
    newBandId = newName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  // 1. Změnil se název natolik, že se mění i ID kapely (požadavek na přesun)
  if (newBandId !== bandId) {
    // A) Hlídej, zda už kapela není založena
    const existingDoc = await getDoc(doc(db, BANDS_COLLECTION, newBandId));
    if (existingDoc.exists()) {
      throw new Error('Kapela s tímto názvem již existuje.');
    }

    const oldBandDoc = await getDoc(doc(db, BANDS_COLLECTION, bandId));
    if (!oldBandDoc.exists()) throw new Error('Původní kapela nenalezena.');
    const oldBandData = oldBandDoc.data() as Band;

    let finalLogoUrl = oldBandData.logoUri;
    let oldLogoUrlToDelete = null;

    // 1) Bylo vloženo úplně NOVÉ logo z telefonu, nahrajeme ho
    if (updates.logoUri && !updates.logoUri.startsWith('http')) {
      const filename = `logo_${Date.now()}.jpg`;
      finalLogoUrl = await uploadImageToStorage(updates.logoUri, `${BANDS_COLLECTION}/${newBandId}/${filename}`);
      if (oldBandData.logoUri) oldLogoUrlToDelete = oldBandData.logoUri;
    }
    // 2) Logo nebylo změněno, ale měníme název kapely -> FYZICKY jej stáhneme a přesuneme do nové složky
    else if (oldBandData.logoUri && oldBandData.logoUri !== '') {
      const filename = `logo_${Date.now()}.jpg`;
      finalLogoUrl = await copyStorageFile(oldBandData.logoUri, `${BANDS_COLLECTION}/${newBandId}/${filename}`);
      oldLogoUrlToDelete = oldBandData.logoUri;
    }
    // 3) Logo bylo explicitně smazáno
    else if (updates.logoUri === '') {
      finalLogoUrl = '';
      if (oldBandData.logoUri) oldLogoUrlToDelete = oldBandData.logoUri;
    }

    const newBandData = { ...oldBandData, ...updates, id: newBandId, logoUri: finalLogoUrl || '' };

    // B) Přepis na firebase - Vytvoříme novou kapelu v databázi
    await setDoc(doc(db, BANDS_COLLECTION, newBandId), newBandData);

    // C) Migrace členů (Zkopírovat, přesunout jejich fotky do nové složky a původní smazat)
    const membersCol = collection(db, BANDS_COLLECTION, bandId, 'members');
    const membersSnap = await getDocs(membersCol);
    const newMembersCol = collection(db, BANDS_COLLECTION, newBandId, 'members');

    for (const memberDoc of membersSnap.docs) {
      const mData = memberDoc.data() as BandMember;

      let finalMemberPhotoUrl = mData.photoUri;
      if (mData.photoUri && mData.photoUri !== '') {
        const filename = `photo_${memberDoc.id}_${Date.now()}.jpg`;
        finalMemberPhotoUrl = await copyStorageFile(mData.photoUri, `${BANDS_COLLECTION}/${newBandId}/members/${filename}`);
        await deleteStorageFile(mData.photoUri); // Smazání fotky ze staré složky
      }

      await setDoc(doc(newMembersCol, memberDoc.id), { ...mData, photoUri: finalMemberPhotoUrl || null });
      await deleteDoc(doc(membersCol, memberDoc.id)); // Smažeme starého člena
    }

    // D) Migrace písní / repertoáru
    const songsCol = collection(db, BANDS_COLLECTION, bandId, 'songs');
    const songsSnap = await getDocs(songsCol);
    const newSongsCol = collection(db, BANDS_COLLECTION, newBandId, 'songs');

    for (const songDoc of songsSnap.docs) {
      const sData = songDoc.data() as Song;
      await setDoc(doc(newSongsCol, songDoc.id), { ...sData, bandId: newBandId });
      await deleteDoc(doc(songsCol, songDoc.id));
    }

    // E) Migrace ostatních subkolekcí (zkoušky, koncerty, poptávky, fanoušci)
    const subcols = ['rehearsals', 'concerts', 'inquiries', 'fans'];
    for (const sub of subcols) {
      const oldCol = collection(db, BANDS_COLLECTION, bandId, sub);
      const oldSnap = await getDocs(oldCol);
      const newCol = collection(db, BANDS_COLLECTION, newBandId, sub);
      for (const d of oldSnap.docs) {
        await setDoc(doc(newCol, d.id), { ...d.data(), bandId: newBandId });
        await deleteDoc(doc(oldCol, d.id));
      }
    }

    // F) Smažeme staré logo a nakonec starý dokument kapely
    if (oldLogoUrlToDelete) {
      await deleteStorageFile(oldLogoUrlToDelete);
    }
    await deleteDoc(doc(db, BANDS_COLLECTION, bandId));

    return newBandData as Band;
  }

  // === SCÉNÁŘ B: NÁZEV SE NEMĚNÍ ===
  let finalLogoUrl = updates.logoUri;
  if (updates.logoUri && !updates.logoUri.startsWith('http')) {
    const filename = `logo_${Date.now()}.jpg`;
    finalLogoUrl = await uploadImageToStorage(updates.logoUri, `${BANDS_COLLECTION}/${bandId}/${filename}`);
  }

  const finalUpdates = { ...updates };
  if (finalLogoUrl !== undefined) finalUpdates.logoUri = finalLogoUrl;

  const bandRef = doc(db, BANDS_COLLECTION, bandId);
  await setDoc(bandRef, finalUpdates, { merge: true });

  const updatedBandDoc = await getDoc(bandRef);
  return updatedBandDoc.data() as Band;
};

export const getBands = async (): Promise<Band[]> => {
  const bandsCol = collection(db, BANDS_COLLECTION);
  const snapshot = await getDocs(bandsCol);

  return snapshot.docs.map(doc => {
    return {
      id: doc.id,
      ...doc.data()
    } as Band;
  });
};

export const getBandById = async (bandId: string): Promise<Band | null> => {
  if (!bandId) return null;
  const docRef = doc(db, BANDS_COLLECTION, bandId);
  try {
    const bandDoc = await getDoc(docRef);
    if (bandDoc.exists()) {
      return { id: bandDoc.id, ...bandDoc.data() } as Band;
    }
    return null;
  } catch (e: any) {
    try {
      const cachedDoc = await getDocFromCache(docRef);
      if (cachedDoc.exists()) {
        return { id: cachedDoc.id, ...cachedDoc.data() } as Band;
      }
    } catch (_) {}
    console.log("Detail kapely načten z vyrovnávací paměti (offline):", e?.message || e);
    return null;
  }
};

export const subscribeToBand = (
  bandId: string,
  callback: (band: Band | null) => void
): (() => void) => {
  if (!bandId) return () => {};
  const docRef = doc(db, BANDS_COLLECTION, bandId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Band);
    } else {
      callback(null);
    }
  }, (error) => {
    console.log("Chyba při odebírání detailu kapely:", error);
  });
};

export const subscribeToRehearsals = (
  bandId: string,
  callback: (rehearsals: Rehearsal[]) => void
): (() => void) => {
  if (!bandId) return () => {};
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'rehearsals');
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Rehearsal));
    callback(data);
  }, (error) => {
    console.log("Chyba při odebírání zkoušek:", error);
  });
};

export const subscribeToConcerts = (
  bandId: string,
  callback: (concerts: Concert[]) => void
): (() => void) => {
  if (!bandId) return () => {};
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'concerts');
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Concert));
    callback(data);
  }, (error) => {
    console.log("Chyba při odebírání koncertů:", error);
  });
};

export const subscribeToInquiries = (
  bandId: string,
  callback: (inquiries: Inquiry[]) => void
): (() => void) => {
  if (!bandId) return () => {};
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'inquiries');
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Inquiry));
    callback(data);
  }, (error) => {
    console.log("Chyba při odebírání poptávek:", error);
  });
};

// --- ČLENOVÉ KAPELY ---

export const getBandMembers = async (bandId: string): Promise<BandMember[]> => {
  if (!bandId) return [];
  const membersCol = collection(db, BANDS_COLLECTION, bandId, 'members');
  try {
    const snapshot = await getDocs(membersCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BandMember));
  } catch (e: any) {
    try {
      const cachedSnap = await getDocsFromCache(membersCol);
      return cachedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BandMember));
    } catch (_) {}
    console.log("Členové kapely načteni z vyrovnávací paměti (offline):", e?.message || e);
    return [];
  }
};

export const addBandMember = async (bandId: string, member: Omit<BandMember, 'id'>): Promise<string> => {
  const membersCol = collection(db, BANDS_COLLECTION, bandId, 'members');

  // Přidání do subkolekce "members" u konkrétní kapely (pro získání ID)
  const docRef = await addDoc(membersCol, member);

  let finalPhotoUrl = member.photoUri || null;
  if (member.photoUri && !member.photoUri.startsWith('http')) {
    const filename = `photo_${docRef.id}_${Date.now()}.jpg`;
    finalPhotoUrl = await uploadImageToStorage(member.photoUri, `${BANDS_COLLECTION}/${bandId}/members/${filename}`);
  }

  // Aktualizujeme ID dokumentu a novou URL fotky
  await setDoc(docRef, { ...member, id: docRef.id, photoUri: finalPhotoUrl });
  return docRef.id;
};

export const updateBandMember = async (bandId: string, memberId: string, updates: Partial<BandMember>): Promise<void> => {
  const memberRef = doc(db, BANDS_COLLECTION, bandId, 'members', memberId);

  if (updates.photoUri && !updates.photoUri.startsWith('http')) {
    const filename = `photo_${memberId}_${Date.now()}.jpg`;
    updates.photoUri = await uploadImageToStorage(updates.photoUri, `${BANDS_COLLECTION}/${bandId}/members/${filename}`);
  }

  await setDoc(memberRef, updates, { merge: true });
};

// --- OVĚŘOVÁNÍ ---

export const verifyMemberPassword = async (bandId: string, memberId: string, passwordAttempt: string): Promise<boolean> => {
  const memberDoc = await getDoc(doc(db, BANDS_COLLECTION, bandId, 'members', memberId));
  if (!memberDoc.exists()) return false;

  const data = memberDoc.data();
  return data.password === passwordAttempt;
};

// --- ZKOUŠKY KAPELY ---

export const getRehearsals = async (bandId: string): Promise<Rehearsal[]> => {
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'rehearsals');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Rehearsal));
  } catch (e) {
    console.error("Nepodařilo se načíst zkoušky:", e);
    return [];
  }
};

// Pomocná funkce pro odesílání Push notifikací aktivním členům kapely
const notifyActiveMembersAboutNewEvent = async (
  bandId: string,
  title: string,
  body: string,
  eventId: string,
  eventType: string
) => {
  try {
    const members = await getBandMembers(bandId);
    const targetTokens = members
      .filter(m => !m.isGuest && m.isActive !== false && m.pushToken && m.pushToken.trim().length > 0)
      .map(m => m.pushToken as string);

    if (targetTokens.length > 0) {
      sendExpoPushNotifications(targetTokens, title, body, { eventId, eventType });
    }
  } catch (err) {
    console.error("Chyba při odesílání push notifikace členům:", err);
  }
};

// Pomocná funkce pro odesílání Push notifikací adminům při změně docházky
export const notifyAdminsAboutAttendance = async (
  bandId: string,
  memberName: string,
  eventTitle: string,
  status: 'yes' | 'no' | 'pending',
  eventType: 'rehearsal' | 'concert' | 'inquiry',
  note?: string
) => {
  try {
    const members = await getBandMembers(bandId);
    const adminTokens = members
      .filter(m => (m.isAdmin || (m as any).role === 'admin') && m.pushToken && m.pushToken.trim().length > 0)
      .map(m => m.pushToken as string);

    if (adminTokens.length > 0) {
      const typeLabel = eventType === 'rehearsal' ? 'zkoušku' : (eventType === 'concert' ? 'koncert' : 'poptávku');
      const statusLabel = status === 'yes' ? '✅ potvrdil/a' : (status === 'no' ? '❌ odmítl/a' : '⚪ změnil/a');
      const noteText = note ? ` (Poznámka: ${note})` : '';
      const title = `Docházka: ${memberName}`;
      const body = `${memberName} ${statusLabel} účast na ${typeLabel}: ${eventTitle}${noteText}`;

      sendExpoPushNotifications(adminTokens, title, body, { type: 'attendance_update' });
    }
  } catch (err) {
    console.error("Chyba při odesílání push notifikace adminům:", err);
  }
};

export const addRehearsal = async (bandId: string, rehearsal: Omit<Rehearsal, 'id'>): Promise<string> => {
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'rehearsals');
  const docRef = await addDoc(colRef, {
    ...rehearsal,
    createdAt: Date.now(),
  });
  await setDoc(docRef, { id: docRef.id }, { merge: true });

  notifyActiveMembersAboutNewEvent(
    bandId,
    'Nová Zkouška',
    `Byla naplánována zkouška: ${rehearsal.date} v ${rehearsal.time || ''}`,
    docRef.id,
    'rehearsal'
  );

  return docRef.id;
};

export const updateRehearsal = async (bandId: string, rehearsalId: string, updates: Partial<Rehearsal>): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'rehearsals', rehearsalId);
  await setDoc(docRef, sanitizeFirestoreData(updates), { merge: true });
};

export const deleteRehearsal = async (bandId: string, rehearsalId: string): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'rehearsals', rehearsalId);
  await deleteDoc(docRef);
};

// --- KONCERTY KAPELY ---

export const getConcerts = async (bandId: string): Promise<Concert[]> => {
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'concerts');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Concert));
  } catch (e) {
    console.error("Nepodařilo se načíst koncerty:", e);
    return [];
  }
};

export const addConcert = async (bandId: string, concert: Omit<Concert, 'id'>): Promise<string> => {
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'concerts');
  const docRef = await addDoc(colRef, {
    ...concert,
    createdAt: Date.now(),
  });
  await setDoc(docRef, { id: docRef.id }, { merge: true });

  notifyActiveMembersAboutNewEvent(
    bandId,
    'Nový Koncert',
    `Byl přidán nový koncert: ${concert.title} (${concert.date})`,
    docRef.id,
    'concert'
  );

  return docRef.id;
};

export const updateConcert = async (bandId: string, concertId: string, updates: Partial<Concert>): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'concerts', concertId);
  await setDoc(docRef, sanitizeFirestoreData(updates), { merge: true });
};

export const deleteConcert = async (bandId: string, concertId: string): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'concerts', concertId);
  await deleteDoc(docRef);
};

// --- POPTÁVKY HRÁNÍ ---

export const getInquiries = async (bandId: string): Promise<Inquiry[]> => {
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'inquiries');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Inquiry));
  } catch (e) {
    console.error("Nepodařilo se načíst poptávky:", e);
    return [];
  }
};

export const addInquiry = async (bandId: string, inquiry: Omit<Inquiry, 'id'>): Promise<string> => {
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'inquiries');
  const docRef = await addDoc(colRef, {
    ...inquiry,
    createdAt: Date.now(),
  });
  await setDoc(docRef, { id: docRef.id }, { merge: true });

  notifyActiveMembersAboutNewEvent(
    bandId,
    'Nová Poptávka',
    `Byla vytvořena nová poptávka: ${inquiry.title} (${inquiry.date})`,
    docRef.id,
    'inquiry'
  );

  return docRef.id;
};

export const deleteInquiry = async (bandId: string, inquiryId: string): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'inquiries', inquiryId);
  await deleteDoc(docRef);
};

export const updateInquiryStatus = async (
  bandId: string,
  inquiryId: string,
  status: 'accepted' | 'declined' | 'pending',
  attendees?: Record<string, any>
): Promise<void> => {
  if (!bandId || !inquiryId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'inquiries', inquiryId);
  const updates: Record<string, any> = { status };
  if (attendees) updates.attendees = attendees;
  await setDoc(docRef, sanitizeFirestoreData(updates), { merge: true });
};

// --- POKLADNA & TRANSAKCE (TREASURY) ---

export const getTransactions = async (bandId: string): Promise<Transaction[]> => {
  if (!bandId) return [];
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'transactions');
    const snapshot = await getDocs(colRef);
    const data = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Transaction));
    data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return data;
  } catch (e) {
    console.error("Nepodařilo se načíst pokladnu:", e);
    return [];
  }
};

export const addTransaction = async (bandId: string, transaction: Omit<Transaction, 'id'>): Promise<string> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'transactions');
  const docRef = await addDoc(colRef, sanitizeFirestoreData({ ...transaction, timestamp: transaction.timestamp || Date.now() }));
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const updateTransaction = async (
  bandId: string,
  transactionId: string,
  transaction: Partial<Omit<Transaction, 'id'>>
): Promise<void> => {
  if (!bandId || !transactionId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'transactions', transactionId);
  await updateDoc(docRef, sanitizeFirestoreData(transaction));
};

export const deleteTransaction = async (bandId: string, transactionId: string, receiptPath?: string): Promise<void> => {
  if (!bandId || !transactionId) return;
  if (receiptPath) {
    try {
      const storageRef = ref(storage, receiptPath);
      await deleteObject(storageRef);
    } catch (e) {
      console.log("Nepodařilo se smazat doklad ze storage:", e);
    }
  }
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'transactions', transactionId);
  await deleteDoc(docRef);
};

export const deleteAllTransactions = async (bandId: string): Promise<void> => {
  if (!bandId) return;
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'transactions');
  const snapshot = await getDocs(colRef);
  const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(colRef, docSnap.id)));
  await Promise.all(deletePromises);
};

export const uploadReceiptToStorage = async (
  bandId: string,
  uri: string
): Promise<{ downloadUrl: string; storagePath: string }> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const fileName = `receipt_${Date.now()}.jpg`;
  const path = `${BANDS_COLLECTION}/${bandId}/receipts/${fileName}`;
  const downloadUrl = await uploadImageToStorage(uri, path);
  return {
    downloadUrl,
    storagePath: path,
  };
};

// --- VOZIDLA A KNIHA JÍZD (VEHICLES) ---

export const getVehicles = async (bandId: string): Promise<Vehicle[]> => {
  if (!bandId) return [];
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'vehicles');
    const snapshot = await getDocs(colRef);
    const data = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Vehicle));
    data.sort((a, b) => (a.model || '').localeCompare(b.model || ''));
    return data;
  } catch (e) {
    console.error("Nepodařilo se načíst vozidla:", e);
    return [];
  }
};

export const addVehicle = async (bandId: string, vehicle: Omit<Vehicle, 'id'>): Promise<string> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'vehicles');
  const docRef = await addDoc(colRef, sanitizeFirestoreData({ ...vehicle, createdAt: Date.now() }));
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const deleteVehicle = async (bandId: string, vehicleId: string): Promise<void> => {
  if (!bandId || !vehicleId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'vehicles', vehicleId);
  await deleteDoc(docRef);
};

// --- KNIHA JÍZD & CESTOVNÉ (RIDES) ---

export const getRides = async (bandId: string): Promise<Ride[]> => {
  if (!bandId) return [];
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'rides');
    const snapshot = await getDocs(colRef);
    const data = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Ride));
    data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return data;
  } catch (e) {
    console.error("Nepodařilo se načíst knihu jízd:", e);
    return [];
  }
};

export const addRide = async (bandId: string, ride: Omit<Ride, 'id'>): Promise<string> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'rides');
  const docRef = await addDoc(colRef, sanitizeFirestoreData({ ...ride, timestamp: ride.timestamp || Date.now() }));
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const updateRide = async (
  bandId: string,
  rideId: string,
  ride: Partial<Omit<Ride, 'id'>>
): Promise<void> => {
  if (!bandId || !rideId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'rides', rideId);
  await updateDoc(docRef, sanitizeFirestoreData(ride));
};

export const deleteRide = async (bandId: string, rideId: string): Promise<void> => {
  if (!bandId || !rideId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'rides', rideId);
  await deleteDoc(docRef);
};

// --- ABSENCE ČLENŮ ---

export const getAbsences = async (bandId: string): Promise<Absence[]> => {
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'absences');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Absence));
  } catch (e) {
    console.error("Nepodařilo se načíst absence:", e);
    return [];
  }
};

export const addAbsence = async (bandId: string, absence: Omit<Absence, 'id'>): Promise<string> => {
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'absences');
  const docRef = await addDoc(colRef, {
    ...absence,
    createdAt: Date.now(),
  });
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const deleteAbsence = async (bandId: string, absenceId: string): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'absences', absenceId);
  await deleteDoc(docRef);
};

// --- FANOUŠCI KAPELY (FANS) ---

export const saveFanToFirebase = async (bandId: string, fan: { uid?: string; email: string; displayName?: string }): Promise<void> => {
  if (!bandId || !fan.email) return;
  try {
    const fanId = fan.uid || fan.email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fanRef = doc(db, BANDS_COLLECTION, bandId, 'fans', fanId);
    await setDoc(fanRef, {
      id: fanId,
      bandId,
      email: fan.email,
      displayName: fan.displayName || fan.email.split('@')[0],
      lastSeenAt: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.error("Nepodařilo se uložit fanouška na Firebase:", e);
  }
};

export const getFans = async (bandId: string): Promise<any[]> => {
  try {
    const fansCol = collection(db, BANDS_COLLECTION, bandId, 'fans');
    const snapshot = await getDocs(fansCol);
    return snapshot.docs.map(docSnap => docSnap.data());
  } catch (e) {
    console.error("Nepodařilo se načíst fanoušky:", e);
    return [];
  }
};

// --- REPERTOÁR & PÍSNĚ (SONGS) ---

export const getSongs = async (bandId: string): Promise<Song[]> => {
  if (!bandId) return [];
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs');
    const snapshot = await getDocs(colRef);
    let songs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Song));

    // Pokud u aktivní kapely nejsou žádné písně, skenujeme stará/předchozí ID kapel a obnovíme je!
    if (songs.length === 0) {
      const fallbackBandIds = ['naplech-demo', 'naplech', 'kapela', 'naplech-koncerty'];
      for (const oldId of fallbackBandIds) {
        if (oldId !== bandId) {
          const oldColRef = collection(db, BANDS_COLLECTION, oldId, 'songs');
          const oldSnap = await getDocs(oldColRef);
          if (!oldSnap.empty) {
            console.log(`Automatická obnova zničeno/přesunutých skladeb z kapely "${oldId}" do "${bandId}"...`);
            for (const oldDoc of oldSnap.docs) {
              const songData = oldDoc.data() as Song;
              await setDoc(doc(colRef, oldDoc.id), sanitizeFirestoreData({ ...songData, bandId }));
            }
            const newSnap = await getDocs(colRef);
            songs = newSnap.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data(),
            } as Song));
            break;
          }
        }
      }
    }

    return songs;
  } catch (e) {
    console.error("Nepodařilo se načíst písně:", e);
    return [];
  }
};

// --- REPERTOÁR PLUS (SONGS PLUS) ---
export const getSongsPlus = async (bandId: string): Promise<Song[]> => {
  if (!bandId) return [];
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs_plus');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Song));
  } catch (e) {
    console.error("Nepodařilo se načíst písně plus:", e);
    return [];
  }
};

export const addSongPlus = async (bandId: string, songData: Omit<Song, 'id'>): Promise<string> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs_plus');
  const docRef = await addDoc(colRef, sanitizeFirestoreData({ ...songData, createdAt: Date.now() }));
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const updateSongPlus = async (bandId: string, songId: string, updates: Partial<Song>): Promise<void> => {
  if (!bandId || !songId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'songs_plus', songId);
  const safeUpdates = sanitizeFirestoreData({ ...updates, updatedAt: Date.now() });
  await setDoc(docRef, safeUpdates, { merge: true });
};

export const deleteSongPlus = async (bandId: string, songId: string): Promise<void> => {
  if (!bandId || !songId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'songs_plus', songId);
  await deleteDoc(docRef);
};

export const deleteAllSongsPlus = async (bandId: string): Promise<void> => {
  if (!bandId) return;
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs_plus');
  const snapshot = await getDocs(colRef);
  const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(colRef, docSnap.id)));
  await Promise.all(deletePromises);
};

// --- AUDIO ZÁZNAMNÍK (AUDIO RECORDS) ---
export const getAudioRecords = async (bandId: string): Promise<import('../types').AudioRecord[]> => {
  if (!bandId) return [];
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'audio_records');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as import('../types').AudioRecord));
  } catch (e) {
    console.error("Nepodařilo se načíst audio záznamy:", e);
    return [];
  }
};

export const subscribeToAudioRecords = (
  bandId: string,
  callback: (records: import('../types').AudioRecord[]) => void
) => {
  if (!bandId) return () => {};
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'audio_records');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as import('../types').AudioRecord));
    callback(records);
  }, (err) => {
    console.error("Chyba při živém naslouchání audio nahrávek:", err);
  });
};

export const addAudioRecord = async (bandId: string, recordData: Omit<import('../types').AudioRecord, 'id'>): Promise<string> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'audio_records');
  const docRef = await addDoc(colRef, sanitizeFirestoreData({ ...recordData, createdAt: Date.now() }));
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const updateAudioRecord = async (bandId: string, recordId: string, updates: Partial<import('../types').AudioRecord>): Promise<void> => {
  if (!bandId || !recordId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'audio_records', recordId);
  const safeUpdates = sanitizeFirestoreData({ ...updates, updatedAt: Date.now() });
  await setDoc(docRef, safeUpdates, { merge: true });
};

export const deleteAudioRecord = async (bandId: string, recordId: string, storagePath?: string): Promise<void> => {
  if (!bandId || !recordId) return;

  if (storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (e) {
      console.log("Nepodařilo se smazat soubor ze storage, možná už neexistuje:", e);
    }
  }

  const targetRef = doc(db, BANDS_COLLECTION, bandId, 'audio_records', recordId);
  await deleteDoc(targetRef);
};

export const getAudioStorageFilename = (title: string, extension: string = 'm4a'): string => {
  const safeTitle = title.trim().replace(/[/\\?%*:|"<>]/g, '_');
  const safeExt = extension.replace(/^\./, '');
  return `${safeTitle}_${Date.now()}.${safeExt}`;
};

export const uploadAudioToStorage = async (
  bandId: string,
  uri: string,
  title: string
): Promise<{ downloadUrl: string; storagePath: string }> => {
  if (!bandId) throw new Error("Chybí ID kapely.");
  const rawExt = uri.split('.').pop()?.split('?')[0] || 'm4a';
  const fileName = getAudioStorageFilename(title || 'Nahrávka', rawExt);

  // Ukládáme přesně do stejného adresáře kapely v kapela_ios_android kde jsou i songs a songs_plus:
  // cesta: kapela_ios_android/<bandId>/records/<fileName>
  const path = `${BANDS_COLLECTION}/${bandId}/records/${fileName}`;
  const storageRef = ref(storage, path);

  const blob: Blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      reject(new TypeError("Network request failed"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    downloadUrl,
    storagePath: path,
  };
};

export const validateAndCleanupAudioRecords = async (
  bandId: string,
  records: import('../types').AudioRecord[]
): Promise<import('../types').AudioRecord[]> => {
  const validRecords: import('../types').AudioRecord[] = [];

  for (const record of records) {
    if (!record.downloadUrl) {
      deleteAudioRecord(bandId, record.id);
      continue;
    }

    try {
      if (record.storagePath) {
        const storageRef = ref(storage, record.storagePath);
        await getDownloadURL(storageRef);
      }
      validRecords.push(record);
    } catch (err: any) {
      if (err?.code === 'storage/object-not-found' || err?.message?.includes('object-not-found')) {
        console.log(`Nahrávka ${record.title} neexistuje na Storage, odstraňuji z databáze Firestore.`);
        deleteAudioRecord(bandId, record.id);
      } else {
        validRecords.push(record);
      }
    }
  }
  return validRecords;
};

// --- FIREBASE STORAGE PRO TEXTY A SOUBORY PÍSNÍ ---

export const getSongStorageFilename = (title: string, fileName?: string): string => {
  if (fileName && fileName.trim().length > 0) {
    const clean = fileName.trim();
    if (clean.endsWith('.txt') || clean.endsWith('.pro') || clean.endsWith('.chordpro')) {
      return clean;
    }
    return `${clean}.txt`;
  }
  const safeTitle = title.trim().replace(/[/\\?%*:|"<>]/g, '_');
  return `${safeTitle}.txt`;
};

// 1. Nahraje UTF-8 text písně do Firebase Storage (cesta: kapela_ios_android/<bandId>/songs/<filename>.txt)
export const uploadSongTextToStorage = async (
  bandId: string,
  songTitle: string,
  lyrics: string,
  fileName?: string
): Promise<{ storageUrl: string; storageFilename: string }> => {
  if (!bandId) throw new Error("Chybí ID kapely.");

  const storageFilename = getSongStorageFilename(songTitle, fileName);
  const path = `${BANDS_COLLECTION}/${bandId}/songs/${storageFilename}`;
  const storageRef = ref(storage, path);

  const cleanLyrics = fixCzechDiacritics(lyrics || '');
  const blob = new Blob([cleanLyrics], { type: 'text/plain;charset=utf-8' });

  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    storageUrl: downloadUrl,
    storageFilename,
  };
};

export const uploadSongPlusTextToStorage = async (
  bandId: string,
  songTitle: string,
  lyrics: string,
  fileName?: string
): Promise<{ storageUrl: string; storageFilename: string }> => {
  if (!bandId) throw new Error("Chybí ID kapely.");

  const storageFilename = getSongStorageFilename(songTitle, fileName);
  const path = `${BANDS_COLLECTION}/${bandId}/songs_plus/${storageFilename}`;
  const storageRef = ref(storage, path);

  const cleanLyrics = fixCzechDiacritics(lyrics || '');
  const blob = new Blob([cleanLyrics], { type: 'text/plain;charset=utf-8' });

  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    storageUrl: downloadUrl,
    storageFilename,
  };
};

// 2. Načte nejnovější text písně přímo z Firebase Storage (s offline detekcí a navrácením objektu)
export const fetchSongTextFromStorage = async (
  bandId: string,
  song: Song
): Promise<{ text: string; isOffline: boolean }> => {
  let isOffline = false;

  try {
    if (song.fileUri && song.fileUri.startsWith('http')) {
      try {
        const resp = await fetch(song.fileUri);
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.trim().length > 0) {
            return { text: fixCzechDiacritics(text), isOffline: false };
          }
        }
      } catch (e) {
        console.log("Nelze stáhnout text z fileUri:", e);
        isOffline = true;
      }
    }

    if (bandId && song.title) {
      const storageFilename = getSongStorageFilename(song.title, song.fileName);
      const path = `${BANDS_COLLECTION}/${bandId}/songs/${storageFilename}`;
      const storageRef = ref(storage, path);
      try {
        const downloadUrl = await getDownloadURL(storageRef);
        if (downloadUrl) {
          const resp = await fetch(downloadUrl);
          if (resp.ok) {
            const text = await resp.text();
            if (text && text.trim().length > 0) {
              return { text: fixCzechDiacritics(text), isOffline: false };
            }
          }
        }
      } catch (storageErr: any) {
        // Pokud soubor ve Storage neexistuje, nejde o chybu offline, ale píseň má text pouze v databázi Firestore
        if (storageErr?.code === 'storage/object-not-found' || storageErr?.message?.includes('object-not-found')) {
          return { text: fixCzechDiacritics(song.lyrics || ''), isOffline: false };
        }
        console.log("Chyba při načítání ze Storage:", storageErr?.message || storageErr);
        isOffline = true;
      }
    }
  } catch (err) {
    console.log("Firebase Storage není dostupné / Offline, načítám z lokální paměti:", err);
    isOffline = true;
  }

  return {
    text: fixCzechDiacritics(song.lyrics || ''),
    isOffline,
  };
};

// Pomocná funkce odstraňující undefined hodnoty i z vnořených objektů (Firestore odmítá hodnoty undefined)
export const sanitizeFirestoreData = (obj: Record<string, any>): Record<string, any> => {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      clean[key] = sanitizeFirestoreData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

export const addSong = async (bandId: string, song: Omit<Song, 'id'>): Promise<string> => {
  if (!bandId) {
    throw new Error("Chybí ID kapely.");
  }

  const formattedTitle = capitalizeFirstLetter(song.title || '');
  let finalFileUri = song.fileUri || null;
  let finalFileName = song.fileName || getSongStorageFilename(formattedTitle, song.fileName);

  // VŽDY nahrajeme UTF-8 text písničky do Firebase Storage cesty kapela_ios_android/<bandId>/songs/<filename>.txt
  if (song.lyrics && song.lyrics.trim().length > 0) {
    try {
      const storageResult = await uploadSongTextToStorage(
        bandId,
        formattedTitle,
        song.lyrics,
        song.fileName
      );
      finalFileUri = storageResult.storageUrl;
      finalFileName = storageResult.storageFilename;
    } catch (err) {
      console.log("Nepodařilo se nahrát text do Storage, ukládám do Firestore:", err);
    }
  }

  const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs');
  const songData = sanitizeFirestoreData({
    ...song,
    title: formattedTitle,
    bandId,
    fileUri: finalFileUri,
    fileName: finalFileName,
    createdAt: Date.now(),
  });

  const docRef = await addDoc(colRef, songData);
  await setDoc(docRef, { id: docRef.id }, { merge: true });
  return docRef.id;
};

export const updateSong = async (bandId: string, songId: string, updates: Partial<Song>): Promise<void> => {
  if (!bandId || !songId) return;

  if (updates.title) {
    updates.title = capitalizeFirstLetter(updates.title);
  }

  const cleanUpdates = sanitizeFirestoreData({ ...updates });

  // Pokud se upravuje text nebo název písně, nahrajeme novou verzi do Firebase Storage!
  if (updates.lyrics !== undefined || updates.title !== undefined) {
    try {
      const docRef = doc(db, BANDS_COLLECTION, bandId, 'songs', songId);
      const docSnap = await getDoc(docRef);
      const existingSong = docSnap.exists() ? (docSnap.data() as Song) : null;

      const titleToUse = updates.title || existingSong?.title || 'pisen';
      const lyricsToUse = updates.lyrics !== undefined ? updates.lyrics : (existingSong?.lyrics || '');
      const fileNameToUse = updates.fileName || existingSong?.fileName;

      const storageResult = await uploadSongTextToStorage(
        bandId,
        titleToUse,
        lyricsToUse,
        fileNameToUse
      );

      cleanUpdates.fileUri = storageResult.storageUrl;
      cleanUpdates.fileName = storageResult.storageFilename;
    } catch (err) {
      console.log("Chyba při aktualizaci textu na Storage:", err);
    }
  }

  const docRef = doc(db, BANDS_COLLECTION, bandId, 'songs', songId);
  await setDoc(docRef, cleanUpdates, { merge: true });
};

export const deleteSong = async (bandId: string, songId: string): Promise<void> => {
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'songs', songId);
  await deleteDoc(docRef);
};

export const deleteAllSongs = async (bandId: string): Promise<void> => {
  try {
    const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs');
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map(docSnap =>
      deleteDoc(doc(db, BANDS_COLLECTION, bandId, 'songs', docSnap.id))
    );
    await Promise.all(deletePromises);
  } catch (e) {
    console.error("Nepodařilo se smazat všechny písně:", e);
  }
};

export const subscribeToSong = (
  bandId: string,
  songId: string,
  callback: (song: Song | null) => void
): (() => void) => {
  if (!bandId || !songId) return () => {};
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'songs', songId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Song);
    } else {
      callback(null);
    }
  }, (error) => {
    console.log("Chyba při reálném odebírání písně:", error);
  });
};

export const subscribeToSongs = (
  bandId: string,
  callback: (songs: Song[]) => void
): (() => void) => {
  if (!bandId) return () => {};
  const colRef = collection(db, BANDS_COLLECTION, bandId, 'songs');
  return onSnapshot(colRef, (snapshot) => {
    const songs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Song));
    callback(songs);
  }, (error) => {
    console.log("Chyba při reálném odebírání seznamu písní:", error);
  });
};

// --- LIVE SESSION ---

export const updateLiveSession = async (bandId: string, payload: LiveSessionPayload): Promise<void> => {
  if (!bandId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'live_session', 'current');
  const cleanData = sanitizeFirestoreData({ ...payload });
  await setDoc(docRef, cleanData, { merge: true });
};

export const subscribeToLiveSession = (
  bandId: string,
  callback: (payload: LiveSessionPayload | null) => void
): (() => void) => {
  if (!bandId) return () => {};
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'live_session', 'current');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as LiveSessionPayload);
    } else {
      callback(null);
    }
  }, (error) => {
    console.log("Chyba při odebírání Live Session:", error);
  });
};

export const stopLiveSession = async (bandId: string): Promise<void> => {
  if (!bandId) return;
  const docRef = doc(db, BANDS_COLLECTION, bandId, 'live_session', 'current');
  await deleteDoc(docRef);
};
