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
import { logger } from './logger';

/**
 * Busca órdenes por nombre de orden (substring matching)
 * Ejemplos que funcionan:
 * - "ODS 23" → encuentra "ODS 23 FEBRERO 2026 CTFI110489"
 * - "CTFI110489" → encuentra órdenes con ese código de file
 * - "23 FEBRERO" → encuentra "ODS_23_FEBRERO_2026"
 * - "11 FEBRERO" → encuentra "ODS_11_FEBRERO_2026"
 */
export async function searchOrdersByName(searchTerm: string): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  if (searchTerm.length < 3) return [];

  const ordersRef = collection(db, 'serviceOrders');
  const termUpper = searchTerm.toUpperCase().trim();
  
  // Descargar todas las órdenes del último año (cubre todo el historial del sistema)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  const q = query(
    ordersRef,
    where('isRoot', '==', true),
    where('createdAt', '>=', twelveMonthsAgo),
    orderBy('createdAt', 'desc')
    // Sin límite: la ventana temporal hace el trabajo
  );

  const snapshot = await getDocs(q);
  logger.debug(`🔍 Búsqueda por nombre "${searchTerm}" - ${snapshot.size} reads`);

  // Filtrar client-side con substring match
  const filtered = snapshot.docs
    .filter(doc => {
      const data = doc.data();
      return data.orderName?.toUpperCase().includes(termUpper);
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

  logger.debug(`✅ ${filtered.length} órdenes encontradas con "${searchTerm}"`);
  
  return filtered;
}

/**
 * Busca órdenes por nombre de guía o chofer (responsables)
 * Usa el campo allResponsibles con filtrado client-side para búsqueda de substring
 * - Guía principal
 * - Guías en servicios individuales
 * - Choferes en servicios
 * - Órdenes hijas (splits)
 * 
 * NOTA: array-contains solo funciona con coincidencias exactas, por lo que
 * descargamos órdenes recientes (últimos 6 meses) y filtramos por substring.
 * Esto permite buscar "IVAR" y encontrar "IVAR LOPEZ".
 */
export async function searchOrdersByResponsible(responsibleName: string): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  if (responsibleName.length < 2) return [];

  const ordersRef = collection(db, 'serviceOrders');
  const nameUpper = responsibleName.toUpperCase().trim();

  try {
    // Descargar todas las órdenes de los últimos 12 meses (cubre todo el historial)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const q = query(
      ordersRef,
      where('createdAt', '>=', twelveMonthsAgo),
      orderBy('createdAt', 'desc')
      // Sin límite: obtiene todas las órdenes del periodo
    );
    
    const snapshot = await getDocs(q);
    logger.debug(`🔍 Búsqueda por responsable "${responsibleName}" - ${snapshot.size} reads (últimos 12 meses)`);
    
    // Filtrar client-side: buscar substring en responsables
    const filtered = snapshot.docs
      .filter(doc => {
        const data = doc.data();
        let responsibles = data.allResponsibles || [];
        
        // FALLBACK: Si allResponsibles no existe, extraerlos on-the-fly
        if (!responsibles || responsibles.length === 0) {
          const names = new Set<string>();
          const orderData = data.data;
          
          if (orderData?.guia) names.add(orderData.guia.toUpperCase());
          if (orderData?.services && Array.isArray(orderData.services)) {
            orderData.services.forEach((service: any) => {
              if (service.guia) names.add(service.guia.toUpperCase());
              if (service.chofer) names.add(service.chofer.toUpperCase());
            });
          }
          
          responsibles = Array.from(names).sort();
        }
        
        // Buscar si algún responsable contiene el substring
        return responsibles.some((resp: string) => resp.includes(nameUpper));
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
    
    logger.debug(`   ✅ ${filtered.length} órdenes encontradas con "${responsibleName}"`);
    
    // Advertencia si no existe el campo en producción
    if (filtered.length > 0 && !snapshot.docs[0].data().allResponsibles) {
      logger.warn(`   ⚠️ IMPORTANTE: Campo allResponsibles no existe. Ejecuta la migración: npm run migrate:responsibles`);
    }
    
    return filtered;
  } catch (error) {
    logger.error('❌ Error en búsqueda por responsable:', error);
    logger.warn('   Asegúrate de haber ejecutado el script de migración: npm run migrate:responsibles');
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

  if (!(monthName in months)) {
    logger.warn(`Mes no reconocido: ${monthName}`);
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
    orderBy('createdAt', 'desc')
    // Sin límite: devuelve todas las órdenes del mes
  );

  const snapshot = await getDocs(q);
  logger.debug(`🔍 Búsqueda por mes "${monthYear}" - ${snapshot.size} reads`);

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
 * Busca órdenes por código de archivo (CTFI, CTFI110489, etc.)
 * Filtra en orderName (que contiene el código) y data.file
 * Usa ventana de 12 meses para cubrir todo el historial del sistema
 */
export async function searchRecentOrdersByFileCode(fileCode: string): Promise<StoredServiceOrder[]> {
  if (!db) throw new Error("Firestore not initialized.");
  
  // Buscar en los últimos 12 meses (cubre todo el historial del sistema)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const ordersRef = collection(db, 'serviceOrders');
  const q = query(
    ordersRef,
    where('isRoot', '==', true),
    where('createdAt', '>=', twelveMonthsAgo),
    orderBy('createdAt', 'desc')
    // Sin límite: obtiene todas las órdenes del periodo
  );

  const snapshot = await getDocs(q);
  logger.debug(`🔍 Búsqueda por código "${fileCode}" - ${snapshot.size} reads (últimos 12 meses)`);

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
  logger.debug(`🔍 Búsqueda general en últimos ${daysBack} días - ${snapshot.size} reads`);

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
 * 1. Día + mes (23 FEBRERO, 12 de enero)
 * 2. Mes/año (FEBRERO 2026, ENERO)
 * 3. Nombre de orden (ODS 23 FEBRERO, ODS 23)
 * 4. Código de archivo (CTFI110489, CTFI)
 * 5. Nombre de responsable (JUAN PEREZ, PEDRO, MARIA)
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

  // CASO 1: Búsqueda por día + mes (ej: "23 FEBRERO", "12 DE ENERO", "23 febrero 2026")
  // Busca en el orderName que tiene formato: "ODS_23_FEBRERO_2026_CTFI110489"
  const dayMonthPattern = /(\d{1,2})\s+(?:DE\s+)?(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)(?:\s+(\d{4}))?/i;
  const dayMonthMatch = termUpper.match(dayMonthPattern);
  
  if (dayMonthMatch) {
    const day = dayMonthMatch[1];
    const month = dayMonthMatch[2];
    const year = dayMonthMatch[3];
    
    // Construir el término de búsqueda que coincida con el formato del orderName
    // "23 FEBRERO" → buscar "23_FEBRERO"
    // "23 FEBRERO 2026" → buscar "23_FEBRERO_2026"
    let searchPattern = `${day}_${month}`;
    if (year) {
      searchPattern += `_${year}`;
    }
    
    const results = await searchOrdersByName(searchPattern);
    return {
      results,
      method: 'day-month',
      reads: results.length,
      tip: `Búsqueda por día/mes: ${results.length} órdenes encontradas con "${day} ${month}${year ? ' ' + year : ''}"`
    };
  }

  // CASO 2: Búsqueda por mes/año (ej: "FEBRERO 2026", "ENERO")
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

  // CASO 3: Nombre de orden (ej: "ODS 23", "ODS 23 FEBRERO")
  // Órdenes siempre empiezan con "ODS" o contienen estructura similar
  if (termUpper.startsWith('ODS') || termUpper.includes('ODS')) {
    const results = await searchOrdersByName(termUpper);
    return {
      results,
      method: 'order-name',
      reads: results.length,
      tip: `Búsqueda por nombre: ${results.length} órdenes encontradas`
    };
  }

  // CASO 4: Código de archivo con números (ej: "CTFI110489")
  // Solo si tiene números (para no confundir con nombres)
  const hasNumbers = /\d/.test(trimmed);
  const isLikelyFileCode = /^[A-Z0-9]+$/i.test(trimmed) && trimmed.length >= 4 && hasNumbers;
  
  if (isLikelyFileCode) {
    // Buscar órdenes que contengan este código en orderName o data.file
    const results = await searchRecentOrdersByFileCode(trimmed);
    
    if (results.length > 0) {
      return {
        results,
        method: 'file-code',
        reads: results.length,
        tip: `Código de archivo: ${results.length} órdenes encontradas`
      };
    }
  }

  // CASO 5: Nombre de responsable (guía o chofer) - PRIORIDAD
  // Cualquier búsqueda que no sea fecha, ODS o código numérico
  const results = await searchOrdersByResponsible(trimmed);
  
  if (results.length > 0) {
    return {
      results,
      method: 'responsible',
      reads: results.length,
      tip: `Responsable: ${results.length} órdenes encontradas`
    };
  }

  // CASO 6: Código de archivo SIN números como último recurso (ej: "CTFI")
  const isFileCode = /^[A-Z]+$/i.test(trimmed) && trimmed.length >= 4;
  if (isFileCode) {
    const codeResults = await searchRecentOrdersByFileCode(trimmed);
    
    if (codeResults.length > 0) {
      return {
        results: codeResults,
        method: 'file-code',
        reads: codeResults.length,
        tip: `Código de archivo: ${codeResults.length} órdenes encontradas`
      };
    }
  }

  // CASO 7: Búsqueda general en órdenes recientes (fallback)
  const fallbackResults = await searchRecentOrders(trimmed, 30);
  return {
    results: fallbackResults,
    method: 'recent-general',
    reads: Math.max(fallbackResults.length, 500),
    tip: fallbackResults.length === 0 
      ? 'No se encontraron resultados en los últimos 30 días'
      : `Búsqueda general: ${fallbackResults.length} órdenes encontradas`
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
  logger.debug(`⚠️ Búsqueda inteligente no encontró resultados para: "${searchTerm}"`);

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
  logger.debug(`🔍 Ejecutando búsqueda completa (fallback)...`);
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
