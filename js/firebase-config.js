/* ============================================
   SAFE Research Institute - Firebase Configuration

   IMPORTANT — c3 / c4 SEPARATION:
   This file MUST point at a Firebase project owned by the
   Science and Freedom for Everyone Foundation (the 501(c)(3)).
   Do NOT reuse the SAFE Action 501(c)(4) Firebase project here.
   The two entities must maintain separate governance, separate
   bank accounts, and separate financial records — that includes
   separate volunteer/donor databases.

   When the Foundation Firebase project is created, replace the
   YOUR_* placeholders below with the real config from
   Firebase Console -> Project settings -> General -> Your apps.

   The web-app config is intentionally public — it's an identifier,
   not a secret. Access control is enforced by firestore.rules and
   the Authentication authorized-domains list.
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getAnalytics, isSupported as analyticsSupported } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

analyticsSupported().then((ok) => {
  if (ok) getAnalytics(app);
}).catch(() => { /* analytics unavailable; ignore */ });
