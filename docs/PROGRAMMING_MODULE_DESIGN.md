# 📅 Módulo de Programación Diaria - Diseño Técnico

## 🎯 Objetivo
Eliminar el doble trabajo (Excel → App) creando una vista de programación diaria donde se asignen recursos y se generen órdenes automáticamente.

## 📊 Arquitectura de Datos

### Nueva Colección: `daily_schedule`
```typescript
interface DailyScheduleItem {
  id: string;
  date: Timestamp;
  time: string; // "10:00", "14:30"
  
  // Información del servicio
  fileNumber: string;
  agency: string;
  reference: string;
  paxCount: number;
  hotel: string;
  flight?: string;
  
  // Tipo de servicio
  serviceType: 'IN' | 'OUT' | 'TOUR' | 'TRANSFER' | 'OTHER';
  serviceDescription: string;
  
  // Asignación de recursos
  guide?: string;
  secondGuide?: string;
  driver?: string;
  bus?: string;
  
  // Observaciones
  observations?: string;
  
  // Estado y vinculación
  status: 'programmed' | 'order_generated' | 'in_progress' | 'completed' | 'cancelled';
  serviceOrderId?: string; // Referencia a la orden generada
  
  // Auditoría
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

### Modificación a `service_orders`
Agregar campos de vinculación:
```typescript
interface ServiceOrder {
  // ... campos existentes ...
  
  // Nueva vinculación
  scheduleItemId?: string; // Referencia al item de programación
  generatedFromSchedule: boolean; // true si se generó desde programación
}
```

---

## 🎨 Diseño de UI/UX

### Página Principal: `/programming`

#### Vista Desktop
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📅 Programación Diaria                                    Usuario: Admin    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ◀ Jue 26    【 Viernes, 27 de Febrero 2026 】    Sáb 28 ▶    [📥 Importar] │
│                                                                              │
│  🔍 Buscar: [_____________]  🏨 Hotel: [Todos ▼]  👤 Guía: [Todos ▼]       │
│                                                                              │
├──┬──────┬────────┬─────┬────────────┬──────────┬──────────┬─────────┬────────┤
│✓│ Hora │ File   │ PAX │ Hotel      │ Servicio │ Guía     │ Chofer  │ Estado │
├──┼──────┼────────┼─────┼────────────┼──────────┼──────────┼─────────┼────────┤
│☐│ 05:00│ 159567 │  2  │ Atix Hotel │ OUT AV   │ Carola ▼ │ Rainb ▼ │ 📋 Gen │
│☐│ 09:30│ 159774 │  2  │ Europa     │ OUT LA   │ Carola ▼ │ Ramos ▼ │ 📋 Gen │
│☐│ 10:00│ 155721 │  7  │ Presidente │ IN       │ Maria ▼  │ Germ ▼  │ 📋 Gen │
│☐│ 10:00│ 156604 │  3  │ Presidente │ IN       │ Elar ▼   │ -    ▼  │ ⚠️ Pend│
│☐│ 10:00│ 158716 │  2  │ Rosario    │ IN       │ German ▼ │ Contr▼  │ 📋 Gen │
│☐│ 10:00│ 159639 │  8  │ Presidente │ IN       │ Miaral ▼ │ -    ▼  │ ⚠️ Pend│
│  │ [+] Agregar nuevo servicio                                              │
├──┴──────┴────────┴─────┴────────────┴──────────┴──────────┴─────────┴────────┤
│                                                                              │
│  ✓ 4 seleccionados    [📋 Generar Órdenes Seleccionadas] [💾 Guardar Todo] │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Vista Mobile
```
┌─────────────────────────────────┐
│ 📅 Programación                 │
│                                 │
│ ◀ Vie 27 Feb 2026 ▶            │
│                                 │
│ [📥 Importar Excel]             │
│                                 │
├─────────────────────────────────┤
│ ⏰ 05:00 - 159567         [☐]  │
│ 🏨 Atix Hotel · 2 PAX          │
│ ✈️ OUT AV 7391                  │
│ 👤 Carola  🚗 Rainb            │
│ 📋 [Generar Orden]              │
├─────────────────────────────────┤
│ ⏰ 09:30 - 159774         [☐]  │
│ 🏨 Europa · 2 PAX              │
│ ✈️ OUT LA2379                   │
│ 👤 Carola  🚗 Ramos            │
│ 📋 [Generar Orden]              │
├─────────────────────────────────┤
│ [+] Agregar Servicio            │
└─────────────────────────────────┘
```

---

## 🔄 Flujos de Trabajo

### Flujo 1: Importación desde Excel
```
Usuario sube Excel
    ↓
Parser analiza estructura
    ↓
Preview de datos mapeados
    ↓
Usuario confirma/ajusta mapeo
    ↓
Importación a daily_schedule
    ↓
Vista de programación actualizada
```

### Flujo 2: Edición Manual
```
Usuario navega a fecha
    ↓
Click en [+] o edita fila existente
    ↓
Modal de edición rápida
    ↓
Selecciona guía/chofer de dropdowns
    ↓
Guarda → actualiza DB
```

### Flujo 3: Generación de Órdenes
```
Usuario selecciona items (checkbox)
    ↓
Click "Generar Órdenes Seleccionadas"
    ↓
Sistema valida asignaciones
    ↓
Crea ServiceOrder por cada item
    ↓
Vincula scheduleItemId ↔ serviceOrderId
    ↓
Marca status = 'order_generated'
    ↓
Notificación de éxito
```

### Flujo 4: Sincronización
```
Si se edita Orden ya generada:
    ↓
Actualiza también DailyScheduleItem
    ↓
Marca como "modificado post-generación"

Si se edita Schedule después de generar:
    ↓
Advertencia: "Orden ya generada"
    ↓
Opción: "Regenerar" o "Desvincular"
```

---

## 🛠️ Implementación por Módulos

### Módulo 1: Parser de Excel
**Archivo:** `src/lib/excelScheduleParser.ts`

```typescript
interface ExcelScheduleRow {
  hora: string;
  nombrePax: string;
  noPax: number;
  hotel: string;
  vuelo: string;
  servicios: string;
  file: string;
  guia: string;
  chofer: string;
  bus: string;
}

export async function parseScheduleExcel(
  file: File
): Promise<DailyScheduleItem[]> {
  // Leer Excel con xlsx library
  // Mapear columnas a estructura DailyScheduleItem
  // Validar datos
  // Retornar array listo para importar
}
```

### Módulo 2: Componente de Tabla Editable
**Archivo:** `src/components/programming/ScheduleTable.tsx`

Características:
- Edición inline con dropdowns
- Validación en tiempo real
- Drag & drop para reasignar
- Códigos de color por estado
- Responsive (mobile cards)

### Módulo 3: Servicio de Programación
**Archivo:** `src/lib/schedulingService.ts`

```typescript
// CRUD para daily_schedule
export async function getScheduleByDate(date: Date): Promise<DailyScheduleItem[]>
export async function saveScheduleItem(item: DailyScheduleItem): Promise<void>
export async function bulkImportSchedule(items: DailyScheduleItem[]): Promise<void>

// Generación de órdenes
export async function generateOrderFromSchedule(
  scheduleId: string
): Promise<{ success: boolean; orderId?: string }>

export async function generateMultipleOrders(
  scheduleIds: string[]
): Promise<{ success: number; failed: number; errors: string[] }>

// Sincronización
export async function syncScheduleWithOrder(
  scheduleId: string, 
  orderId: string
): Promise<void>
```

### Módulo 4: Página Principal
**Archivo:** `src/app/(main)/programming/page.tsx`

Estructura:
```tsx
export default function ProgrammingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleItems, setScheduleItems] = useState<DailyScheduleItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Cargar programación del día
  useEffect(() => {
    loadScheduleForDate(selectedDate);
  }, [selectedDate]);
  
  return (
    <div>
      <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      <ScheduleTable 
        items={scheduleItems}
        onSelectionChange={setSelectedIds}
      />
      <ActionBar 
        selectedCount={selectedIds.size}
        onGenerateOrders={handleGenerateOrders}
      />
    </div>
  );
}
```

---

## 📋 Reglas de Negocio

### Validaciones
1. ✅ **Antes de generar orden:**
   - File number debe existir
   - Guía debe estar asignado (obligatorio)
   - Chofer opcional pero recomendado
   - PAX count > 0

2. ⚠️ **Advertencias:**
   - Si guía tiene >3 servicios en mismo día
   - Si chofer tiene servicios solapados
   - Si hotel no está en catálogo

3. 🚫 **Restricciones:**
   - No se puede eliminar schedule si orden generada (solo desvincular)
   - No se puede generar orden duplicada del mismo schedule item
   - Admin puede forzar regeneración

### Estados del Schedule Item
- `programmed` - Nuevo, sin orden generada
- `order_generated` - Orden creada y vinculada
- `in_progress` - Servicio en ejecución
- `completed` - Servicio finalizado
- `cancelled` - Cancelado

---

## 🎯 Beneficios vs Sistema Actual

### Sistema Actual (con Excel)
```
❌ Doble captura: Excel → App
❌ Sin validación en Excel
❌ Errores de transcripción
❌ No hay historial de cambios en Excel
❌ Difícil reasignar guías/choferes
```

### Sistema Propuesto
```
✅ Captura única en la app
✅ Validación en tiempo real
✅ Importación automática desde Excel (transición)
✅ Historial completo en Firestore
✅ Reasignación visual y fácil
✅ Generación automática de órdenes
✅ Sincronización bidireccional
✅ Vista por día, guía, chofer, hotel
```

---

## 📊 Plan de Migración

### Fase Transición (Opcional)
Mientras se acostumbran al nuevo sistema:

**Opción A: Dual Mode**
- Mantener Excel como fuente
- Importar diariamente
- Generar órdenes desde app

**Opción B: Full Migration**
- Importar histórico de Excel
- Capacitación a usuarios
- Programar directo en app

### Timeline Sugerido
```
Semana 1-2: Diseño DB y parsers
Semana 3-4: UI de tabla y navegación
Semana 5-6: Generación de órdenes
Semana 7: Testing y ajustes
Semana 8: Importación histórica
Semana 9: Capacitación
Semana 10: Producción
```

---

## 🔒 Seguridad y Permisos

```typescript
// Niveles de acceso
- Admin: Full access (CRUD schedule, importar, generar)
- Coordinator: Ver, editar asignaciones, generar órdenes
- Guide: Solo lectura (ver sus servicios del día)
- Driver: Solo lectura (ver sus servicios del día)
```

---

## 💡 Features Futuras (Post-MVP)

1. **Vista de Recursos**
   - Ver todos los servicios de un guía en la semana
   - Ver disponibilidad de choferes/buses
   - Detectar conflictos de horarios

2. **Optimización Automática**
   - Sugerir guías según disponibilidad y skills
   - Optimizar rutas de choferes
   - Balancear carga de trabajo

3. **Reportes**
   - Órdenes generadas vs pendientes
   - Utilización de recursos
   - Servicios por hotel/agencia

4. **Notificaciones**
   - Avisar a guía cuando se le asigna servicio
   - Recordatorios día anterior
   - Cambios de última hora

5. **Mobile App para Guías**
   - Ver su programación
   - Confirmar recepción
   - Reportar novedades

---

## 🤔 Decisiones de Diseño a Tomar

### 1. Edición Inline vs Modal
**Inline**: Más rápido, como Excel
**Modal**: Más control, validaciones claras
**Recomendación**: Híbrido - inline para campos simples, modal para crear nuevo

### 2. Importación Excel: Mapeo Automático vs Manual
**Automático**: Detecta columnas por nombre
**Manual**: Usuario mapea cada columna
**Recomendación**: Automático con opción de ajustar

### 3. Generación: Individual vs Masiva
**Individual**: Botón por fila
**Masiva**: Checkbox + generar seleccionadas
**Recomendación**: Ambas opciones

### 4. Sincronización: Tiempo Real vs Manual
**Tiempo Real**: Cambios reflejan inmediatamente
**Manual**: Botón "Guardar"
**Recomendación**: Tiempo real con debounce (3 segundos)

---

## 📝 Próximos Pasos

1. ✅ **Revisar este diseño** - ¿Falta algo? ¿Cambios?
2. 📊 **Definir estructura final de datos**
3. 🎨 **Crear wireframes/mockups visuales**
4. 💻 **Implementar parser de Excel** (Quick Win)
5. 🗄️ **Crear colección daily_schedule en Firestore**
6. 🔧 **Desarrollar CRUD básico**
7. 🎨 **UI de tabla de programación**
8. ⚡ **Generación automática de órdenes**
9. 🧪 **Testing exhaustivo**
10. 🚀 **Deploy y capacitación**

---

## ❓ Preguntas para Definir

1. ¿El Excel tiene formato estándar siempre o varía?
2. ¿Cuántos servicios promedio se programan por día? (para optimizar paginación)
3. ¿Necesitan modificar schedule después de generar orden?
4. ¿Quiénes deben tener acceso a ver/editar programación?
5. ¿Necesitan vista semanal o solo diaria?
6. ¿Importar todo el Excel o solo fecha específica?
7. ¿Qué pasa si cambia un servicio último momento?
