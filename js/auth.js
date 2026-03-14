/* ============================================
   SAFE Research Institute - Authentication Module
   ============================================ */

import { auth, db } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const provider = new GoogleAuthProvider();

/**
 * Sign in with Google popup.
 * Creates a user document in Firestore on first sign-in.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check if user doc exists; create on first sign-in
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      role: 'contributor',
      createdAt: serverTimestamp()
    });
  }

  return result;
}

/**
 * Sign out the current user.
 * @returns {Promise<void>}
 */
export async function logOut() {
  await signOut(auth);
}

/**
 * Listen for authentication state changes.
 * @param {function} callback - Called with (user) on auth state change; user is null if signed out.
 * @returns {function} Unsubscribe function.
 */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Check whether a given UID belongs to an admin user.
 * Reads the user document from Firestore and checks the role field.
 * @param {string} uid - The Firebase user UID to check.
 * @returns {Promise<boolean>} True if the user has the 'admin' role.
 */
export async function isAdmin(uid) {
  if (!uid) return false;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    return userSnap.data().role === 'admin';
  } catch (err) {
    console.error('Error checking admin status:', err);
    return false;
  }
}
