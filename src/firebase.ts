import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

// The Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyAp8cbYx_7Rb_oqa_3pf-PQlFWbhNNPecA",
  authDomain: "makkahtraders.firebaseapp.com",
  projectId: "makkahtraders",
  storageBucket: "makkahtraders.firebasestorage.app",
  messagingSenderId: "504530050670",
  appId: "1:504530050670:web:f5ebac825986a07c8cd07f",
  measurementId: "G-YJGBGFE5DJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const analytics = getAnalytics(app);

export default app;
