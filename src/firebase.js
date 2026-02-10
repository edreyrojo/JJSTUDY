import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfeEiJ-ps6BsL1zKGtoSI_xO09QG4EJIE",
  authDomain: "jjstudy-a1a4c.firebaseapp.com",
  projectId: "jjstudy-a1a4c",
  storageBucket: "jjstudy-a1a4c.firebasestorage.app",
  messagingSenderId: "307033613709",
  appId: "1:307033613709:web:407f0d559170a5204d49c4",
  measurementId: "G-N3XJ5CR748"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);