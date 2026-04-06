

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
import { formatOrderName, parseDateDDMMYYYY } from './formatters';
import { childNameFrom, getBaseName } from './serviceOrderFamily';

// --- Caching Configuration for Search/Timeline ---
const SEARCH_CACHE_KEY = 'tourfile_orders_cache';
const SEARCH_SYNC_KEY = 'tourfile_orders_last_sync';

// Lock mechanism to prevent duplicate saves from concurrent edits
const saveLocks = new Set<string>();

/**
 * Clear the search cache - useful after significant changes or to force a full refresh.
 */
export function clearServiceOrdersSearchCache() {
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SEARCH_CACHE_KEY);
        sessionStorage.removeItem(SEARCH_SYNC_KEY);
        console.log('🗑️ Cache de búsqueda de órdenes eliminado.');
    }
}

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
    hasLiquidation?: boolean;
}


function getFirstDateFromServices(services: ServiceOrderData['services']): Date {
    if (!services || services.length === 0) {
        return new Date();
    }
    const sortedServices = [...services].sort((a, b) => {
        try {
            const dateA = parseDateDDMMYYYY(a.fecha)?.getTime() ?? new Date().getTime();
            const dateB = parseDateDDMMYYYY(b.fecha)?.getTime() ?? new Date().getTime();
            if (dateA !== dateB) return dateA - dateB;
        } catch { }
        return a.hora.localeCompare(b.hora);
    });
    try {
        const firstServiceDate = sortedServices[0].fecha;
        const parsed = parseDateDDMMYYYY(firstServiceDate);
        return parsed || new Date();
    } catch (e) {
        console.error("Could not parse date from service, falling back to today.", e);
        return new Date();
    }
}

/**
 * OPTIMIZACIÓN: Extrae todos los responsables únicos de una orden (guías y choferes)
 * Esto permite búsqueda eficiente por responsable con array-contains
 */
function extractAllResponsibles(orderData: ServiceOrderData): string[] {
    const responsibles = new Set<string>();
    
    // Agregar guía principal
    if (orderData.guia && orderData.guia.trim() && orderData.guia.toUpperCase() !== 'NONE') {
        responsibles.add(orderData.guia.trim().toUpperCase());
    }
    
    // Agregar guías y choferes de servicios
    if (orderData.services && Array.isArray(orderData.services)) {
        orderData.services.forEach(service => {
            if (service.guia && service.guia.trim() && service.guia.toUpperCase() !== 'NONE') {
                responsibles.add(service.guia.trim().toUpperCase());
            }
            if (service.chofer && service.chofer.trim() && service.chofer.toUpperCase() !== 'NONE') {
                responsibles.add(service.chofer.trim().toUpperCase());
            }
        });
    }
    
    return Array.from(responsibles).sort();
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
        allResponsibles: extractAllResponsibles(orderData), // OPTIMIZACIÓN: Para búsqueda rápida
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
        allResponsibles: extractAllResponsibles(orderData),
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
        updatedAt: serverTimestamp(),
        allResponsibles: extractAllResponsibles(orderData),
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
        updatedAt: serverTimestamp(),
        allResponsibles: extractAllResponsibles(orderData),
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
            allResponsibles: extractAllResponsibles(orderData),
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
            allResponsibles: extractAllResponsibles(orderData),
        });

        // Create child orders for each guide
        for (const [guide, services] of guideServiceMap.entries()) {
            const childDataPayload: ServiceOrderData = { ...orderData, services, guia: guide };
            const childName = childNameFrom(parentBaseName, guide, null);
            const childRef = doc(collection(db, 'serviceOrders'));
            batch.set(childRef, {
                data: childDataPayload,
                orderName: childName,
                allResponsibles: extractAllResponsibles(childDataPayload),
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
                allResponsibles: extractAllResponsibles(childDataPayload),
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

    // --- PROTECTION: Prevent concurrent saves of the same order ---
    const lockKey = `edit-${originalOrder.id}`;
    if (saveLocks.has(lockKey)) {
        console.warn(`⚠️ Guardado duplicado bloqueado para orden ${originalOrder.orderName}`);
        throw new Error("Esta orden ya se está guardando. Por favor espera unos segundos.");
    }

    saveLocks.add(lockKey);
    try {
        await _performSaveEditedServiceOrder(originalOrder, updatedData, userEmail);
    } finally {
        saveLocks.delete(lockKey);
    }
}

async function _performSaveEditedServiceOrder(
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
            allResponsibles: extractAllResponsibles(updatedData),
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
                allResponsibles: extractAllResponsibles(updatedData),
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
            const guideChildData = { ...updatedData, isSplitSeparated: true };
            batch.set(guideChildRef, {
                data: guideChildData,
                orderName: guideChildName,
                allResponsibles: extractAllResponsibles(guideChildData),
                splitFrom: parentId,
                createdBy: originalOrder.createdBy,
                createdAt: Timestamp.fromDate(originalOrder.createdAt),
                status: 'creado',
                updatedAt: serverTimestamp()
            });

            // Create child order for the driver (with all services)
            const driverChildName = childNameFrom(parentBaseName, null, driver);
            const driverChildRef = doc(collection(db, 'serviceOrders'));
            const driverChildData = { ...updatedData, isSplitSeparated: true };
            batch.set(driverChildRef, {
                data: driverChildData,
                orderName: driverChildName,
                allResponsibles: extractAllResponsibles(driverChildData),
                splitFrom: parentId,
                createdBy: originalOrder.createdBy,
                createdAt: Timestamp.fromDate(originalOrder.createdAt),
                status: 'creado',
                updatedAt: serverTimestamp()
            });

            // Update the parent order to mark it as split separated
            const parentData = { ...updatedData, isSplitParent: true, isSplitSeparated: true };
            batch.update(parentRef, {
                data: parentData,
                allResponsibles: extractAllResponsibles(parentData),
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
                    allResponsibles: extractAllResponsibles(childDataPayload),
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
                    allResponsibles: extractAllResponsibles(childDataPayload),
                    splitFrom: parentId,
                    createdBy: originalOrder.createdBy,
                    createdAt: Timestamp.fromDate(originalOrder.createdAt), // Carry over original creation data
                    status: 'creado',
                    updatedAt: serverTimestamp()
                });
            }

            // Update the parent order to mark it as a split parent (but not split separated)
            const parentData = { ...updatedData, isSplitParent: true, isSplitSeparated: false };
            batch.update(parentRef, {
                data: parentData, // Set the flag on the parent's data
                allResponsibles: extractAllResponsibles(parentData),
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

/**
 * Marks all service orders matching the given IDs with hasLiquidation=true.
 * Called after saving a liquidation so the flag is embedded in the order document.
 */
export async function markOrdersWithLiquidation(orderIds: string[]): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const batch = writeBatch(db);
    for (const id of orderIds) {
        batch.update(doc(db, 'serviceOrders', id), { hasLiquidation: true });
    }
    await batch.commit();
    clearServiceOrdersSearchCache();
}

/**
 * Clears hasLiquidation flag from service orders when all liquidations for a file are deleted.
 * Only unmarks if no remaining liquidations reference those order IDs.
 */
export async function unmarkOrdersWithLiquidation(orderIds: string[]): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const batch = writeBatch(db);
    for (const id of orderIds) {
        batch.update(doc(db, 'serviceOrders', id), { hasLiquidation: false });
    }
    await batch.commit();
    clearServiceOrdersSearchCache();
}

/**
 * Fetches all service orders using a Delta Sync strategy.
 * It only downloads documents that have changed since the last sync in the current session.
 * Greatly reduces reads for search and timeline views.
 */
export async function getAllServiceOrders(): Promise<StoredServiceOrder[]> {
    if (!db) throw new Error("Firestore not initialized.");

    // 1. Try to load from Session Storage
    let cachedOrders: any[] = [];
    let lastSyncTimestamp = 0;

    if (typeof window !== 'undefined') {
        const storedOrders = sessionStorage.getItem(SEARCH_CACHE_KEY);
        const storedSync = sessionStorage.getItem(SEARCH_SYNC_KEY);
        if (storedOrders) cachedOrders = JSON.parse(storedOrders);
        if (storedSync) lastSyncTimestamp = parseInt(storedSync, 10);
    }

    const ordersRef = collection(db, 'serviceOrders');
    let q;

    if (lastSyncTimestamp > 0) {
        // Incrementally fetch only what changed
        // We look for updates since (lastSync - 5 seconds) to handle clock skews and overlapping updates
        q = query(
            ordersRef,
            where('updatedAt', '>', Timestamp.fromMillis(lastSyncTimestamp - 5000)),
            orderBy('updatedAt', 'desc')
        );
        console.log(`🔍 Iniciando sincronización incremental del buscador (Desde: ${new Date(lastSyncTimestamp).toLocaleTimeString()})...`);
    } else {
        // First download of the session
        q = query(ordersRef, orderBy('createdAt', 'desc'), limit(3000));
        console.log('📊 Descargando catálogo completo de órdenes por primera vez en esta sesión...');
    }

    try {
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            console.log(`📊 Sincronizados ${snapshot.size} cambios/registros desde Firebase (${snapshot.size} reads)`);

            const newDeltas = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    ...data,
                    id: docSnap.id,
                    // Store as milliseconds for JSON compatibility
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (data.updatedAt || Date.now())
                };
            });

            // Merge deltas with existing cache
            const mergedMap = new Map();
            cachedOrders.forEach(o => mergedMap.set(o.id, o));
            newDeltas.forEach(o => mergedMap.set(o.id, o));

            const finalOrders = Array.from(mergedMap.values());

            // Save back to sessionStorage
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(finalOrders));
                sessionStorage.setItem(SEARCH_SYNC_KEY, Date.now().toString());
            }

            cachedOrders = finalOrders;
        } else {
            console.log('✅ Buscador al día. 0 lecturas adicionales.');
        }

        // Return processed orders (convert flat JSON back to Date objects)
        return cachedOrders.map(o => ({
            ...o,
            createdAt: new Date(o.createdAt),
            updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
            status: o.status || 'creado'
        } as StoredServiceOrder)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
        console.error("Error in Delta Sync fetching:", error);
        // Fallback to cache if exists, otherwise empty
        return cachedOrders.map(o => ({
            ...o,
            createdAt: new Date(o.createdAt),
            updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
        } as StoredServiceOrder));
    }
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
    lastVisible: QueryDocumentSnapshot | null = null,
    excludeDeleted: boolean = true
): Promise<{ orders: StoredServiceOrder[], lastDoc: QueryDocumentSnapshot | null }> {
    if (!db) throw new Error("Firestore not initialized.");

    const ordersRef = collection(db, 'serviceOrders');
    const parents: StoredServiceOrder[] = [];
    let currentCursor = lastVisible;
    let currentLastDoc: QueryDocumentSnapshot | null = null;

    // Strategy: Keep fetching batches of parent orders (isRoot=true) until we have pageSize parents
    // This handles cases where some orders don't have isRoot field yet
    while (parents.length < pageSize) {
        let q = query(
            ordersRef,
            where('isRoot', '==', true),
            orderBy('createdAt', 'desc'),
            limit(pageSize * 3) // Load extra to ensure we get enough after filtering
        );

        if (currentCursor) {
            q = query(q, startAfter(currentCursor));
        }

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            // No more documents
            break;
        }

        // Process this batch
        snapshot.docs.forEach(docSnap => {
            if (parents.length < pageSize) {
                const data = docSnap.data();
                const orderStatus = data.status || 'creado';
                
                // Si excludeDeleted=true, saltar órdenes eliminadas/canceladas
                if (excludeDeleted && (orderStatus === 'eliminado' || orderStatus === 'cancelado')) {
                    return; // Skip esta orden
                }
                
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

                parents.push({
                    id: docSnap.id,
                    ...data,
                    createdAt,
                    updatedAt,
                    status: orderStatus
                } as StoredServiceOrder);
            }
        });

        currentLastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        // If we have enough parents, use the last parent as cursor
        if (parents.length >= pageSize) {
            const lastParentIndex = snapshot.docs.findIndex(doc => doc.id === parents[parents.length - 1].id);
            if (lastParentIndex >= 0) {
                currentLastDoc = snapshot.docs[lastParentIndex];
            }
            break;
        }

        currentCursor = currentLastDoc;
    }

    console.log(`📊 getServiceOrdersPaginated - Found ${parents.length} parents with isRoot (excludeDeleted: ${excludeDeleted})`);

    if (parents.length === 0) {
        return { orders: [], lastDoc: null };
    }

    // Now fetch ALL children for these parents
    const parentIds = parents.map(p => p.id);
    const allChildren: StoredServiceOrder[] = [];

    if (parentIds.length > 0) {
        // Firestore 'in' queries support up to 10 items, so batch if needed
        for (let i = 0; i < parentIds.length; i += 10) {
            const batchIds = parentIds.slice(i, i + 10);
            const childrenQ = query(ordersRef, where('splitFrom', 'in', batchIds));
            const childrenSnap = await getDocs(childrenQ);
            console.log(`📊 getServiceOrdersPaginated - Read ${childrenSnap.size} children for batch ${i / 10 + 1}`);

            childrenSnap.forEach(docSnap => {
                const data = docSnap.data();
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

                allChildren.push({
                    id: docSnap.id,
                    ...data,
                    createdAt,
                    updatedAt,
                    status: data.status || 'creado'
                } as StoredServiceOrder);
            });
        }
    }

    return {
        orders: [...parents, ...allChildren],
        lastDoc: currentLastDoc
    };
}

/**
 * Get paginated deleted orders (only for admin)
 * Fetches only orders with status='eliminado'
 */
export async function getDeletedOrdersPaginated(
    pageSize: number = 10,
    lastVisible: QueryDocumentSnapshot | null = null
): Promise<{ orders: StoredServiceOrder[], lastDoc: QueryDocumentSnapshot | null }> {
    if (!db) throw new Error("Firestore not initialized.");

    const ordersRef = collection(db, 'serviceOrders');
    const parents: StoredServiceOrder[] = [];
    let currentCursor = lastVisible;
    let currentLastDoc: QueryDocumentSnapshot | null = null;

    // Fetch only deleted parent orders
    while (parents.length < pageSize) {
        let q = query(
            ordersRef,
            where('isRoot', '==', true),
            where('status', '==', 'eliminado'),
            orderBy('createdAt', 'desc'),
            limit(pageSize * 2)
        );

        if (currentCursor) {
            q = query(q, startAfter(currentCursor));
        }

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            break;
        }

        snapshot.docs.forEach(docSnap => {
            if (parents.length < pageSize) {
                const data = docSnap.data();
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

                parents.push({
                    id: docSnap.id,
                    ...data,
                    createdAt,
                    updatedAt,
                    status: data.status || 'creado'
                } as StoredServiceOrder);
            }
        });

        currentLastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        if (parents.length >= pageSize) {
            const lastParentIndex = snapshot.docs.findIndex(doc => doc.id === parents[parents.length - 1].id);
            if (lastParentIndex >= 0) {
                currentLastDoc = snapshot.docs[lastParentIndex];
            }
            break;
        }

        currentCursor = currentLastDoc;
    }

    console.log(`📊 getDeletedOrdersPaginated - Found ${parents.length} deleted parents`);

    if (parents.length === 0) {
        return { orders: [], lastDoc: null };
    }

    // Fetch children for these deleted parents
    const parentIds = parents.map(p => p.id);
    const allChildren: StoredServiceOrder[] = [];

    if (parentIds.length > 0) {
        for (let i = 0; i < parentIds.length; i += 10) {
            const batchIds = parentIds.slice(i, i + 10);
            const childrenQ = query(ordersRef, where('splitFrom', 'in', batchIds));
            const childrenSnap = await getDocs(childrenQ);

            childrenSnap.forEach(docSnap => {
                const data = docSnap.data();
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

                allChildren.push({
                    id: docSnap.id,
                    ...data,
                    createdAt,
                    updatedAt,
                    status: data.status || 'creado'
                } as StoredServiceOrder);
            });
        }
    }

    return {
        orders: [...parents, ...allChildren],
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
