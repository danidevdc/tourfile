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
import { es } from 'date-fns/locale';

export type OrderStatus = 'creado' | 'editado' | 'enviado';

export interface StoredServiceOrder {
  id: string;
  orderName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  data: ServiceOrderData;
  status?: OrderStatus;
}

function getFirstDateFromServices(services: ServiceOrderData['services']): Date {
    if (!services || services.length === 0) {
        return new Date();
    }
    try {
        const firstServiceDate = services[0].fecha;
        return parse(firstServiceDate, 'dd/MM/yyyy', new Date());
    } catch (e) {
        console.error("Could not parse date from service, falling back to today.", e);
        return new Date();
    }
}

function formatOrderName(date: Date, fileNumber: string): string {
    const datePart = format(date, 'dd_MMMM_yyyy', { locale: es }).toUpperCase();
    return `ODS_${datePart}_${fileNumber}`;
}


export async function saveServiceOrder(orderData: ServiceOrderData, createdByEmail: string): Promise<string> {
    if (!db) throw new Error("Firestore not initialized.");

    const firstDate = getFirstDateFromServices(orderData.services);
    const orderName = formatOrderName(firstDate, orderData.file);

    const newOrder: Omit<StoredServiceOrder, 'id' | 'createdAt' | 'updatedAt'> = {
        orderName,
        createdBy: createdByEmail,
        data: orderData,
        status: 'creado',
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
    const orderName = formatOrderName(firstDate, orderData.file);

    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        orderName,
        data: orderData,
        status: 'editado',
        updatedAt: serverTimestamp()
    });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, { status });
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
        
        let status: OrderStatus = data.status || 'creado';
        // Logic to determine 'editado' status if not explicitly set
        if (status === 'creado' && updatedAt && createdAt && updatedAt.getTime() > createdAt.getTime() + 10000) { // 10s grace period
             status = 'editado';
        }

        return {
            id: doc.id,
            ...data,
            createdAt: createdAt,
            updatedAt: updatedAt,
            status: status
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
