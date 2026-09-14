// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendSignInLinkToEmail as firebaseSendSignInLinkToEmail,
  isSignInWithEmailLink as firebaseIsSignInWithEmailLink,
  signInWithEmailLink as firebaseSignInWithEmailLink,
} from "firebase/auth";

export { browserLocalPersistence, browserSessionPersistence };
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAxgEnRWFMOPvIXLQV1ChHy44b74N9O1Mg",
  authDomain: "campusbuzz-63a02.firebaseapp.com",
  projectId: "campusbuzz-63a02",
  storageBucket: "campusbuzz-63a02.firebasestorage.app",
  messagingSenderId: "659367293618",
  appId: "1:659367293618:web:fb0550e1e55294f8f78fab",
  measurementId: "G-LPNS8WQKGM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);

export { firebaseSendSignInLinkToEmail as sendSignInLinkToEmail };
export { firebaseIsSignInWithEmailLink as isSignInWithEmailLink };
export { firebaseSignInWithEmailLink as signInWithEmailLink };
