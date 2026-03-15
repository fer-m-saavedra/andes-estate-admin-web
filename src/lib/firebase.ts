import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDIMERmWgKRi0FxqKmffnt9IgDmo4qkdSY",
  authDomain: "andes-estate-prd.firebaseapp.com",
  projectId: "andes-estate-prd",
  storageBucket: "andes-estate-prd.firebasestorage.app",
  messagingSenderId: "180332094092",
  appId: "1:180332094092:web:61ddfbd84e50032ec211a9",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
