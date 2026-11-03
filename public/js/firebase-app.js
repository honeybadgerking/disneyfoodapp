// Shared Firebase setup for every page (ES module).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// signInWithRedirect only works reliably when authDomain is the same origin
// the page is served from — otherwise browsers that block third-party
// storage (Safari, Firefox, Chrome) silently drop the redirect result and
// the user lands back on the sign-in gate. Firebase Hosting serves the
// /__/auth/handler endpoint on every hosted domain, so use the current one.
const FIREBASE_HOSTING_DOMAIN = /\.(web\.app|firebaseapp\.com)$/;
const firebaseConfig = {
  apiKey: "AIzaSyC1GOv3zRdr-6KXi0rMwku6lGcU_sC63-I",
  authDomain: FIREBASE_HOSTING_DOMAIN.test(location.hostname)
    ? location.host
    : "disneyland-food-web-app.firebaseapp.com",
  projectId: "disneyland-food-web-app",
  storageBucket: "disneyland-food-web-app.firebasestorage.app",
  messagingSenderId: "684283232564",
  appId: "1:684283232564:web:c006b289c58734e900e561",
};

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Redirects the whole page to Google's sign-in and back, rather than opening
// a popup — avoids a known Firebase/IndexedDB conflict on some mobile browsers.
export function signIn() { return signInWithRedirect(auth, provider); }
export function signOutUser() { return signOut(auth); }
export function redirectResult() { return getRedirectResult(auth); }
export function onUser(cb) { return onAuthStateChanged(auth, cb); }
