
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  getDocs
} from 'firebase/firestore';

export interface ReportInfo {
  id: string; // Firestore document ID
  fileNumber: string;
  guideName: string;
  groupName: string;
  paxCount: string;
  generationDate: Timestamp;
  generatedBy: string; // User's email or UID
}

export async function saveReportInfoToFirestore(reportData: Omit<ReportInfo, 'id' | 'generationDate'>): Promise<void> {
  if (!db) {
    console.error("Firestore not initialized, cannot save report info.");
    return;
  }
  try {
    const reportRef = doc(collection(db, 'generatedReports'));
    const dataToSave = {
      ...reportData,
      generationDate: serverTimestamp() as Timestamp,
    };
    await setDoc(reportRef, dataToSave);
  } catch (error) {
    console.error("Error saving report info to Firestore:", error);
    // Don't throw an error to the user, as the Excel might have been generated.
    // Log it for debugging.
  }
}

export async function getAllReportsFromFirestore(): Promise<ReportInfo[]> {
  if (!db) {
      console.error("Firestore not initialized.");
      return [];
  }
  try {
      const reportsCollectionRef = collection(db, 'generatedReports');
      const reportsSnapshot = await getDocs(reportsCollectionRef);
      return reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReportInfo));
  } catch (error) {
      console.error("Error fetching reports from Firestore:", error);
      // It's better to return an empty array than to crash the admin page
      return [];
  }
}
