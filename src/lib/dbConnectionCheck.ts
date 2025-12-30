import { db } from './firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        if (!db) {
            console.error('Firestore not initialized');
            return false;
        }

        // Try to fetch a single document from any collection to verify connection
        // Using a lightweight query to minimize data transfer
        const testQuery = query(collection(db, 'serviceOrders'), limit(1));
        await getDocs(testQuery);

        return true;
    } catch (error) {
        console.error('Database connection check failed:', error);
        return false;
    }
}
