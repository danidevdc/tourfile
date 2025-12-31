

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
    limit,
    startAfter,
    getCountFromServer,
    QueryDocumentSnapshot,
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
    data: ServiceOrderData & { isSplitParent?: boolean; isSplitSeparated?: boolean; responsible?: { guia?: string; chofer?: string }; splitKey?: string; };
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
        } catch { }
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

/**
 * Saves a service order in "Split Mode" - creates identical orders for both guide and driver.
 * This is only used when exactly 1 guide and 1 driver are assigned and split mode is enabled.
 */
export async function saveServiceOrderInSplitMode(orderData: ServiceOrderData, createdByEmail: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");

    const batch = writeBatch(db);
    const parentBaseName = formatOrderName(getFirstDateFromServices(orderData.services), orderData.file);

    // Create parent order marked as split
    const parentRef = doc(collection(db, 'serviceOrders'));
    const parentId = parentRef.id;

    batch.set(parentRef, {
        orderName: parentBaseName,
        createdBy: createdByEmail,
        data: { ...orderData, isSplitParent: true, isSplitSeparated: true },
        status: 'creado',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Create child order for the guide (with all services)
    const guideChildName = childNameFrom(parentBaseName, orderData.guia, null);
    const guideChildRef = doc(collection(db, 'serviceOrders'));
    batch.set(guideChildRef, {
        data: { ...orderData, isSplitSeparated: true },
        orderName: guideChildName,
        splitFrom: parentId,
        createdBy: createdByEmail,
        createdAt: serverTimestamp(),
        status: 'creado',
        updatedAt: serverTimestamp()
    });

    // Create child order for the driver (with all services)
    // Get the unique driver from services
    const uniqueDriver = orderData.services.find(s => s.chofer)?.chofer || '';
    const driverChildName = childNameFrom(parentBaseName, null, uniqueDriver);
    const driverChildRef = doc(collection(db, 'serviceOrders'));
    batch.set(driverChildRef, {
        data: { ...orderData, isSplitSeparated: true },
        orderName: driverChildName,
        splitFrom: parentId,
        createdBy: createdByEmail,
        createdAt: serverTimestamp(),
        status: 'creado',
        updatedAt: serverTimestamp()
    });

    await batch.commit();
}

/**
 * Saves a new service order and automatically splits it if multiple guides/drivers are assigned.
 * This mimics the behavior of saveEditedServiceOrder but for new orders.
 */
export async function saveServiceOrderWithSplit(orderData: ServiceOrderData, createdByEmail: string, forceSplitMode: boolean = false): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");

    const batch = writeBatch(db);
    const parentBaseName = formatOrderName(getFirstDateFromServices(orderData.services), orderData.file);

    // Analyze service distribution
    const guideServiceMap = new Map<string, any[]>();
    const driverServiceMap = new Map<string, any[]>();

    const mainGuide = orderData.guia || "SIN GUIA PRINCIPAL";

    orderData.services.forEach(service => {
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

    if (!needsSplit) {
        // No split needed, create a single order
        const newOrderPayload: any = {
            orderName: parentBaseName,
            createdBy: createdByEmail,
            data: orderData,
            status: 'creado',
            isRoot: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = doc(collection(db, 'serviceOrders'));
        batch.set(docRef, newOrderPayload);
    } else {
        // Split needed: create parent + children
        const parentRef = doc(collection(db, 'serviceOrders'));
        const parentId = parentRef.id;

        // Create parent order marked as split and root
        batch.set(parentRef, {
            orderName: parentBaseName,
            createdBy: createdByEmail,
            data: { ...orderData, isSplitParent: true },
            status: 'creado',
            isRoot: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Create child orders for each guide
        for (const [guide, services] of guideServiceMap.entries()) {
            const childDataPayload: ServiceOrderData = { ...orderData, services, guia: guide };
            const childName = childNameFrom(parentBaseName, guide, null);
            const childRef = doc(collection(db, 'serviceOrders'));
            batch.set(childRef, {
                data: childDataPayload,
                orderName: childName,
                splitFrom: parentId,
                createdBy: createdByEmail,
                createdAt: serverTimestamp(),
                status: 'creado',
                updatedAt: serverTimestamp()
            });
        }

        // Create child orders for each driver
        for (const [driver, services] of driverServiceMap.entries()) {
            // Collect all unique guides working with this driver
            const guidesList = services
                .map(s => (s.guia || orderData.guia)?.trim())
                .filter(Boolean);
            const guidesForDriver = Array.from(new Set(guidesList));
            const guidesString = guidesForDriver.join(', ');

            const childDataPayload: ServiceOrderData = { ...orderData, services, guia: guidesString };
            const childName = childNameFrom(parentBaseName, null, driver);
            const childRef = doc(collection(db, 'serviceOrders'));
            batch.set(childRef, {
                data: childDataPayload,
                orderName: childName,
                splitFrom: parentId,
                createdBy: createdByEmail,
                createdAt: serverTimestamp(),
                status: 'creado',
                updatedAt: serverTimestamp()
            });
        }
    }

    await batch.commit();
}

export async function saveEditedServiceOrder(
    originalOrder: StoredServiceOrder,
    updatedData: ServiceOrderData,
    userEmail: string
): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");

    // --- NEW LOGIC: Check if we are editing a child or a parent ---
    const isEditingChild = !!originalOrder.splitFrom;

    if (isEditingChild) {
        // --- CASE 1: Editing a child order ---
        // Simply update this one document. Do not affect parent or siblings.
        const childRef = doc(db, 'serviceOrders', originalOrder.id);
        await updateDoc(childRef, {
            data: updatedData,
            status: 'editado',
            updatedAt: serverTimestamp()
        });

    } else {
        // --- CASE 2: Editing a parent order ---
        // This will trigger the full re-split logic.
        const batch = writeBatch(db);
        const parentId = originalOrder.id;
        const parentRef = doc(db, 'serviceOrders', parentId);
        const parentBaseName = getBaseName(originalOrder.orderName);

        // --- Delete all existing children before creating new ones ---
        const existingChildren = await getChildrenByParentId(parentId);
        existingChildren.forEach(child => {
            const childRef = doc(db!, 'serviceOrders', child.id);
            batch.delete(childRef); // Permanently delete old children
        });

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
        const wasSplitSeparated = originalOrder.data.isSplitSeparated === true;

        if (!needsSplit) {
            // If no split is needed, just update the main order and ensure it's not marked as a split parent.
            batch.update(parentRef, {
                data: { ...updatedData, isSplitParent: false, isSplitSeparated: false }, // Explicitly set flags to false
                status: 'editado',
                updatedAt: serverTimestamp()
            });
        } else if (wasSplitSeparated && guideServiceMap.size === 1 && driverServiceMap.size === 1) {
            // Special case: was split separated and still has 1 guide + 1 driver
            // Recreate as split separated (2 identical child orders)
            const guide = Array.from(guideServiceMap.keys())[0];
            const driver = Array.from(driverServiceMap.keys())[0];

            // Create child order for the guide (with all services)
            const guideChildName = childNameFrom(parentBaseName, guide, null);
            const guideChildRef = doc(collection(db, 'serviceOrders'));
            batch.set(guideChildRef, {
                data: { ...updatedData, isSplitSeparated: true },
                orderName: guideChildName,
                splitFrom: parentId,
                createdBy: originalOrder.createdBy,
                createdAt: Timestamp.fromDate(originalOrder.createdAt),
                status: 'creado',
                updatedAt: serverTimestamp()
            });

            // Create child order for the driver (with all services)
            const driverChildName = childNameFrom(parentBaseName, null, driver);
            const driverChildRef = doc(collection(db, 'serviceOrders'));
            batch.set(driverChildRef, {
                data: { ...updatedData, isSplitSeparated: true },
                orderName: driverChildName,
                splitFrom: parentId,
                createdBy: originalOrder.createdBy,
                createdAt: Timestamp.fromDate(originalOrder.createdAt),
                status: 'creado',
                updatedAt: serverTimestamp()
            });

            // Update the parent order to mark it as split separated
            batch.update(parentRef, {
                data: { ...updatedData, isSplitParent: true, isSplitSeparated: true },
                status: 'editado',
                updatedAt: serverTimestamp()
            });
        } else {
            // Standard divided split: Create new children for guides and drivers
            // Create new children for guides
            for (const [guide, services] of guideServiceMap.entries()) {
                const childDataPayload: ServiceOrderData = { ...updatedData, services, guia: guide };
                const childName = childNameFrom(parentBaseName, guide, null);
                const newDocRef = doc(collection(db, 'serviceOrders'));
                batch.set(newDocRef, {
                    data: childDataPayload,
                    orderName: childName,
                    splitFrom: parentId,
                    createdBy: originalOrder.createdBy,
                    createdAt: Timestamp.fromDate(originalOrder.createdAt), // Carry over original creation data
                    status: 'creado',
                    updatedAt: serverTimestamp()
                });
            }

            // Create new children for drivers
            for (const [driver, services] of driverServiceMap.entries()) {
                const guidesList = services
                    .map(s => (s.guia || updatedData.guia)?.trim())
                    .filter(Boolean);
                const guidesForDriver = Array.from(new Set(guidesList));
                const guidesString = guidesForDriver.join(', ');

                const childDataPayload: ServiceOrderData = { ...updatedData, services, guia: guidesString };
                const childName = childNameFrom(parentBaseName, null, driver);
                const newDocRef = doc(collection(db, 'serviceOrders'));
                batch.set(newDocRef, {
                    data: childDataPayload,
                    orderName: childName,
                    splitFrom: parentId,
                    createdBy: originalOrder.createdBy,
                    createdAt: Timestamp.fromDate(originalOrder.createdAt), // Carry over original creation data
                    status: 'creado',
                    updatedAt: serverTimestamp()
                });
            }

            // Update the parent order to mark it as a split parent (but not split separated)
            batch.update(parentRef, {
                data: { ...updatedData, isSplitParent: true, isSplitSeparated: false }, // Set the flag on the parent's data
                status: 'editado',
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();
    }
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

    console.log(`📊 getAllServiceOrders() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

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

export async function getTotalServiceOrdersCount(): Promise<number> {
    if (!db) throw new Error("Firestore not initialized.");
    const ordersRef = collection(db, 'serviceOrders');

    // 1. Get count of documents specifically marked as roots
    const rootQuery = query(ordersRef, where('isRoot', '==', true));
    const rootSnapshot = await getCountFromServer(rootQuery);
    let rootCount = rootSnapshot.data().count;

    // 2. Get total document count for context
    const totalSnapshot = await getCountFromServer(ordersRef);
    const totalCount = totalSnapshot.data().count;

    // Fallback: If rootCount is suspiciously low compared to totalCount, 
    // it's likely old data hasn't been migrated.
    // We assume roughly 1/3 of docs are roots (parent + 2 children avg)
    // If roots < 5% of total, we use totalCount/2 as a safe estimate for UI
    if (rootCount < totalCount * 0.05 && totalCount > 10) {
        console.warn(`⚠️ Low root count (${rootCount}/${totalCount}). UI might be using estimated pagination.`);
        return Math.ceil(totalCount / 2.5); // Heuristic until migration
    }

    console.log(`📊 getTotalServiceOrdersCount() - Counted ${rootCount} root orders.`);
    return rootCount;
}

/**
 * One-time migration to tag all existing non-child orders as roots.
 * This fixes the pagination count for old data.
 */
export async function runMigrateRoots(): Promise<number> {
    if (!db) throw new Error("Firestore not initialized.");
    const ordersRef = collection(db, 'serviceOrders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    let migratedCount = 0;
    const batch = writeBatch(db);

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        // If it's not a child (no splitFrom) and doesn't have isRoot yet
        if (!data.splitFrom && !data.isRoot) {
            batch.update(docSnap.ref, { isRoot: true });
            migratedCount++;
        }
    });

    if (migratedCount > 0) {
        await batch.commit();
    }

    return migratedCount;
}

export async function getServiceOrdersPaginated(
    pageSize: number = 10,
    lastVisible: QueryDocumentSnapshot | null = null
): Promise<{ orders: StoredServiceOrder[], lastDoc: QueryDocumentSnapshot | null }> {
    if (!db) throw new Error("Firestore not initialized.");

    const ordersRef = collection(db, 'serviceOrders');
    let parents: StoredServiceOrder[] = [];
    let currentLastDoc: QueryDocumentSnapshot | null = lastVisible;
    let iterations = 0;
    const MAX_ITERATIONS = 3; // Basic safety

    while (parents.length < pageSize && iterations < MAX_ITERATIONS) {
        iterations++;

        let q = query(
            ordersRef,
            orderBy('createdAt', 'desc'),
            limit(pageSize * 2)
        );

        if (currentLastDoc) {
            q = query(q, startAfter(currentLastDoc));
        }

        const snapshot = await getDocs(q);
        console.log(`📊 getServiceOrdersPaginated (Batch ${iterations}) - Read ${snapshot.size} documents`);

        if (snapshot.empty) break;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // It's a root/parent if it has no splitFrom
            if (!data.splitFrom) {
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

                parents.push({
                    id: docSnap.id,
                    ...data,
                    createdAt,
                    updatedAt,
                    status: data.status || 'creado'
                } as StoredServiceOrder);

                if (parents.length === pageSize) {
                    currentLastDoc = docSnap;
                    break;
                }
            }
            currentLastDoc = docSnap;
        }

        if (snapshot.size < pageSize * 2) break; // End of collection
    }

    if (parents.length === 0) return { orders: [], lastDoc: null };

    // Fetch children for these parents
    const parentIds = parents.map(p => p.id);
    const children: StoredServiceOrder[] = [];

    if (parentIds.length > 0) {
        const childrenQ = query(ordersRef, where('splitFrom', 'in', parentIds));
        const childrenSnap = await getDocs(childrenQ);
        console.log(`📊 getServiceOrdersPaginated (Children) - Read ${childrenSnap.size} children`);

        childrenSnap.forEach(docSnap => {
            const data = docSnap.data();
            const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
            const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

            children.push({
                id: docSnap.id,
                ...data,
                createdAt,
                updatedAt,
                status: data.status || 'creado'
            } as StoredServiceOrder);
        });
    }

    return {
        orders: [...parents, ...children],
        lastDoc: currentLastDoc
    };
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
        const orderRef = doc(db!, 'serviceOrders', id);
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
    const orderRef = doc(db!, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'cancelado',
        updatedAt: serverTimestamp()
    });
}


export async function recoverServiceOrder(orderId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const orderRef = doc(db!, 'serviceOrders', orderId);
    await updateDoc(orderRef, {
        status: 'editado',
        deletedBy: '',
        updatedAt: serverTimestamp()
    });
}
