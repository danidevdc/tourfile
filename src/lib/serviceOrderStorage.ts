"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { type ServiceOrderData } from './serviceOrderGenerator';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

export type OrderStatus = 'creado' | 'editado' | 'enviado' | 'eliminado' | 'excel';

export interface StoredServiceOrder {
  id: string;
  orderName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  data: ServiceOrderData & { isSplitParent?: boolean }; // Add isSplitParent to the data object
  status: OrderStatus; // Status is now mandatory
  deletedBy?: string; // Optional field for who deleted it
  splitFrom?: string; // ID of the parent order if this is a split child
}


function getFirstDateFromServices(services: ServiceOrderData['services']): Date {
    if (!services || services.length === 0) {
        return new Date();
    }
    const sortedServices = [...services].sort((a, b) => {
        try {
            const dateA = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime();
            const dateB = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime();
            if (dateA !== dateB) return dateA - dateB;
        } catch {}
        return a.hora.localeCompare(b.hora);
    });
    try {
        const firstServiceDate = sortedServices[0].fecha;
        return parse(firstServiceDate, 'dd/MM/yyyy', new Date());
    } catch (e) {
        console.error("Could not parse date from service, falling back to today.", e);
        return new Date();
    }
}

function formatOrderName(date: Date, fileNumber: string, splitSuffix?: string): string {
    const datePart = format(date, 'dd_MMMM_yyyy', { locale: es }).toUpperCase();
    const baseName = `ODS_${datePart}_${fileNumber.replace(/[\s/]/g, '_')}`;
    const namePart = splitSuffix ? splitSuffix.replace(/^CONT\.\s/i, '').split(' ')[0].toUpperCase() : undefined;
    return namePart ? `${baseName} - ${namePart}` : baseName;
}

export async function saveServiceOrder(orderData: ServiceOrderData, createdByEmail: string, baseOrderName?: string, splitKey?: string): Promise<string> {
    if (!db) throw new Error("Firestore not initialized.");

    const firstDate = getFirstDateFromServices(orderData.services);
    const orderName = formatOrderName(firstDate, orderData.file, splitKey);
    
    // Base object for the new order
    const newOrderPayload: any = {
        orderName,
        createdBy: createdByEmail,
        data: orderData,
        status: 'creado',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    
    // If this is a split order, store the original order name.
    if (baseOrderName) {
        newOrderPayload.splitFrom = baseOrderName;
    }

    const docRef = await addDoc(collection(db, 'serviceOrders'), newOrderPayload);

    return docRef.id;
}


export async function updateServiceOrder(orderId: string, orderData: ServiceOrderData, status: OrderStatus = 'editado'): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        data: orderData,
        status: status,
        updatedAt: serverTimestamp()
    });
}

export async function getAllServiceOrders(): Promise<StoredServiceOrder[]> {
    if (!db) throw new Error("Firestore not initialized.");
    
    const ordersRef = collection(db, 'serviceOrders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = (data.createdAt as Timestamp)?.toDate();
        const updatedAt = (data.updatedAt as Timestamp)?.toDate();
        
        return {
            id: doc.id,
            ...data,
            createdAt: createdAt,
            updatedAt: updatedAt,
            status: data.status || 'creado'
        } as StoredServiceOrder;
    });
}

export async function getServiceOrderById(orderId: string): Promise<StoredServiceOrder | null> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    const docSnap = await getDoc(orderRef);

    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate(),
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
    } as StoredServiceOrder;
}

/**
 * Performs a soft delete on a service order by updating its status to 'eliminado'.
 * @param orderId The ID of the service order to "delete".
 * @param deletedByEmail The email of the user performing the deletion.
 */
export async function deleteServiceOrder(orderId: string, deletedByEmail: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'eliminado',
        deletedBy: deletedByEmail,
        updatedAt: serverTimestamp()
    });
}

/**
 * Performs a bulk soft delete on multiple service orders.
 * @param orderIds An array of IDs of the service orders to "delete".
 * @param deletedByEmail The email of the user performing the deletion.
 */
export async function deleteBulkServiceOrders(orderIds: string[], deletedByEmail: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const batch = writeBatch(db);
    orderIds.forEach(id => {
        const orderRef = doc(db, 'serviceOrders', id);
        batch.update(orderRef, {
            status: 'eliminado',
            deletedBy: deletedByEmail,
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();
}

/**
 * Recovers a soft-deleted service order by changing its status back to 'editado'.
 * @param orderId The ID of the service order to recover.
 */
export async function recoverServiceOrder(orderId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'editado', // Or 'creado' depending on desired logic
        deletedBy: '', // Clear the deletedBy field
        updatedAt: serverTimestamp()
    });
}
