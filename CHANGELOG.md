# 📝 Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [3.4.5] - 2026-09-15

### Compartir órdenes desde móvil

- El botón móvil vuelve a llamarse “Compartir” y abre el panel nativo para elegir WhatsApp u otra aplicación.
- Si el dispositivo no permite compartir el archivo, se guarda automáticamente el PNG como respaldo.
- Se eliminó el intento de copiar imágenes al portapapeles en móviles.

---

## [3.4.4] - 2026-09-15

### Compartir órdenes desde móvil

- En teléfonos, el botón ahora se llama “Guardar imagen” y descarga directamente el PNG de la orden para adjuntarlo en WhatsApp.
- Se evita solicitar compartir o copiar al portapapeles en móvil, donde iOS puede bloquear esas APIs.

---

## [3.4.3] - 2026-09-14

### Corrección del visor web

- Se restauró una altura estable para el modal de vista previa en escritorio, evitando que el contenido se comprima en una franja.
- El modo de pantalla completa y los controles de zoom continúan limitados a dispositivos móviles.

---

## [3.4.2] - 2026-09-14

### Correcciones en órdenes de servicio

- Las acciones vuelven a mostrarse directamente en una sola fila, incluida la eliminación, sin el botón “Más”.
- El botón “Nueva orden” conserva su tamaño y sombra al pasar el mouse y usa un estado azul suave coherente con la interfaz.
- En móvil, la vista previa se abre a pantalla completa, se ajusta al ancho y permite acercar, alejar y navegar por toda la orden.
- En móvil, la imagen se prepara antes de pulsar el botón y se envía mediante el menú nativo de compartir; si el navegador no lo permite, se descarga un PNG como alternativa.
- Descargar o cancelar el envío ya no marca la orden como enviada.

---

## [3.4.1] - 2026-09-14

### Mejoras en órdenes de servicio

- Antes de guardar, se comprueba que haya file, guía y al menos un servicio con fecha y actividad; una confirmación muestra el resumen de la orden.
- Los traslados omitidos al generar servicios quedan visibles con su fila, vuelo y motivo hasta cambiar el file o regenerar.
- La creación manual y automatizada tienen títulos distintos; el botón de generación indica qué dato falta en lugar de mostrar un progreso engañoso.
- En móvil y tablet, los servicios se revisan y editan en tarjetas en vez de una tabla de diez columnas.
- En el listado, “Ver” y “Editar” quedan visibles; Excel, PDF, liquidación y eliminación se agrupan en “Más”. La eliminación usa una sola confirmación en escritorio y móvil.
- La creación manual tiene un botón con texto y el buscador explica qué campos admite.

---

## [3.4.0] - 2026-09-11

### ✨ Nuevas funciones

- **Liquidación de guías mejorada**
  - Numeración correlativa atómica para evitar duplicados cuando se crean liquidaciones al mismo tiempo.
  - Paginación y límites de consulta para reducir lecturas innecesarias.
  - El total se calcula solo con los servicios seleccionados.
  - Compatibilidad con registros antiguos mediante búsqueda alternativa por guía.

### 🛠️ Correcciones

- **Órdenes automatizadas de traslados aéreos**
  - Los códigos de vuelo del Excel se validan contra el catálogo cargado de vuelos antes de generar una orden.
  - `TRF IN` acepta solo vuelos que llegan a La Paz y `TRF OUT` solo vuelos que salen de La Paz.
  - Se admiten códigos compuestos como `OB777/685` y se informa cuántos traslados fueron omitidos por no coincidir.

- **Monitor de vuelos**
  - La consulta pagada a AeroAPI queda limitada a actualizaciones manuales de vuelos vencidos sin datos de NAABOL, evitando consumo automático innecesario.

### 📦 Notas de lanzamiento

- La numeración de liquidaciones continúa con el prefijo `TEST`; la activación del prefijo productivo `LIQ` debe realizarse como un cambio independiente cuando el módulo entre oficialmente en operación.
- No se requieren migraciones de datos para esta versión.

---

## [3.3.0] - 2026-08-12

### 🔒 Seguridad

- **Firestore Rules: catálogos maestros ya no borrables por cualquier autenticado**
  - PROBLEMA: `guides`, `hotels`, `drivers`, `activities`, `flights`, `buses` permitían `write/update/delete` a cualquier usuario autenticado, sin distinción de rol
  - SOLUCIÓN: lectura sigue abierta a todos los autenticados (la necesitan para armar órdenes); escritura/borrado ahora requiere `isAdmin()` o el módulo `aportar-datos`

- **Firestore Rules: `userProfiles.create` ya no permite auto-escalación de privilegios**
  - PROBLEMA: un usuario que llamara al SDK de Firestore directamente (no solo vía la UI de registro) podía en teoría auto-asignarse `isAdmin: true` o `modules` en su propio documento al crearlo
  - SOLUCIÓN: el `create` ahora exige `isAdmin != true` y `modules` vacío; esos campos solo se setean después vía `update` por un admin existente

- **`AEROAPI_KEY` renombrada, ya no pública innecesariamente**
  - PROBLEMA: era una API key de pago (FlightAware AeroAPI) usada solo dentro de un Server Action, con prefijo `NEXT_PUBLIC_` sin necesidad
  - SOLUCIÓN: renombrada a `AEROAPI_KEY` (sin prefijo) en código, `apphosting.yaml` y `.env.local`

- **`NEXT_PUBLIC_ADMIN_EMAIL` movida a Secret Manager**
  - PROBLEMA: el email del admin principal estaba hardcodeado en 3 archivos de código y en texto plano en `apphosting.yaml` (versionado en git para siempre)
  - SOLUCIÓN: `apphosting.yaml` ahora referencia el secreto vía Secret Manager (`availability: BUILD + RUNTIME`); código lee `process.env.NEXT_PUBLIC_ADMIN_EMAIL`

### ⚡ Performance

- **Lazy-load de `xlsx`/`exceljs` en `/service-order`**
  - PROBLEMA: `ServiceOrderGeneratorSheet` importaba XLSX de forma estática y siempre estaba montado en la página (solo oculto/mostrado), así que la librería (~300-400kB) se descargaba en cada visita aunque nunca se subiera un Excel
  - SOLUCIÓN: `import type` para las anotaciones de tipo, `await import(...)` justo antes de usar el valor real
  - IMPACTO: `/service-order` 865kB → 641kB, home `/` 587kB → 333kB

- **Lazy-load de `jspdf` en el módulo de liquidaciones**
  - PROBLEMA: mismo patrón — `guideLiquidationPDF.ts` se importa desde 6 páginas, cargando jsPDF siempre aunque el usuario nunca imprima
  - IMPACTO: `/guide-liquidation`, `/by-guide`, `/history`, `/new`, `/edit/[id]` bajaron ~127kB cada una; `/service-order` bajó otros 126kB adicionales (515kB final, -40% desde el inicio del día)

### 🔧 Refactoring

- **`src/config/agency.ts`: centraliza branding/moneda/ciudades**
  - PROBLEMA: moneda "Bs." y locale `es-BO` copy-pasteados en 10+ archivos; texto del mensaje de WhatsApp duplicado (con nombre de una persona real) en 2 archivos; ciudades `'La Paz' | 'Uyuni'` hardcodeadas como union type de TypeScript
  - SOLUCIÓN: nuevo módulo central con `agency.name`, `agency.currency`, `agency.cities`, `agency.defaultServiceOrderNote`, y `formatMoney()`; tipo `AgencyCity` reemplaza el union type hardcodeado
  - No es multi-tenant real (requeriría `tenantId` en Firestore), pero reduce clonar el proyecto para otro cliente a "editar un archivo y redeployar" en vez de buscar-reemplazar en ~15 archivos

- **`by-guide/page.tsx`: separado en 7 componentes propios**
  - 923 → 525 líneas; `StatusBadge`, `IconBtn`, `IdiomaPills`, `InfoCard`, `GenerateLiqModal`, `EditLiqModal`, `PayModal` extraídos a `src/components/guide-liquidation/`
  - Sin cambio de comportamiento — mismos props, mismos efectos

- **`ServiceOrderGeneratorSheet.tsx`: lógica de búsqueda de Excel extraída con tests**
  - `findFileInExcelData` y `sortServiceItems` movidas a `src/lib/serviceOrderGeneratorHelpers.ts`, con 14 tests de regresión nuevos que capturan el comportamiento actual (match exacto, sufijo ambiguo, PAX con formato "10 + 2", hotel POSADA vs no-POSADA, orden por fecha/hora)
  - Primer paso antes de dividir el componente completo (1129 líneas) — el estado de sincronización guía/bus/chofer↔tabla queda para una sesión dedicada

- **45 casteos `as any` innecesarios eliminados**
  - PROBLEMA: `variant: "success" as any` copy-pasteado en 15 archivos; el tipo `Toast` ya soportaba `"success"` sin el cast
  - Quedan ~108 usos de `any` documentados como deuda técnica (manejo de errores, parseo de Excel, requieren revisión caso por caso)

- **Código muerto eliminado**: `ServiceOrderPDFDocument.tsx` y `ServiceOrderPDFLayout.tsx` (642 líneas, huérfanos, dependían de un paquete no instalado), `components/ui/sidebar.tsx` (709 líneas, 0 referencias en el proyecto), `src/hooks/useAuth.ts.old`

### 🏗️ CI/Infraestructura

- **32 errores de TypeScript corregidos** — el proyecto compilaba con `typescript.ignoreBuildErrors: true`, ocultando errores reales acumulados (funciones que no devolvían lo esperado, imports rotos, un bug de control de acceso donde `getIntermediateUserEmail` comparaba un string contra un array y siempre fallaba)
- **ESLint activado** — nunca había corrido (`next lint` pedía un prompt interactivo nunca resuelto); ahora usa flat config (`eslint.config.mjs`), con `eslint.ignoreDuringBuilds` también removido de `next.config.ts`
- **CI ampliado**: el workflow de GitHub Actions solo corría `npm run test:unit`; ahora corre `typecheck`, `lint`, `test:unit` y `build` en cada push/PR a `develop`/`master`
- **`tsconfig.json` excluye `functions/`** — causaba que el build fallara en Firebase App Hosting (`functions/` es un sub-proyecto independiente con `firebase-admin` en su propio `node_modules`, no tipado por el `tsconfig` de la app)

### ⚠️ Breaking Changes

- **Firestore Rules**: usuarios autenticados sin el módulo `aportar-datos` (y sin ser admin) ya no pueden crear, editar ni borrar guías, hoteles, choferes, actividades, vuelos o buses — antes cualquier cuenta autenticada podía. Si algún flujo dependía de esto, requiere asignar el módulo `aportar-datos` a esos usuarios.

### 🎯 Migración desde v3.2.x

- Antes del próximo deploy en Firebase App Hosting, crear el secreto `NEXT_PUBLIC_ADMIN_EMAIL` en Secret Manager y otorgar acceso al backend: `firebase apphosting:secrets:grantaccess NEXT_PUBLIC_ADMIN_EMAIL --project tourfileprocessor --backend <nombre-backend>`
- Rotar la clave de AeroAPI en el dashboard de FlightAware, ya que estuvo expuesta con el prefijo `NEXT_PUBLIC_` hasta esta versión
- Revisar que ningún usuario no-admin dependa de poder editar catálogos maestros sin el módulo `aportar-datos`

---

## [3.2.0] - 2026-04-23

### ✨ Agregado

- **Módulo "Liquidaciones por Guía"** - Feature principal
  - Nueva sección dedicada para liquidación de servicios por guía
  - Visualización por guía con filas agrupadas por mes
  - Tabla interactiva con filtros y búsqueda avanzada
  - Modal de visualización con detalles de cada liquidación
  - Modal de edición con validaciones y guardado seguro
  - Sistema de pago: modal de pago con fecha DD/MM/AAAA
  - Marcar servicios como pagados en dashboard e historial
  - Badge de estado con animación unificada (pendiente/pagado)
  - PDF preview modal para visualización de reportes
  - Footer con resumen de totales por guía

- **Caché Firestore para filas por guía+mes**
  - Optimización de queries: agrupa resultados por (guía, mes)
  - Reduce lecturas en búsquedas repetidas del mismo mes
  - Fix: Elimina problema de doble lectura de caché
  - UX improvements en carga de datos

- **Redesign del módulo de Vuelos - Nothing Style**
  - Split-flap display para información de vuelos
  - Avión más grande con mejor visibilidad
  - Quitar fondo gris: fondo transparente/minimalista
  - Animación de arco SVG con avión en movimiento
  - Hora correcta con `toZonedTime` 
  - Fix: bugs de runtime y build resueltos

### ⚡ Cambiado

- **Autenticación: Simplificación de gestión de sesiones**
  - Cambio de `browserSessionPersistence` a `browserLocalPersistence`
  - Refactor de lógica de sesión: eliminadas inicializaciones innecesarias
  - Mejora en manejo de sesiones activas en múltiples dispositivos
  - Skip del primer `onSnapshot` para prevenir self-logout en page reload
  - localStorage ahora registra sessionId correctamente

- **Mejora de habitabilidad en componentes de liquidación**
  - Redesign de modals por-guía con mejor UX
  - Fix en estado de pago: ahora persiste correctamente
  - Unificación de animaciones de badges

### 🐛 Corregido

- **Auth: Self-logout en page reload**
  - PROBLEMA: Usuario se deslogeaba automáticamente al recargar la página
  - CAUSA: Múltiples `onSnapshot` listeners generaban conflictos
  - SOLUCIÓN: Skip del primer snapshot para evitar cambios innecesarios

- **Auth: Session ID perdido en navegación entre tabs**
  - PROBLEMA: Tabs diferentes no reconocían la misma sesión
  - CAUSA: sessionStorage se limpia por tab en ciertos navegadores
  - SOLUCIÓN: Cambiar a localStorage con clave `SESSION_ID_KEY`

- **Vuelos: Hora incorrecta en timezone**
  - PROBLEMA: Horas mostradas no coincidían con zona horaria local
  - SOLUCIÓN: Usar `toZonedTime` para conversión correcta

- **Flight module: Acceso restringido**
  - PROBLEMA: Usuarios sin permisos podían acceder a módulo de vuelos
  - SOLUCIÓN: Agregar outline correcta en user chip y verificar módulo access

- **UI: Double-bounce glitch en theme toggle**
  - Removida animación duplicada en toggle de tema
  - Transición más suave y fluida

### 📚 Documentación

- **Sección de liquidación por guía documentada** (en código)
  - Componentes claramente nombrados: `LiquidationViewerModal`, `GuideLiquidationTable`, etc.
  - Funciones de servicio documentadas en `guideLiquidationService.ts`
  - PDF generation documentada en `guideLiquidationPDF.ts`

### 🔧 Refactoring

- **Simplificación en `useAuth.tsx`**
  - Eliminada lógica redundante de sesión
  - Removida llamada duplicada a `fetchUserProfile`
  - Código más legible y performante

- **Modernización del sistema de notificaciones**
  - Unificación de sistema toast mediante Sonner
  - Routing de `useToast` a través de wrapper Sonner

### ⚠️ Breaking Changes

Ninguno. Esta versión es 100% compatible con v3.1.0.

### 🎯 Migración desde v3.1.x

No se requiere migración. Los cambios son transparentes:
- Datos existentes funcionan sin modificaciones
- Nuevo módulo de liquidación es opcional (features adicionales)
- Auth improvements son retrocompatibles

### 📊 Impacto en Producción

**IMPORTANTE PARA DEPLOYMENT:**
- Módulo de liquidación agregará nuevas funcionalidades sin afectar módulos existentes
- Auth refactoring podría mejorar estabilidad de sesiones en múltiples dispositivos
- Vuelos módulo tendrá mejor visualización pero interfaz similar

**Recomendación:** Antes de pasar a producción:
1. Probar liquidación con conjunto de guías de producción
2. Verificar persistencia de sesiones en múltiples dispositivos
3. Validar que los vuelos muestren horas correctas para tu timezone

---

## [3.1.0] - 2026-02-26

### ✨ Agregado

- **Nueva página de órdenes eliminadas** (`/deleted-orders`)
  - Vista exclusiva para administradores
  - Visualización de órdenes con status "eliminado"
  - Función de restauración (cambia status a "editado")
  - Paginación cursor-based separada de órdenes activas
  - UI con tema rojo para diferenciación visual
  - Agrupación familiar (padre + hijos expandibles)

- **Función `getDeletedOrdersPaginated()`** en `serviceOrderStorage.ts`
  - Query optimizada: `where('isRoot', '==', true) + where('status', '==', 'eliminado')`
  - Paginación consistente con órdenes activas
  - Obtención automática de órdenes hijas mediante `splitFrom`

- **Parámetro `excludeDeleted`** en `getServiceOrdersPaginated()`
  - Default: `true` (excluye eliminadas y canceladas)
  - Filtrado a nivel de query para optimización
  - Buffer de lectura aumentado a `pageSize * 3` para compensar filtrado

- **Botón "Ver Eliminadas"** en página principal de órdenes (solo admin)
  - Navegación directa a `/deleted-orders`
  - Estilo distintivo con bordes y hover rojos
  - Responsive: texto oculto en móviles

- **Ordenamiento por columnas** en tabla de órdenes
  - 4 campos ordenables: `orderName`, `status`, `createdBy`, `createdAt`
  - Dirección ascendente/descendente con toggle
  - Indicadores visuales (flechas) en headers
  - Estado persistente durante la sesión

- **Protección contra guardados duplicados**
  - Lock mechanism en `saveEditedServiceOrder` usando `Set<string>`
  - Estado `isSaving` en componente de edición
  - Botones deshabilitados durante guardado
  - Feedback visual: "Guardando..." con spinner
  - Error claro si se detecta intento de guardado concurrente

- **Validación de conexión DB antes de login**
  - Check de `checkDatabaseConnection()` en flujo de autenticación
  - Toast de error si DB no está disponible
  - Previene login con permisos incorrectos

- **Soporte multi-dispositivo simultáneo**
  - Eliminado campo `activeSessionId` de perfiles de usuario
  - Deshabilitado monitoring en tiempo real de sesiones
  - Múltiples logins concurrentes permitidos
  - Registro de `lastSignInTime` para auditoría

### ⚡ Cambiado

- **Cache deshabilitado** en `serviceOrderCache.ts`
  - Removida lógica de versionado y comparación
  - Siempre fetch fresh desde Firebase
  - Log: "Descargando [recurso] desde Firebase (sin caché, siempre actualizado)"
  - Trade-off: más reads de Firestore pero datos 100% actualizados

- **Filtro de órdenes simplificado** (admin)
  - ANTES: 3 pestañas (Activas | Eliminadas | Todas)
  - AHORA: 2 pestañas (Activas | Todas)
  - Pestaña "Eliminadas" reemplazada por página dedicada

- **Lógica de paginación optimizada**
  - Incremento de límite de `pageSize * 2` a `pageSize * 3`
  - Filtrado más eficiente con skip de órdenes no deseadas
  - Logging mejorado para debugging

### 🐛 Corregido

- **Bug de paginación: "6 órdenes en página 1"**
  - PROBLEMA: Admin veía 6 activas + 4 eliminadas = 10 total mezcladas
  - CAUSA: Query traía primeras 10 isRoot sin filtrar status
  - SOLUCIÓN: Filtrado por `excludeDeleted` + página separada para eliminadas

- **Tests con fechas obsoletas**
  - PROBLEMA: Mocks usaban fechas de 2024, fuera de rango de "últimos 12 meses"
  - CAUSA: Función `getAllOrderHeaders()` filtra por `createdAt >= startDate`
  - SOLUCIÓN: 
    - Actualizar fechas de mocks a 2026
    - Mejorar mock de Firestore para manejar `Timestamp.toDate()` en comparaciones

- **Checkbox de selección masiva deshabilitado innecesariamente**
  - Removido `disabled={filterState === 'deleted'}` 
  - Ahora siempre habilitado (pestaña eliminadas ya no existe)

### 🧪 Testing

- **131 tests unitarios pasando** ✅
  - Suite completa sin errores
  - Cobertura en servicios críticos:
    - `appConfigService` (11 tests)
    - `serviceOrderQuery` (5 tests)
    - `serviceOrderRuleService` (10 tests)
    - `ruleService` (8 tests)
    - `validators` (26 tests)
    - `formatters` (26 tests)
    - `excel-utils` (22 tests)
    - Y más...

- **Mock de Firestore mejorado**
  - Soporte para comparaciones de `Timestamp` en queries
  - Manejo correcto de operadores `>=` y `<` con fechas
  - Función `toDate()` implementada correctamente

### 📚 Documentación

- **README.md completamente renovado**
  - Estructura visual moderna con emojis y badges
  - Sección de instalación y configuración detallada
  - Tabla de scripts disponibles
  - Guía de uso paso a paso mejorada
  - Documentación de estructura del proyecto
  - Sección de seguridad y mejores prácticas
  - Historial de versiones
  - Eliminado texto de prueba "hola mundo"

- **BEST_PRACTICES.md creado** (nuevo archivo)
  - Guía exhaustiva para desarrollo seguro
  - Patrones de código recomendados vs anti-patrones
  - Estrategias de testing
  - Gestión de estado y base de datos
  - Prevención de bugs comunes documentados
  - Debugging y deployment
  - Checklist pre-cambios y pre-deploy
  - Semantic versioning explicado

- **CHANGELOG.md creado** (este archivo)
  - Documentación estructurada de cambios
  - Formato Keep a Changelog
  - Categorización clara: Agregado, Cambiado, Corregido, etc.

### 🔧 Refactoring Interno

- **Extracción de lógica en `saveEditedServiceOrder`**
  - Función wrapper con lock mechanism
  - Función interna `_performSaveEditedServiceOrder` con lógica real
  - Separación de responsabilidades

- **Mejora de logs en servicios**
  - Emojis consistentes: 📊 para métricas, ⚠️ para warnings, ❌ para errores
  - Información contextual en cada log
  - Conteo de reads para optimización

### 🔒 Seguridad

- ✅ Prevención de ejecuciones concurrentes
- ✅ Validación de conexión DB pre-autenticación
- ✅ Type-safety mejorado en toda la aplicación
- ✅ Manejo robusto de errores con feedback claro

### ⚠️ Breaking Changes

Ninguno. Esta versión es 100% compatible con v3.0.0.

### 🎯 Migración desde v3.0.x

No se requiere migración. Los cambios son transparentes:
- Datos existentes funcionan sin modificaciones
- No hay cambios en esquema de Firestore
- Cache deshabilitado no afecta funcionalidad (solo performance mínima)

### 📊 Impacto en Performance

- **Firestore reads:** Incremento estimado del 10-15% (cache deshabilitado)
  - ANTES: ~10-50 reads en cargas subsecuentes (delta)
  - AHORA: ~100-200 reads en cada carga (full)
  - BENEFICIO: Datos siempre 100% actualizados

- **Paginación:** Mejora en consistencia
  - Ahora siempre retorna exactamente `pageSize` órdenes activas
  - Separación clara entre activas y eliminadas

---

## [3.0.0] - 2026-02-XX

### Versión base
- Generador de cajas chicas
- Gestión de órdenes de servicio
- Panel de administración
- Autenticación con Firebase
- Base de datos Firestore
- Interfaz con Next.js + ShadCN UI

---

## Tipos de Cambios

- `✨ Agregado` - Nueva funcionalidad
- `⚡ Cambiado` - Cambios en funcionalidad existente
- `🐛 Corregido` - Bug fixes
- `🗑️ Removido` - Funcionalidad eliminada
- `🔒 Seguridad` - Mejoras de seguridad
- `🧪 Testing` - Cambios en tests
- `📚 Documentación` - Cambios en documentación
- `⚠️ Breaking Changes` - Cambios incompatibles con versión anterior
- `🔧 Refactoring` - Cambios internos sin afectar funcionalidad

---

<div align="center">

**Para ver todos los cambios, visitar:** [GitHub Releases](link-to-releases)

[⬆ Volver arriba](#-changelog)

</div>
