import 'expo-blob';
import { collection, doc, setDoc, getDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { Band, BandMember } from '@/types';

const BANDS_COLLECTION = 'kapela_ios_android';

// --- POMOCNÉ FUNKCE PRO NAHRÁVÁNÍ OBRÁZKŮ ---
export const uploadImageToStorage = async (uri: string, path: string): Promise<string> => {
  try {
    if (uri.startsWith('http')) return uri;

    const response = await fetch(uri);
    const blob = await response.blob();
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

    const response = await fetch(oldUrl);
    const blob = await response.blob();
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

    // D) Smažeme staré logo a nakonec starý dokument kapely
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
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      genre: data.genre,
      web: data.web,
      logoUri: data.logoUri,
    } as Band;
  });
};

export const getBandById = async (bandId: string): Promise<Band | null> => {
  try {
    const bandDoc = await getDoc(doc(db, BANDS_COLLECTION, bandId));
    if (bandDoc.exists()) {
      return bandDoc.data() as Band;
    }
    return null;
  } catch (e) {
    console.error("Nepodařilo se načíst detail kapely:", e);
    return null;
  }
};

// --- ČLENOVÉ KAPELY ---

export const getBandMembers = async (bandId: string): Promise<BandMember[]> => {
  const membersCol = collection(db, BANDS_COLLECTION, bandId, 'members');
  const snapshot = await getDocs(membersCol);

  return snapshot.docs.map(doc => {
    return { id: doc.id, ...doc.data() } as BandMember;
  });
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
