
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  arrayUnion,
  serverTimestamp,
  query,
  where,
  // increment, // Not used currently, can be removed if not planned
  runTransaction
} from 'firebase/firestore';

export interface DispensingRecord {
  id: string;
  date: Timestamp; 
  rxNumber: string;
  quantity: number;
  type: 'dispensed' | 'stocked';
  userName?: string;
  expirationDate?: Timestamp; 
}

export interface Medicine {
  id: string; // Firestore document ID will be this id
  name: string;
  presentation: string;
  description?: string;
  currentStock: number;
  lastUpdated: Timestamp; 
  dispensingHistory: DispensingRecord[];
  isBlocked: boolean; // New field
}

export const mockMedicinesForFirestore: Omit<Medicine, 'lastUpdated' | 'dispensingHistory'> & { dispensingHistory: Omit<DispensingRecord, 'date' | 'expirationDate' | 'id'> & { id?: string, date: string, expirationDate?: string}[] }[] = [
  {
    id: 'MED003',
    name: 'Lisinopril 10mg Tablets',
    presentation: 'Tablets',
    description: 'ACE inhibitor for hypertension',
    currentStock: 143, // Calculated: 100-10-5+50-15-8+30-12-7+20 = 143
    isBlocked: false,
    dispensingHistory: [
       { id: 'hist_med003_01', date: '2024-07-20', rxNumber: 'alm003', quantity: 100, type: 'stocked', userName: 'elena.sanchez', expirationDate: '2025-07-31' },
       { id: 'hist_med003_02', date: '2024-07-21', rxNumber: 'RX7001', quantity: 10, type: 'dispensed', userName: 'ana.lopez' },
       { id: 'hist_med003_03', date: '2024-07-22', rxNumber: 'RX7002', quantity: 5, type: 'dispensed', userName: 'carlos.ruiz' },
       { id: 'hist_med003_04', date: '2024-07-23', rxNumber: 'alm004', quantity: 50, type: 'stocked', userName: 'admin.admin', expirationDate: '2026-01-15' },
       { id: 'hist_med003_05', date: '2024-07-24', rxNumber: 'RX7003', quantity: 15, type: 'dispensed', userName: 'sofia.martin' },
       { id: 'hist_med003_06', date: '2024-07-25', rxNumber: 'RX7004', quantity: 8, type: 'dispensed', userName: 'ana.lopez' },
       { id: 'hist_med003_07', date: '2024-07-26', rxNumber: 'alm005', quantity: 30, type: 'stocked', userName: 'juan.diaz', expirationDate: '2026-06-30' },
       { id: 'hist_med003_08', date: '2024-07-27', rxNumber: 'RX7005', quantity: 12, type: 'dispensed', userName: 'carlos.ruiz' },
       { id: 'hist_med003_09', date: '2024-07-28', rxNumber: 'RX7006', quantity: 7, type: 'dispensed', userName: 'sofia.martin' },
       { id: 'hist_med003_10', date: '2024-07-29', rxNumber: 'alm006', quantity: 20, type: 'stocked', userName: 'admin.admin', expirationDate: '2026-12-31' },
    ],
  }
];

export async function initializeDefaultMedicines(): Promise<void> {
  if (!db) {
    console.error("Firestore instance (db) is not available for initializing medicines.");
    return;
  }
  try {
    const medicinesRef = collection(db, 'medicines');
    const medicinesSnapshot = await getDocs(medicinesRef);

    if (medicinesSnapshot.empty) {
      const batch = writeBatch(db);
      mockMedicinesForFirestore.forEach(medMock => {
        const medDocRef = doc(medicinesRef, medMock.id);
        
        const historyForFirestore: DispensingRecord[] = medMock.dispensingHistory.map((h, index) => {
          const record: any = {
            id: h.id || `hist_init_${medMock.id}_${index}_${Date.now()}`,
            date: Timestamp.fromDate(new Date(h.date)),
            rxNumber: h.rxNumber,
            quantity: h.quantity,
            type: h.type,
          };
          if (h.userName) {
            record.userName = h.userName;
          }
          if (h.expirationDate) {
            record.expirationDate = Timestamp.fromDate(new Date(h.expirationDate));
          }
          return record as DispensingRecord;
        });

        const medicineData: Medicine = {
          id: medMock.id,
          name: medMock.name,
          presentation: medMock.presentation,
          description: medMock.description || '',
          currentStock: medMock.currentStock,
          lastUpdated: serverTimestamp() as Timestamp,
          dispensingHistory: historyForFirestore,
          isBlocked: medMock.isBlocked !== undefined ? medMock.isBlocked : false,
        };
        batch.set(medDocRef, medicineData);
      });
      await batch.commit();
      console.log('Default medicines (mockMedicinesForFirestore) created/updated in Firestore.');
    } else {
        console.log('Firestore "medicines" collection is not empty. Default medicines will not be re-initialized from mocks unless the collection is cleared manually.');
    }
  } catch (error) {
    console.error('Error initializing default medicines in Firestore:', error);
  }
}

export async function getMedicinesFromFirestore(): Promise<Medicine[]> {
  if (!db) throw new Error("Firestore not initialized");
  const medicinesCol = collection(db, 'medicines');
  const snapshot = await getDocs(medicinesCol);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      ...data, 
      id: doc.id, 
      isBlocked: data.isBlocked || false 
    } as Medicine;
  });
}

export async function getMedicineByIdFromFirestore(id: string): Promise<Medicine | null> {
  if (!db) throw new Error("Firestore not initialized");
  if (!id) return null; 
  const medDocRef = doc(db, 'medicines', id.toUpperCase()); 
  const docSnap = await getDoc(medDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return { 
      ...data, 
      id: docSnap.id,
      isBlocked: data.isBlocked || false 
    } as Medicine;
  }
  return null;
}

export async function createCompleteMedicineInFirestore(medicineData: Medicine): Promise<void> {
  if (!db) {
    throw new Error("Firestore not initialized. Cannot save medicine.");
  }
  if (!medicineData || !medicineData.id) {
    throw new Error("Invalid medicine data or ID missing for saving to Firestore.");
  }
  const medDocRef = doc(db, 'medicines', medicineData.id);
  const dataToSet: Medicine = {
    ...medicineData,
    lastUpdated: serverTimestamp() as Timestamp, // Ensure lastUpdated is set
    isBlocked: medicineData.isBlocked !== undefined ? medicineData.isBlocked : false,
  };
  await setDoc(medDocRef, dataToSet);
}


export async function updateMedicineStockInFirestore(
  medicineId: string,
  quantityChange: number,
  transactionType: 'dispensed' | 'stocked',
  rxNumber: string,
  userName: string | null, // Allow null for userName
  transactionDate: Timestamp,
  expirationDateForStock?: Timestamp 
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const medDocRef = doc(db, 'medicines', medicineId);

  try {
    await runTransaction(db, async (transaction) => {
      const medDoc = await transaction.get(medDocRef);
      if (!medDoc.exists()) {
        throw new Error(`Medicamento con ID ${medicineId} no encontrado.`);
      }

      const medicineData = medDoc.data() as Medicine;

      if (medicineData.isBlocked && transactionType === 'stocked') {
        throw new Error(`El medicamento "${medicineData.name}" está cerrado y no se puede ingresar stock.`);
      }
      if (medicineData.isBlocked && transactionType === 'dispensed') {
         throw new Error(`El medicamento "${medicineData.name}" está cerrado y no se puede dispensar.`);
      }

      let newStock = medicineData.currentStock;

      if (transactionType === 'dispensed') {
        if (newStock < quantityChange) {
          throw new Error(`Stock insuficiente para ${medicineData.name}. Stock actual: ${newStock}, se requieren: ${quantityChange}.`);
        }
        newStock -= quantityChange;
      } else { // stocked
        newStock += quantityChange;
        if (!expirationDateForStock && quantityChange > 0) {
            throw new Error("La fecha de expiración es requerida para añadir stock.");
        }
      }

      // Build the record object carefully
      const recordDataObject: {
        id: string;
        date: Timestamp;
        rxNumber: string;
        quantity: number;
        type: 'dispensed' | 'stocked';
        userName?: string;
        expirationDate?: Timestamp;
      } = {
        id: `${transactionType}_${medicineId}_${Date.now()}`,
        date: transactionDate, 
        rxNumber: rxNumber,
        quantity: quantityChange,
        type: transactionType,
      };

      if (userName) { // Only add userName if it's a non-empty string
        recordDataObject.userName = userName;
      }
      if (transactionType === 'stocked' && expirationDateForStock) {
        recordDataObject.expirationDate = expirationDateForStock;
      }
      
      const newRecord = recordDataObject as DispensingRecord;
      
      transaction.update(medDocRef, {
        currentStock: newStock,
        dispensingHistory: arrayUnion(newRecord),
        lastUpdated: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("Error updating medicine stock in transaction:", error);
    throw error; 
  }
}

export async function deleteMedicineFromFirestore(medicineId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const medDocRef = doc(db, 'medicines', medicineId);
  await deleteDoc(medDocRef);
}


export async function updateMedicineDetailsInFirestore(
  medicineId: string,
  newName: string,
  newPresentation: string
): Promise<void> {
  if (!db) {
    throw new Error("Firestore not initialized. Cannot update medicine details.");
  }
  if (!medicineId || !newName.trim() || !newPresentation.trim()) {
    throw new Error("ID del medicamento, nuevo nombre y nueva presentación son requeridos para actualizar.");
  }
  const medDocRef = doc(db, 'medicines', medicineId); 
  await updateDoc(medDocRef, {
    name: newName.trim(),
    presentation: newPresentation.trim(),
    lastUpdated: serverTimestamp()
  });
}

export async function updateMedicineBlockedStatus(medicineId: string, isBlocked: boolean): Promise<void> {
  if (!db) {
    throw new Error("Firestore not initialized. Cannot update medicine status.");
  }
  if (!medicineId) {
    throw new Error("ID del medicamento es requerido para actualizar su estado.");
  }
  const medDocRef = doc(db, 'medicines', medicineId);
  await updateDoc(medDocRef, {
    isBlocked: isBlocked,
    lastUpdated: serverTimestamp()
  });
}

export async function deleteDispensingRecord(
  medicineId: string,
  recordIdToDelete: string
): Promise<void> {
  if (!db) {
    console.error("Firestore instance (db) is not available in deleteDispensingRecord.");
    throw new Error("La base de datos (Firestore) no está inicializada o disponible.");
  }
  const medDocRef = doc(db, 'medicines', medicineId);

  try {
    await runTransaction(db, async (transaction) => {
      const medDoc = await transaction.get(medDocRef);
      if (!medDoc.exists()) {
        throw new Error(`Medicamento con ID ${medicineId} no encontrado.`);
      }

      const medicineData = medDoc.data() as Medicine;
      const initialHistory = medicineData.dispensingHistory || [];

      // Filtrar el registro a eliminar
      const updatedHistory = initialHistory.filter(record => record.id !== recordIdToDelete);

      if (initialHistory.length === updatedHistory.length) {
        // Si el registro no se encontró, podríamos optar por no hacer nada o lanzar un error.
        // Por ahora, solo advertimos y no modificamos nada para evitar fallos inesperados.
        console.warn(`Registro con ID ${recordIdToDelete} no encontrado en el historial del medicamento ${medicineId}. No se realizaron cambios.`);
        return; // Termina la transacción sin realizar cambios.
      }
      
      // Recalcular currentStock basado en el historial actualizado.
      // Es importante ordenar por fecha para asegurar la correcta cronología de las transacciones.
      const sortedHistory = [...updatedHistory].sort((a, b) => 
        (a.date as Timestamp).toMillis() - (b.date as Timestamp).toMillis()
      );
      
      let newCalculatedStock = 0;
      for (const record of sortedHistory) {
        if (record.type === 'stocked') {
          newCalculatedStock += record.quantity;
        } else if (record.type === 'dispensed') {
          newCalculatedStock -= record.quantity;
        }
      }
      
      // Aquí no validaremos si el stock es negativo, Firestore lo permite.
      // La lógica de negocio debería prevenirlo antes si es necesario.

      transaction.update(medDocRef, {
        dispensingHistory: updatedHistory,
        currentStock: newCalculatedStock,
        lastUpdated: serverTimestamp()
      });
    });
  } catch (error) {
    console.error(`Error al eliminar el registro de dispensación ${recordIdToDelete} para el medicamento ${medicineId}:`, error);
    // Relanzar el error para que pueda ser manejado por el llamador (e.g., mostrar un toast al usuario)
    throw error;
  }
}
