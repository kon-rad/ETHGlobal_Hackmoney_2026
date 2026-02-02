import { db } from "./firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

const COLLECTION_NAME = "waitlist";

export interface WaitlistEntry {
  email: string;
  timestamp: Date;
  source?: string;
}

export async function addToWaitlist(email: string, source?: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    email: normalizedEmail,
    timestamp: serverTimestamp(),
    source: source || "landing-page",
  });

  return docRef.id;
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const q = query(
    collection(db, COLLECTION_NAME),
    where("email", "==", normalizedEmail)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
