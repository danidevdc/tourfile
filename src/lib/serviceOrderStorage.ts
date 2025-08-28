
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
} from 'firebase/firestore';
import { type ServiceOrderData } from './serviceOrderGenerator';
import { format, parse } from 'date-fns';

export interface StoredServiceOrder {
  id: string;
  orderName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  data: ServiceOrderData;
}

function getFirstDateFromServices(services: ServiceOrderData['services']): string {
    if (!services || services.length === 0) {
        return format(new Date(), 'ddMMyy');
    }
    try {
        const firstServiceDate = services[0].fecha;
        // The date is already in dd/MM/yyyy format in services array, need to parse it correctly
        const parsedDate = parse(firstServiceDate, 'dd/MM/yyyy', new Date());
        return format(parsedDate, 'ddMMyy');
    } catch (e) {
        console.error("Could not parse date from service, falling back to today.", e);
        return format(new Date(), 'ddMMyy');
    }
}


export async function saveServiceOrder(orderData: ServiceOrderData, createdByEmail: string): Promise<string> {
    if (!db) throw new Error("Firestore not initialized.");

    const firstDate = getFirstDateFromServices(orderData.services);
    const orderName = `ODS_${firstDate}_${orderData.file}`;

    const newOrder: Omit<StoredServiceOrder, 'id' | 'createdAt'> = {
        orderName,
        createdBy: createdByEmail,
        data: orderData,
    };
    
    const docRef = await addDoc(collection(db, 'serviceOrders'), {
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return docRef.id;
}


export async function updateServiceOrder(orderId: string, orderData: ServiceOrderData): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    
    const firstDate = getFirstDateFromServices(orderData.services);
    const orderName = `ODS_${firstDate}_${orderData.file}`;

    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        orderName,
        data: orderData,
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
        return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate(),
            updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
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


export async function deleteServiceOrder(orderId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await deleteDoc(orderRef);
}
