
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { toZonedTime } from 'date-fns-tz';

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


/**
 * Fetches all reports generated in August 2024, considering the Bolivia timezone.
 */
export async function getAugustReports(): Promise<ReportInfo[]> {
  if (!db) {
    console.error("Firestore not initialized.");
    return [];
  }
  try {
    const reportsRef = collection(db, 'generatedReports');
    const TIME_ZONE = 'America/La_Paz'; // GMT-4

    // Define the start and end of August 2024 in the target timezone
    const startDate = toZonedTime(new Date('2024-08-01T00:00:00.000Z'), TIME_ZONE);
    const endDate = toZonedTime(new Date('2024-09-01T00:00:00.000Z'), TIME_ZONE);

    const q = query(
      reportsRef,
      where('generationDate', '>=', startDate),
      where('generationDate', '<', endDate) // Use '<' with the start of the next month for accuracy
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() } as ReportInfo;
    });

  } catch (error) {
    console.error("Error fetching August reports from Firestore:", error);
    return [];
  }
}
