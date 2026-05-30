import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB82jsirVDKLI6tYMTobhMDgN2Mq88nUA4",
  authDomain: "campusnavapp-e8c4b.firebaseapp.com",
  databaseURL: "https://campusnavapp-e8c4b-default-rtdb.firebaseio.com",
  projectId: "campusnavapp-e8c4b",
  storageBucket: "campusnavapp-e8c4b.firebasestorage.app",
  messagingSenderId: "774788717790",
  appId: "1:774788717790:web:fc4ee7f4621282aaebb64f",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const database = getDatabase(app);