import 'expo-blob';
import { Platform } from 'react-native';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Vaše konfigurace Firebase z konzole
const firebaseConfig = {
  apiKey: "AIzaSyC3z3Y2f-WwPOaSaIWPEghtL2IZx6FAzE0",
  authDomain: "naplech-96e9e.firebaseapp.com",
  projectId: "naplech-96e9e",
  storageBucket: "naplech-96e9e.firebasestorage.app",
  messagingSenderId: "403947983773",
  appId: "1:403947983773:web:447d36dd5e804ca89bd574",
  measurementId: "G-9HJNQJXYBX"
};

// Zamezení vícenásobné inicializaci při Fast Refresh
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firebaseAuth;
try {
  if (Platform.OS === 'web') {
    firebaseAuth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  } else {
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  }
} catch (error: any) {
  if (error.code === 'auth/already-initialized') {
    firebaseAuth = getAuth(app);
  } else {
    throw error;
  }
}

export const auth = firebaseAuth;
// Explicitně předáváme jméno databáze "kapela"
export const db = getFirestore(app, "kapela");
export const storage = getStorage(app);