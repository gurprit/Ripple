// src/services/firebase.ts

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAhN_FnnSbS1278WcgKwMmMuvqMczPk1rc",
  authDomain: "ripple-77686.firebaseapp.com",
  projectId: "ripple-77686",
  storageBucket: "ripple-77686.appspot.com",  // (note fix: `.app` → `.appspot.com`)
  messagingSenderId: "754003865736",
  appId: "1:754003865736:web:b56b67d9d4b11036006f3d",
  measurementId: "G-VMB475J0M5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the Firebase services you’ll use
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
