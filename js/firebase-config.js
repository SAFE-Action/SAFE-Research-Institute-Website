/* ============================================
   SAFE Research Institute - Firebase Configuration

   This config points at the Foundation's own Firebase project
   (safe-research-institute). It is separate from the SAFE Action
   501(c)(4) project — see the c3/c4 separation note in the PR
   that introduced this file.

   The web-app config below is intentionally public — it's an
   identifier, not a secret. Access control is enforced by the
   Firestore rules in firestore.rules and the Authentication
   authorized-domains list in the Firebase Console.
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getAnalytics, isSupported as analyticsSupported } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: "AIzaSyDqh_M_WGhVhV6zTUaxVD2lJLJmFWIuotI",
  authDomain: "safe-research-institute.firebaseapp.com",
  projectId: "safe-research-institute",
  storageBucket: "safe-research-institute.firebasestorage.app",
  messagingSenderId: "371671719967",
  appId: "1:371671719967:web:d1a66ec8b1de49ff39b52a",
  measurementId: "G-ZH608J604B"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

analyticsSupported().then((ok) => {
  if (ok) getAnalytics(app);
}).catch(() => { /* analytics unavailable; ignore */ });
