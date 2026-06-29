/* ============================================
   SAFE Research Institute - Firebase Configuration

   The Firebase web-app config below is intentionally public — it's
   an identifier, not a secret. Access control is enforced by the
   Firestore rules in firestore.rules and the Authentication
   authorized-domains list in the Firebase Console.
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getAnalytics, isSupported as analyticsSupported } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: "AIzaSyDQul9vsl7oEj43VSlzLi_S4SXrm3liZWc",
  authDomain: "safe-action-website.firebaseapp.com",
  projectId: "safe-action-website",
  storageBucket: "safe-action-website.firebasestorage.app",
  messagingSenderId: "1035666846416",
  appId: "1:1035666846416:web:1c0bac14e6569b4f41a4d5",
  measurementId: "G-W0YSNNXDPT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

analyticsSupported().then((ok) => {
  if (ok) getAnalytics(app);
}).catch(() => { /* analytics unavailable; ignore */ });
