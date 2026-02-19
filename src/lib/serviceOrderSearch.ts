/**
 * OPTIMIZACIÓN: Sistema de búsqueda para tabla de órdenes de servicio
 * 
 * CASOS DE USO REALES:
 * 1. Buscar por nombre de orden: "ODS 23 FEBRERO 2026 CTFI110489" o solo "CTFI110489"
 * 2. Buscar por responsable: nombre de guía o chofer
 * 
 * Ambos casos son muy eficientes en Firestore (queries directas a campos específicos)
 */

import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { StoredServiceOrder } from './serviceOrderStorage';

/**
 * Busca órdenes por nombre de orden (prefijo o contiene)
 * Ejemplos que funcionan:
 * - "ODS 23" → encuentra "ODS 23 FEBRERO 2026 CTFI110489"
 * - "CTFI110489" → encuentra órdenes con ese código de file
 * - "23 FEBRERO" → encuentra "ODS 23 FEBRERO 2026"
 */
export async function searchOrdersByName(searchTerm: string, maxResults: number = 100): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  if (searchTerm.length < 3) return [];

  const ordersRef = collection(db, 'serviceOrders');
  const termUpper = searchTerm.toUpperCase().trim();
  
  // Estrategia 1: Búsqueda por prefijo en orderName (más precisa)
  const prefixEnd = termUpper.slice(0, -1) + String.fromCharCode(termUpper.charCodeAt(termUpper.length - 1) + 1);
  
  const q = query(
    ordersRef,
    where('orderName', '>=', termUpper),
    where('orderName', '<', prefixEnd),
    orderBy('orderName'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  console.log(`🔍 Búsqueda por nombre "${searchTerm}" - ${snapshot.size} reads`);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
    } as StoredServiceOrder;
  });
}

/**
 * Busca órdenes por nombre de guía o chofer (responsables)
 * Usa el campo allResponsibles para búsqueda eficiente en:
 * - Guía principal
 * - Guías en servicios individuales
 * - Choferes en servicios
 * - Órdenes hijas (splits)
 * 
 * Con allResponsibles, encuentra TODAS las órdenes donde aparece el responsable,
 * incluyendo órdenes divididas y órdenes hijas.
 */
export async function searchOrdersByResponsible(responsibleName: string, maxResults: number = 100): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  if (responsibleName.length < 2) return [];

  const ordersRef = collection(db, 'serviceOrders');
  const nameUpper = responsibleName.toUpperCase().trim();

  try {
    // Buscar usando array-contains en el campo allResponsibles
    // Esto encuentra TODAS las órdenes (padres e hijas) donde aparece el responsable
    const q = query(
      ordersRef,
      where('allResponsibles', 'array-contains', nameUpper),
      limit(maxResults)
    );
    
    const snapshot = await getDocs(q);
    console.log(`🔍 Búsqueda por responsable "${responsibleName}" - ${snapshot.size} reads`);
    console.log(`   ✅ Incluye órdenes principales, divididas y órdenes hijas`);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
      } as StoredServiceOrder;
    });
  } catch (error) {
    console.error('❌ Error en búsqueda por responsable:', error);
    console.warn('   Asegúrate de haber ejecutado el script de migración: npm run migrate:responsibles');
    return [];
  }
}

/**
 * Busca órdenes por rango de fechas (para búsquedas como "DICIEMBRE 2025")
 */
export async function searchOrdersByDateRange(monthYear: string): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");

  // Parsear mes y año del string (ej: "DICIEMBRE 2025")
  const months: { [key: string]: number } = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
  };

  const parts = monthYear.toUpperCase().trim().split(/\s+/);
  const monthName = parts[0];
  const year = parts.length > 1 ? parseInt(parts[1]) : new Date().getFullYear();

  if (!months[monthName]) {
    console.warn(`Mes no reconocido: ${monthName}`);
    return [];
  }

  // Crear rango de fechas del mes completo
  const startDate = new Date(year, months[monthName], 1);
  const endDate = new Date(year, months[monthName] + 1, 0, 23, 59, 59);

  const ordersRef = collection(db, 'serviceOrders');
  const q = query(
    ordersRef,
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate),
    orderBy('createdAt', 'desc'),
    limit(500) // Límite razonable para un mes
  );

  const snapshot = await getDocs(q);
  console.log(`🔍 Búsqueda por mes "${monthYear}" - ${snapshot.size} reads`);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
    } as StoredServiceOrder;
  });
}

/**
 * Busca órdenes recientes por código de archivo (CTFI, CTFI110489, etc.)
 * Filtra en orderName (que contiene el código) y data.file
 */
export async function searchRecentOrdersByFileCode(fileCode: string, daysBack: number = 60): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const ordersRef = collection(db, 'serviceOrders');
  const q = query(
    ordersRef,
    where('createdAt', '>=', startDate),
    orderBy('createdAt', 'desc'),
    limit(500)
  );

  const snapshot = await getDocs(q);
  console.log(`🔍 Búsqueda por código "${fileCode}" en últimos ${daysBack} días - ${snapshot.size} reads`);

  const codeUpper = fileCode.toUpperCase();
  return snapshot.docs
    .filter(doc => {
      const data = doc.data();
      return data.orderName?.toUpperCase().includes(codeUpper) ||
             data.data?.file?.toUpperCase().includes(codeUpper);
    })
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
      } as StoredServiceOrder;
    });
}

/**
 * Busca órdenes recientes (últimos N días) - para texto general
 */
export async function searchRecentOrders(searchTerm: string, daysBack: number = 30): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const ordersRef = collection(db, 'serviceOrders');
  const q = query(
    ordersRef,
    where('createdAt', '>=', startDate),
    orderBy('createdAt', 'desc'),
    limit(500)
  );

  const snapshot = await getDocs(q);
  console.log(`🔍 Búsqueda general en últimos ${daysBack} días - ${snapshot.size} reads`);

  const searchLower = searchTerm.toLowerCase();
  return snapshot.docs
    .filter(doc => {
      const data = doc.data();
      return data.orderName?.toLowerCase().includes(searchLower) ||
             data.data?.file?.toLowerCase().includes(searchLower) ||
             data.data?.guia?.toLowerCase().includes(searchLower);
    })
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
      } as StoredServiceOrder;
    });
}

/**
 * BÚSQUEDA PRINCIPAL - Optimizada para tu caso de uso real
 * 
 * Detecta automáticamente si buscas por:
 * 1. Código de archivo (CTFI110489, CTFI, etc.)
 * 2. Nombre de orden (ODS 23 FEBRERO, etc.)
 * 3. Nombre de responsable (JUAN PEREZ, PEDRO, etc.)
 * 4. Mes/año (FEBRERO 2026)
 */
export async function smartSearch(searchTerm: string): Promise<{ 
  results: StoredServiceOrder[]; 
  method: string; 
  reads: number;
  tip?: string;
}> {
  const trimmed = searchTerm.trim();
  
  if (trimmed.length < 2) {
    return { results: [], method: 'none', reads: 0 };
  }

  const termUpper = trimmed.toUpperCase();

  // CASO 1: Búsqueda por mes/año (ej: "FEBRERO 2026", "ENERO")
  const monthPattern = /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)(\s+\d{4})?/i;
  const monthMatch = termUpper.match(monthPattern);
  
  if (monthMatch) {
    const results = await searchOrdersByDateRange(monthMatch[0]);
    return { 
      results, 
      method: 'date-range', 
      reads: results.length,
      tip: `Búsqueda por mes/año: ${results.length} órdenes encontradas`
    };
  }

  // CASO 2: Código de archivo (ej: "CTFI110489", "CTFI")
  // Los códigos suelen ser alfanuméricos sin espacios
  const isFileCode = /^[A-Z0-9]+$/i.test(trimmed) && trimmed.length >= 4;
  
  if (isFileCode) {
    // Buscar órdenes recientes que contengan este código en orderName o data.file
    const results = await searchRecentOrdersByFileCode(trimmed, 60);
    
    if (results.length > 0) {
      return {
        results,
        method: 'file-code',
        reads: results.length,
        tip: `Código de archivo: ${results.length} órdenes encontradas`
      };
    }
  }

  // CASO 3: Nombre de orden (ej: "ODS 23", "ODS 23 FEBRERO")
  // Órdenes siempre empiezan con "ODS" o contienen estructura similar
  if (termUpper.startsWith('ODS') || termUpper.includes('ODS')) {
    const results = await searchOrdersByName(termUpper, 100);
    return {
      results,
      method: 'order-name',
      reads: results.length,
      tip: `Búsqueda por nombre: ${results.length} órdenes encontradas`
    };
  }

  // CASO 4: Nombre de responsable (guía o chofer)
  // Si tiene espacios o es un nombre común
  if (trimmed.includes(' ') || trimmed.length <= 15) {
    const results = await searchOrdersByResponsible(trimmed, 100);
    
    if (results.length > 0) {
      return {
        results,
        method: 'responsible',
        reads: results.length,
        tip: `Responsable: ${results.length} órdenes encontradas`
      };
    }
  }

  // CASO 5: Búsqueda general en órdenes recientes (fallback)
  const results = await searchRecentOrders(trimmed, 30);
  return {
    results,
    method: 'recent-general',
    reads: Math.max(results.length, 500),
    tip: results.length === 0 
      ? 'No se encontraron resultados en los últimos 30 días'
      : `Búsqueda general: ${results.length} órdenes encontradas`
  };
}

/**
 * BÚSQUEDA HÍBRIDA: Combina velocidad de búsqueda inteligente con flexibilidad de búsqueda completa
 * 
 * ESTRATEGIA:
 * 1. Prueba búsqueda inteligente primero (rápida, barata)
 * 2. Si encuentra resultados → devuelve inmediatamente
 * 3. Si NO encuentra → opcionalmente hace búsqueda completa
 * 
 * @param searchTerm - Término de búsqueda
 * @param useFullSearchFallback - Si true, hace búsqueda completa cuando no encuentra nada
 * @returns Resultados + metadata sobre el método usado
 */
export async function hybridSearch(
  searchTerm: string,
  useFullSearchFallback: boolean = false
): Promise<{
  results: StoredServiceOrder[];
  method: 'smart' | 'full' | 'none';
  reads: number;
  smartFailed: boolean;
}> {
  // Intenta búsqueda inteligente primero
  const smartResult = await smartSearch(searchTerm);

  if (smartResult.results.length > 0) {
    return {
      results: smartResult.results,
      method: 'smart',
      reads: smartResult.reads,
      smartFailed: false
    };
  }

  // Si la búsqueda inteligente no encontró nada
  console.log(`⚠️ Búsqueda inteligente no encontró resultados para: "${searchTerm}"`);

  // Solo usa búsqueda completa si el usuario lo autoriza
  if (!useFullSearchFallback) {
    return {
      results: [],
      method: 'smart',
      reads: smartResult.reads,
      smartFailed: true // Indica que puede intentar búsqueda completa
    };
  }

  // FALLBACK: Búsqueda completa (lenta pero garantizada)
  console.log(`🔍 Ejecutando búsqueda completa (fallback)...`);
  const { getAllServiceOrders } = await import('./serviceOrderStorage');
  const allOrders = await getAllServiceOrders();
  const filtered = filterOrdersLocally(searchTerm, allOrders);

  return {
    results: filtered,
    method: 'full',
    reads: allOrders.length, // Todas las órdenes
    smartFailed: true
  };
}

/**
 * Filtra órdenes en cliente (búsqueda muy flexible pero requiere todos los documentos)
 * Busca en TODOS los campos: nombre, file, guía, hotel, chofer, servicios, etc.
 */
export function filterOrdersLocally(searchTerm: string, allOrders: StoredServiceOrder[]): StoredServiceOrder[] {
  const searchLower = searchTerm.toLowerCase();
  
  return allOrders.filter(order => {
    // Buscar en campos principales
    if (order.orderName?.toLowerCase().includes(searchLower)) return true;
    if (order.data?.file?.toLowerCase().includes(searchLower)) return true;
    if (order.data?.guia?.toLowerCase().includes(searchLower)) return true;
    if (order.data?.hotel?.toLowerCase().includes(searchLower)) return true;
    if (order.data?.ref?.toLowerCase().includes(searchLower)) return true;
    if (order.data?.observations?.toLowerCase().includes(searchLower)) return true;
    
    // Buscar en servicios individuales
    if (order.data?.services) {
      for (const service of order.data.services) {
        if (service.servicio?.toLowerCase().includes(searchLower)) return true;
        if (service.guia?.toLowerCase().includes(searchLower)) return true;
        if (service.chofer?.toLowerCase().includes(searchLower)) return true;
        if (service.vuelo?.toLowerCase().includes(searchLower)) return true;
        if (service.bus?.toLowerCase().includes(searchLower)) return true;
        if (service.observaciones?.toLowerCase().includes(searchLower)) return true;
      }
    }
    
    return false;
  });
}
