import { db } from './firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        if (!db) {
            console.error('Firestore not initialized');
            return false;
        }

        // Usamos un documento específico en lugar de una consulta de colección
        // Esto permite configurar una regla de lectura pública más segura
        const { doc, getDoc } = await import('firebase/firestore');
        const healthDoc = doc(db, 'appConfig', 'healthCheck');
        await getDoc(healthDoc);

        return true;
    } catch (error) {
        console.error('Database connection check failed:', error);
        return false;
    }
}
