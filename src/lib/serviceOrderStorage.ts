

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
  where,
} from 'firebase/firestore';
import { type ServiceOrderData } from './serviceOrderGenerator';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { childNameFrom, getBaseName } from './serviceOrderFamily';

export type OrderStatus = 'creado' | 'editado' | 'enviado' | 'eliminado' | 'excel' | 'cancelado' | 'impreso';

export interface StoredServiceOrder {
  id: string;
  orderName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  data: ServiceOrderData & { isSplitParent?: boolean; responsible?: { guia?: string; chofer?: string }; splitKey?: string; };
  status: OrderStatus; 
  deletedBy?: string; 
  splitFrom?: string; 
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

function formatOrderName(date: Date, fileNumber: string): string {
    const datePart = format(date, 'dd_MMMM_yyyy', { locale: es }).toUpperCase();
    return `ODS_${datePart}_${fileNumber.replace(/[\s/]/g, '_')}`;
}

export async function saveServiceOrder(orderData: ServiceOrderData, createdByEmail: string, orderName?: string, splitFromId?: string): Promise<string> {
    if (!db) throw new Error("Firestore not initialized.");

    const finalOrderName = orderName || formatOrderName(getFirstDateFromServices(orderData.services), orderData.file);
    
    const newOrderPayload: any = {
        orderName: finalOrderName,
        createdBy: createdByEmail,
        data: orderData,
        status: 'creado',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    
    if (splitFromId) {
        newOrderPayload.splitFrom = splitFromId;
    }


    const docRef = await addDoc(collection(db, 'serviceOrders'), newOrderPayload);

    return docRef.id;
}

export async function saveEditedServiceOrder(
    originalOrder: StoredServiceOrder,
    updatedData: ServiceOrderData,
    userEmail: string
): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");

    const batch = writeBatch(db);
    const parentId = originalOrder.splitFrom || originalOrder.id;
    const parentBaseName = getBaseName(originalOrder.orderName);
    
    const guideServiceMap = new Map<string, any[]>();
    const driverServiceMap = new Map<string, any[]>();
    
    const mainGuide = updatedData.guia || "SIN GUIA PRINCIPAL";

    updatedData.services.forEach(service => {
        const guideKey = service.guia || mainGuide;
        if (guideKey && guideKey !== "SIN GUIA PRINCIPAL") {
            if (!guideServiceMap.has(guideKey)) guideServiceMap.set(guideKey, []);
            guideServiceMap.get(guideKey)!.push(service);
        }
        
        if (service.chofer && service.chofer !== 'NONE' && service.bus?.toUpperCase() !== 'SIN BUS') {
            if (!driverServiceMap.has(service.chofer)) driverServiceMap.set(service.chofer, []);
            driverServiceMap.get(service.chofer)!.push(service);
        }
    });
    
    const needsSplit = guideServiceMap.size > 1 || driverServiceMap.size > 1;

    // If no split is needed, just update the main order
    if (!needsSplit) {
        batch.update(doc(db, 'serviceOrders', parentId), {
            data: updatedData,
            isSplitParent: false,
            status: 'editado',
            updatedAt: serverTimestamp()
        });
        
        // Cancel any existing children because the order is no longer split
        const existingChildren = await getChildrenByParentId(parentId);
        existingChildren.forEach(child => {
            if (child.id !== parentId) {
                 batch.update(doc(db, 'serviceOrders', child.id), { status: 'cancelado', updatedAt: serverTimestamp() });
            }
        });

    } else { // If a split is needed
        // Mark existing children for cancellation before creating new ones
        const existingChildren = await getChildrenByParentId(parentId);
        existingChildren.forEach(child => {
            if (child.id !== parentId) {
                batch.update(doc(db, 'serviceOrders', child.id), { status: 'cancelado', updatedAt: serverTimestamp() });
            }
        });

        // Create new children based on the split logic
        for (const [guide, services] of guideServiceMap.entries()) {
            const childDataPayload: ServiceOrderData = { ...updatedData, services, guia: guide };
            const childName = childNameFrom(parentBaseName, guide, null);
            const newDocRef = doc(collection(db, 'serviceOrders'));
            batch.set(newDocRef, { 
                data: childDataPayload, 
                orderName: childName, 
                splitFrom: parentId, 
                createdBy: originalOrder.createdBy,
                createdAt: originalOrder.createdAt,
                status: 'creado', 
                updatedAt: serverTimestamp() 
            });
        }

        for (const [driver, services] of driverServiceMap.entries()) {
             const childDataPayload: ServiceOrderData = { ...updatedData, services, guia: '' };
             const childName = childNameFrom(parentBaseName, null, driver);
             const newDocRef = doc(collection(db, 'serviceOrders'));
             batch.set(newDocRef, { 
                data: childDataPayload, 
                orderName: childName, 
                splitFrom: parentId, 
                createdBy: originalOrder.createdBy,
                createdAt: originalOrder.createdAt,
                status: 'creado', 
                updatedAt: serverTimestamp() 
             });
        }
        
        // Update the parent order
        batch.update(doc(db, 'serviceOrders', parentId), {
            data: updatedData,
            isSplitParent: true,
            status: 'editado',
            updatedAt: serverTimestamp()
        });
    }

    await batch.commit();
}


export async function updateServiceOrder(orderId: string, status: OrderStatus): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
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

    const orders: StoredServiceOrder[] = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Robust date checking
        if (!data.createdAt || !(data.createdAt instanceof Timestamp)) {
            console.warn(`Skipping order ${doc.id}: Missing or invalid 'createdAt' field.`);
            return; // Skip this document
        }
        const createdAt = data.createdAt.toDate();
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;
        
        orders.push({
            id: doc.id,
            ...data,
            createdAt: createdAt,
            updatedAt: updatedAt,
            status: data.status || 'creado'
        } as StoredServiceOrder);
    });
    
    return orders;
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


export async function getChildrenByParentId(parentId: string): Promise<StoredServiceOrder[]> {
    if (!db) throw new Error("Firestore not initialized.");
    
    const ordersRef = collection(db, 'serviceOrders');
    const q = query(ordersRef, where('splitFrom', '==', parentId));
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


export async function deleteServiceOrder(orderId: string, deletedByEmail: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'eliminado',
        deletedBy: deletedByEmail,
        updatedAt: serverTimestamp()
    });
}

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


export async function softCancelServiceOrder(orderId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'cancelado',
        updatedAt: serverTimestamp()
    });
}


export async function recoverServiceOrder(orderId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'editado', 
        deletedBy: '', 
        updatedAt: serverTimestamp()
    });
}
