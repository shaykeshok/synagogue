import { initializeApp } from "firebase/app";
const required=["VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN","VITE_FIREBASE_PROJECT_ID","VITE_FIREBASE_APP_ID"];
const missing=required.filter(key=>!import.meta.env[key]);
const status=document.getElementById("status");
if(missing.length){status.textContent="טרם הוגדר חיבור Firebase. האתר במצב הקמה בלבד.";}else{initializeApp({apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID});status.textContent="Firebase הוגדר. הזמנות עדיין חסומות עד השלמת מנגנוני האבטחה.";}
