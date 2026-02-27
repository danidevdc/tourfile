# 🛡️ Mejores Prácticas - TourFile Generator

**Guía para hacer cambios seguros y evitar romper funcionalidad existente**

---

## 📋 Tabla de Contenido

1. [Antes de Hacer Cambios](#-antes-de-hacer-cambios)
2. [Patrones de Código](#-patrones-de-código)
3. [Testing](#-testing)
4. [Gestión de Estado](#-gestión-de-estado)
5. [Base de Datos](#-base-de-datos)
6. [Prevención de Bugs Comunes](#-prevención-de-bugs-comunes)
7. [Debugging](#-debugging)
8. [Deployment](#-deployment)

---

## ✅ Antes de Hacer Cambios

### Checklist Pre-Cambios

- [ ] **Entender el impacto**: ¿Este cambio afecta otras partes del sistema?
- [ ] **Backup de datos**: Si tocas migrations o esquemas de DB
- [ ] **Branch nuevo**: Nunca hacer cambios directos en `main`
- [ ] **Tests existentes**: Ejecutar `npm test` para ver estado actual
- [ ] **Revisar dependencias**: ¿Qué otros archivos usan esta función?

### Cómo Investigar Dependencias

```bash
# Buscar dónde se usa una función
grep -r "nombreDeFuncion" src/

# Ver imports de un archivo específico
grep "import.*nombreArchivo" src/**/*.{ts,tsx}
```

**En VSCode:**
- Click derecho en función → "Find All References" (Shift+F12)
- Revisar imports antes de modificar exports

---

## 🎯 Patrones de Código

### 1. **Funciones de Servicio (lib/)**

#### ❌ MAL - Modificar función existente sin protección
```typescript
export async function saveEditedServiceOrder(order, data, email) {
    // Código que puede ejecutarse múltiples veces
    await saveToFirestore(order);
}
```

#### ✅ BIEN - Agregar protecciones
```typescript
// Lock para prevenir ejecuciones concurrentes
const saveLocks = new Set<string>();

export async function saveEditedServiceOrder(order, data, email) {
    const lockKey = `edit-${order.id}`;
    
    // Prevenir duplicados
    if (saveLocks.has(lockKey)) {
        throw new Error("Ya se está guardando esta orden");
    }
    
    saveLocks.add(lockKey);
    try {
        await saveToFirestore(order);
    } finally {
        saveLocks.delete(lockKey); // SIEMPRE limpiar
    }
}
```

### 2. **Componentes React**

#### ❌ MAL - Estado sin protección
```typescript
const handleSave = async () => {
    await saveOrder(data); // Usuario puede hacer click múltiple
}

return <Button onClick={handleSave}>Guardar</Button>
```

#### ✅ BIEN - UI con estado de carga
```typescript
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
    if (isSaving) return; // Prevenir doble clic
    
    setIsSaving(true);
    try {
        await saveOrder(data);
        toast({ title: "Éxito" });
    } catch (error) {
        toast({ title: "Error", description: error.message });
    } finally {
        setIsSaving(false); // SIEMPRE limpiar
    }
}

return (
    <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Guardando..." : "Guardar"}
    </Button>
)
```

### 3. **Queries de Firebase**

#### ❌ MAL - Queries sin paginación
```typescript
// Puede traer miles de documentos
const snapshot = await getDocs(collection(db, 'serviceOrders'));
```

#### ✅ BIEN - Queries paginadas
```typescript
const q = query(
    collection(db, 'serviceOrders'),
    where('status', '==', 'activo'),
    orderBy('createdAt', 'desc'),
    limit(10) // SIEMPRE limitar
);

if (lastDoc) {
    q = query(q, startAfter(lastDoc)); // Cursor-based pagination
}

const snapshot = await getDocs(q);
console.log(`📊 Leídos ${snapshot.size} documentos`); // Log para debugging
```

### 4. **Manejo de Errores**

#### ❌ MAL - Errores silenciosos
```typescript
try {
    await riskyOperation();
} catch (error) {
    console.log(error); // Usuario no sabe que falló
}
```

#### ✅ BIEN - Feedback visible
```typescript
try {
    await riskyOperation();
    toast({ 
        title: "Éxito", 
        description: "Operación completada",
        variant: "success" 
    });
} catch (error: any) {
    console.error("Error detallado:", error); // Para debugging
    toast({ 
        title: "Error", 
        description: error.message || "Algo salió mal",
        variant: "destructive" 
    });
    // Re-throw si es crítico
    if (error.code === 'CRITICAL') throw error;
}
```

---

## 🧪 Testing

### Siempre Ejecutar Tests Antes de Commit

```bash
# Tests unitarios completos
npm test

# Tests con interfaz visual
npm run test:ui

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Cuando Crear Nuevos Tests

**Siempre que:**
- Agregues una nueva función en `lib/`
- Modifiques lógica crítica (órdenes, reportes, autenticación)
- Fixes un bug (test de regresión)

**Ejemplo de test unitario:**
```typescript
// src/__tests__/unit/myNewFeature.test.ts
import { describe, it, expect } from 'vitest';
import { myNewFunction } from '@/lib/myNewFeature';

describe('myNewFunction', () => {
    it('should handle normal case', () => {
        const result = myNewFunction('input');
        expect(result).toBe('expected output');
    });
    
    it('should handle edge case - empty input', () => {
        const result = myNewFunction('');
        expect(result).toBe('default value');
    });
    
    it('should throw error on invalid input', () => {
        expect(() => myNewFunction(null)).toThrow();
    });
});
```

### Tests Fallando Después de Cambios

**Si los tests fallan:**

1. **Leer el error** - ¿Es un test desactualizado o un bug real?
2. **Actualizar mocks** - ¿Cambiaron las interfaces?
3. **Actualizar assertions** - ¿El comportamiento cambió intencionalmente?
4. **Nunca skipear tests** - Arreglarlos o eliminarlos si son obsoletos

---

## 🔄 Gestión de Estado

### useState vs useRef

#### Usa `useState` cuando:
- El cambio debe re-renderizar el componente
- Muestras el valor en UI
- Usas el valor en dependencias de useEffect

```typescript
const [count, setCount] = useState(0); // UI se actualiza cuando cambia
```

#### Usa `useRef` cuando:
- Necesitas persistir valor entre renders sin re-renderizar
- Guardas referencias a elementos DOM
- Timers, flags, valores internos

```typescript
const saveLockRef = useRef(false); // No causa re-render
```

### Prevenir Re-renders Innecesarios

```typescript
// ❌ MAL - Re-crea objeto en cada render
const config = { page: 1, limit: 10 };

// ✅ BIEN - Memorizar con useMemo
const config = useMemo(() => ({ 
    page: currentPage, 
    limit: ITEMS_PER_PAGE 
}), [currentPage]);

// ✅ BIEN - Memorizar callbacks con useCallback
const handleSave = useCallback(async (data) => {
    await saveOrder(data);
}, [saveOrder]);
```

---

## 💾 Base de Datos

### Reglas de Oro para Firestore

1. **NUNCA modificar documentos sin verificar existencia**
   ```typescript
   const docRef = doc(db, 'orders', orderId);
   const docSnap = await getDoc(docRef);
   
   if (!docSnap.exists()) {
       throw new Error("Orden no encontrada");
   }
   
   await updateDoc(docRef, updates);
   ```

2. **SIEMPRE usar batch para operaciones múltiples**
   ```typescript
   const batch = writeBatch(db);
   
   // Múltiples operaciones
   batch.delete(child1Ref);
   batch.delete(child2Ref);
   batch.update(parentRef, updates);
   
   // Una sola transacción
   await batch.commit();
   ```

3. **SIEMPRE limpiar órdenes hijas antes de re-dividir**
   ```typescript
   // En saveEditedServiceOrder
   const existingChildren = await getChildrenByParentId(parentId);
   existingChildren.forEach(child => {
       batch.delete(doc(db, 'serviceOrders', child.id));
   });
   ```

4. **Usar índices compuestos para queries complejas**
   ```typescript
   // Si Firebase te pide crear índice, hazlo en console
   const q = query(
       ordersRef,
       where('isRoot', '==', true),
       where('status', '==', 'eliminado'), // Requiere índice compuesto
       orderBy('createdAt', 'desc')
   );
   ```

### Schema Changes

**Cuando agregues campos nuevos:**

```typescript
// ❌ MAL - Asumir que el campo existe
const status = order.newField.toUpperCase();

// ✅ BIEN - Siempre tener fallback
const status = (order.newField || 'default').toUpperCase();

// ✅ MEJOR - Type guard
if ('newField' in order && order.newField) {
    const status = order.newField.toUpperCase();
}
```

### Migraciones de Datos

Si necesitas agregar campo a documentos existentes:

```typescript
// src/lib/migrations/addIsRootField.ts
export async function migrateAddIsRoot() {
    const ordersRef = collection(db, 'serviceOrders');
    const snapshot = await getDocs(ordersRef);
    
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.docs.forEach(doc => {
        if (!doc.data().hasOwnProperty('isRoot')) {
            const isRoot = !doc.data().splitFrom;
            batch.update(doc.ref, { isRoot });
            count++;
        }
    });
    
    if (count > 0) {
        await batch.commit();
        console.log(`✅ Migrated ${count} documents`);
    }
}
```

---

## 🐛 Prevención de Bugs Comunes

### 1. División de Órdenes - Duplicación de Hijas

**Problema:** Al editar orden padre, se crean hijas duplicadas.

**Causa:** No limpiar hijas existentes antes de recrear.

**Solución:** Ver implementación actual en `saveEditedServiceOrder` (líneas 326-331).

### 2. Paginación - Números Incorrectos

**Problema:** Página 1 muestra 6 items, página 2 muestra 10.

**Causa:** Mezclar órdenes activas y eliminadas en misma query.

**Solución:** 
- Usar parámetro `excludeDeleted` en queries
- Separar vistas (activas vs eliminadas)
- Filtrar a nivel de query, no en cliente

### 3. Cache Desactualizado

**Problema:** Datos no se actualizan después de cambios.

**Causa:** Cache en sessionStorage retorna datos viejos.

**Solución en v3.1.0:**
```typescript
// Cache deshabilitado - siempre fetch fresh
console.log('📊 Descargando desde Firebase (sin caché)');
return await fetchFn();
```

### 4. Doble Clic en Botones

**Problema:** Operación se ejecuta dos veces.

**Solución:** Ver implementación en `ServiceOrderEditModal` y `handleSaveFromEditModal`.

### 5. Fechas en Tests

**Problema:** Tests usan fechas hardcodeadas que expiran.

**Solución:**
```typescript
// ❌ MAL
const mockDate = new Date('2024-01-15'); // Expira

// ✅ BIEN
const mockDate = new Date(); // Usa fecha actual
// O
const mockDate = new Date(new Date().getFullYear(), 0, 15); // Año actual
```

---

## 🔍 Debugging

### Console Logs Estratégicos

```typescript
// ✅ BIEN - Logs informativos con emoji para fácil identificación
console.log(`📊 getServiceOrdersPaginated - Found ${parents.length} parents`);
console.log(`📊 Read ${snapshot.size} documents (${snapshot.size} reads)`);
console.warn(`⚠️ Guardado duplicado bloqueado para orden ${orderName}`);
console.error(`❌ Error crítico:`, error);
```

### Debugging en Producción

**Variables de entorno para debug:**
```env
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_LOG_FIRESTORE_READS=true
```

**Uso:**
```typescript
if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
    console.log('[DEBUG] Estado actual:', state);
}
```

### React DevTools

- Instalar extensión "React Developer Tools"
- Inspeccionar componentes en pestaña "Components"
- Ver props, state, hooks en tiempo real
- Profiler para detectar re-renders innecesarios

---

## 🚀 Deployment

### Checklist Pre-Deploy

- [ ] `npm run build` - Verifica que compila sin errores
- [ ] `npm test` - Todos los tests pasan
- [ ] `npm run typecheck` - Sin errores de TypeScript
- [ ] Revisar cambios en Firestore Rules si tocaste schemas
- [ ] Verificar `.env` de producción está actualizado
- [ ] Version bump en `package.json` (semantic versioning)

### Semantic Versioning

```
v3.1.0
│ │ │
│ │ └─ PATCH: Bug fixes, cambios menores
│ └─── MINOR: Nuevas features, cambios compatibles
└───── MAJOR: Breaking changes, incompatibilidades
```

**Ejemplos:**
- Bug fix: `3.1.0` → `3.1.1`
- Nueva feature: `3.1.0` → `3.2.0`
- Breaking change: `3.1.0` → `4.0.0`

### Deploy a Firebase

```bash
# Build de producción
npm run build

# Deploy hosting
firebase deploy --only hosting

# Deploy functions (si hay)
firebase deploy --only functions

# Deploy todo
firebase deploy
```

### Rollback en caso de error

```bash
# Ver versiones anteriores
firebase hosting:releases:list

# Rollback a versión anterior
firebase hosting:rollback [VERSION_ID]
```

---

## 🎓 Patrones Avanzados

### Custom Hooks Reutilizables

```typescript
// src/hooks/useSaveWithLock.ts
export function useSaveWithLock<T>(
    saveFn: (data: T) => Promise<void>
) {
    const [isSaving, setIsSaving] = useState(false);
    const lockRef = useRef(false);
    
    const save = useCallback(async (data: T) => {
        if (lockRef.current) {
            throw new Error("Ya se está guardando");
        }
        
        lockRef.current = true;
        setIsSaving(true);
        
        try {
            await saveFn(data);
        } finally {
            setIsSaving(false);
            lockRef.current = false;
        }
    }, [saveFn]);
    
    return { save, isSaving };
}

// Uso
const { save: saveOrder, isSaving } = useSaveWithLock(saveEditedServiceOrder);
```

### Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error capturado:', error, errorInfo);
        // Opcional: Enviar a servicio de logging (Sentry, etc.)
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div className="error-fallback">
                    <h2>Algo salió mal</h2>
                    <Button onClick={() => window.location.reload()}>
                        Recargar página
                    </Button>
                </div>
            );
        }
        
        return this.props.children;
    }
}
```

---

## 📚 Recursos Adicionales

### Documentación Útil

- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hooks Reference](https://react.dev/reference/react)

### Comandos Útiles

```bash
# Limpiar cache de Next.js
rm -rf .next

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install

# Ver uso de Firestore
firebase console

# Ver logs de hosting
firebase hosting:logs

# Backup de Firestore (requiere gcloud)
gcloud firestore export gs://[BUCKET_NAME]/[EXPORT_FOLDER]
```

---

## 🆘 En Caso de Emergencia

### Si algo se rompe en producción:

1. **No hacer pánico** - Evaluar impacto
2. **Rollback inmediato** si es crítico
3. **Revisar logs** en Firebase Console
4. **Comunicar** al equipo
5. **Fix en branch separada** - nunca directo a main
6. **Test exhaustivo** antes de re-deploy
7. **Documentar** el incidente y la solución

### Contacts de Emergencia

- **Firebase Console:** https://console.firebase.google.com
- **Vercel/Firebase Status:** https://status.firebase.google.com

---

## ✨ Regla de Oro

> **"Si no estás seguro, pregunta. Si estás seguro, testea. Si testeaste, documenta."**

---

<div align="center">

**Hecho con 🛡️ para desarrollo seguro y sostenible**

[⬆ Volver arriba](#️-mejores-prácticas---tourfile-generator)

</div>
