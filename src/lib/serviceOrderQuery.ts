
import { db } from '@/lib/firebase';
import { collection, query, getDocs, documentId, where, orderBy } from 'firebase/firestore';
import { StoredServiceOrder } from './serviceOrderStorage';
import { Timestamp } from 'firebase/firestore';

export interface OrderHeader {
    id: string;
    orderName: string;
}

// Fetches ALL order names to parse dates from strings (as requested by user)
// This is necessary because Firestore can't filter substring "MONTH_YEAR" efficiently
export async function getAllOrderHeaders(): Promise<OrderHeader[]> {
    if (!db) throw new Error("Firestore not initialized.");
    const ordersRef = collection(db, 'serviceOrders');

    // We fetch all. In a massive DB this should be paginated or edge-functioned, 
    // but for <10k records this is acceptable for an admin report tool.
    // We assume 'orderName' is small.
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    console.log(`📊 getAllOrderHeaders() - Read ${snapshot.size} documents (${snapshot.size} reads) for report mapping`);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        orderName: doc.data().orderName || ''
    }));
}

// Batch fetch documents by ID
export async function getServiceOrdersByIds(ids: string[]): Promise<StoredServiceOrder[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (ids.length === 0) return [];

    const ordersRef = collection(db, 'serviceOrders');
    const orders: StoredServiceOrder[] = [];

    // Firestore 'in' limit is 10 (or 30 depending on version). 
    // Easier to promise.all fetches using documentId, or just fetch individual docs if list is small.
    // Actually, 'documentId' 'in' [...] works for up to 10 items.
    // For bulk download (e.g. 50 files), it's better to chunk.

    const CHUNK_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
        const q = query(ordersRef, where(documentId(), 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
                updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
            } as StoredServiceOrder);
        });
    }

    return orders;
}
