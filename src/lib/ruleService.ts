
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore';

export interface ExpenseRule {
  id: string; // Firestore document ID
  keyword: string; // Keyword to search for in Excel
  detail: string; // Expense detail to put in the report
  unitPrice: number;
  quantityFormula: string; // e.g., "=$G$3", "=$G$3+1", "1"
  city: 'La Paz' | 'Uyuni';
  isActive: boolean;
  order: number; // For sorting purposes
  vobOps?: string; // Optional field
}

// Default rules based on the original hardcoded logic
const defaultLaPazRules: Omit<ExpenseRule, 'id'>[] = [
  { keyword: 'desaguadero', detail: 'MALETAS FRONTERA', unitPrice: 3, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 10 },
  { keyword: 'Puno/Kasani', detail: 'TAXI DOM - OFICINA', unitPrice: 30, quantityFormula: '1', city: 'La Paz', isActive: true, order: 20 },
  { keyword: 'Puno/Kasani', detail: 'BUS LPB - COPA', unitPrice: 40, quantityFormula: '1', city: 'La Paz', isActive: true, order: 21 },
  { keyword: 'Puno/Kasani', detail: 'DESAYUNO GUIA', unitPrice: 20, quantityFormula: '1', city: 'La Paz', isActive: true, order: 22 },
  { keyword: 'I.Sol', detail: 'TAXI DOM - HOTEL', unitPrice: 30, quantityFormula: '1', city: 'La Paz', isActive: true, order: 30 },
  { keyword: 'I.Sol', detail: 'ISLA DEL SOL', unitPrice: 10, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 31 },
  { keyword: 'I.Sol', detail: 'ISLA DE LA LUNA', unitPrice: 10, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 32 },
  { keyword: 'CT-Private transfer from airport to hotel', detail: 'TAXI DOM - OFICINA', unitPrice: 30, quantityFormula: '1', city: 'La Paz', isActive: true, order: 40 },
  { keyword: 'CT-Private transfer from airport to hotel', detail: 'MALETAS AEROPUERTO', unitPrice: 3, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 41 },
  { keyword: 'CT-Private transfer from airport to hotel', detail: 'TAXI HOTEL - DOM', unitPrice: 30, quantityFormula: '1', city: 'La Paz', isActive: true, order: 42 },
  { keyword: 'Tiwanaku', detail: 'TIWANAKU', unitPrice: 100, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 50 },
  { keyword: 'Cable Car', detail: 'TELEFERICO', unitPrice: 7, quantityFormula: '=$G$3+1', city: 'La Paz', isActive: true, order: 60 },
  { keyword: 'Moon Valley', detail: 'VALLE', unitPrice: 20, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 70 },
  { keyword: 'AM', detail: 'ALMUERZO GUIA', unitPrice: 35, quantityFormula: '1', city: 'La Paz', isActive: true, order: 80 },
  { keyword: 'Kasani/Puno', detail: 'MALETAS FRONTERA', unitPrice: 3, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 90 },
  { keyword: 'Kasani/Puno', detail: 'BUS COPA - LPB', unitPrice: 40, quantityFormula: '1', city: 'La Paz', isActive: true, order: 91 },
  { keyword: 'CT-Private transfer from hotel to airport', detail: 'TAXI DOM - HOTEL', unitPrice: 30, quantityFormula: '1', city: 'La Paz', isActive: true, order: 100 },
  { keyword: 'CT-Private transfer from hotel to airport', detail: 'MALETAS AEROPUERTO', unitPrice: 3, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 101 },
  { keyword: 'CT-Private transfer from hotel to airport', detail: 'TAXI CENTRO - DOM', unitPrice: 30, quantityFormula: '1', city: 'La Paz', isActive: true, order: 102 },
  { keyword: 'CT-City Tour', detail: 'AGUAS', unitPrice: 6, quantityFormula: '=$G$3+2', city: 'La Paz', isActive: true, order: 110 },
];

export async function initializeDefaultRules(): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const rulesRef = collection(db, 'expenseRules');
    const q = query(rulesRef, where("city", "==", "La Paz"));
    const snapshot = await getCountFromServer(q);

    if (snapshot.data().count === 0) {
        console.log('No default rules found for La Paz. Initializing...');
        const batch = writeBatch(db);
        defaultLaPazRules.forEach(ruleData => {
            const docRef = doc(rulesRef); // Auto-generate ID
            batch.set(docRef, { ...ruleData, id: docRef.id });
        });
        await batch.commit();
        console.log('Default La Paz rules have been initialized in Firestore.');
    }
}


export async function getExpenseRulesFromFirestore(city: 'La Paz' | 'Uyuni'): Promise<ExpenseRule[]> {
  if (!db) throw new Error("Firestore not initialized");
  const rulesRef = collection(db, 'expenseRules');
  const q = query(rulesRef, where('city', '==', city));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseRule));
}

export async function saveExpenseRulesToFirestore(rules: ExpenseRule[]): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const batch = writeBatch(db);
  const rulesRef = collection(db, 'expenseRules');

  rules.forEach(rule => {
    // If the id is a temporary one, create a new document reference
    const docRef = rule.id.startsWith('new_') ? doc(rulesRef) : doc(rulesRef, rule.id);
    const dataToSave = { ...rule, id: docRef.id }; // Ensure the ID is persisted
    batch.set(docRef, dataToSave);
  });

  await batch.commit();
}

export async function deleteExpenseRuleFromFirestore(ruleId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  if (!ruleId || ruleId.startsWith('new_')) throw new Error("Invalid ID for deletion.");
  
  const ruleDocRef = doc(db, 'expenseRules', ruleId);
  await deleteDoc(ruleDocRef);
}
