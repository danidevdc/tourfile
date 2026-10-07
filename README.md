<div align="center">

<img src="public/logo.png" alt="TourFile" width="120" />

# 🗂️ TourFile

**Generación automática de órdenes de servicio, caja chica y liquidaciones para agencias de turismo**

**Autor:** [Daniel Alejandro Carrasco Apaza](https://github.com/danidevdc)

</div>

---

## 📋 Sobre el proyecto

TourFile es una aplicación web que reemplaza el trabajo manual de una agencia de turismo: la creación de **órdenes de servicio**, los **reportes de caja chica**, las **liquidaciones de guías** y el **seguimiento de vuelos** se resolvían antes con hojas de cálculo sueltas, mensajes de WhatsApp y llamadas. Este sistema centraliza esos cuatro flujos en una sola herramienta.

El problema de fondo no era "mostrar datos", sino **convertir información desordenada en documentos oficiales**: un programa mensual en Excel tiene que convertirse en una caja chica con reglas de gasto, y un itinerario tiene que convertirse en órdenes imprimibles que se reparten entre guías y choferes.

### ⚠️ Estado del repositorio

Este software se construyó **a medida para uso interno** y se hace público únicamente con fines de portafolio. No es un producto distribuible:

- No hay instrucciones de instalación porque **no funciona fuera del entorno original**: requiere credenciales de Firebase propias, las claves de las APIs de vuelos (FlightAware / AirLabs / NAABOL) y datos maestros de la agencia.
- El código se lee, se estudia y se prueba — los tests corren de forma aislada sin backend.
- Toda referencia a personas, proveedores o clientes reales fue removida o anonimizada.

---

## 🖼️ Vista general

<div align="center">
<img src="docs/screenshots/inicio.png" alt="Pantalla de bienvenida de TourFile con acceso a los cinco módulos" width="820" />
</div>

---

## ✨ Módulos principales

### 📋 Órdenes de Servicio — el módulo central

El corazón del sistema. Cada orden se genera desde el programa mensual en Excel o se arma a mano, y después se administra: editar, dividir, duplicar, exportar, imprimir.

- **Generación automática** desde el programa: se busca el número de File y el sistema arma los servicios aplicando las reglas de negocio configuradas.
- **Familias de órdenes** — una orden madre se puede dividir automáticamente en órdenes hijas por guía y por chofer. Toda la familia se edita y exporta como una sola, sin duplicar trabajo.
- **Duplicación por responsable** — cada guía y chofer recibe su copia idéntica; solo cambia el nombre del responsable, y el chofer lleva el listado de guías en cada fila.
- **División por `TBA`** — los servicios sin bus confirmado se aíslan en una orden aparte.
- **Vista previa para WhatsApp** — una vista pensada para leerse en el celular y enviarse por mensaje.
- **Exportación a Excel y a PDF** con plantilla de impresión profesional.
- **Estados y badges** — `creado`, `enviado`, `impreso`, `excel`, `editado`, `cancelado`, más las marcas de `Duplicada` / `Separada` / `Dividida`.
- **Borrado lógico + restauración** — las órdenes eliminadas no se pierden; hay una vista de papelera con un botón de restaurar.
- **Paginación por cursor** en Firestore, con ordenamiento por columna y búsqueda inteligente por campos.

### 💰 Generador de Caja Chica

Convierte el programa mensual de Excel en reportes de gastos listos para entregar.

- Sube el `.xlsx`, busca el File y se genera el reporte.
- **Motores de reglas configurables** — cada regla dispara un gasto a partir del contenido del itinerario (por ejemplo, un gasto por pasajero cuando aparece determinado lugar).
- Los reportes duplicados se marcan visualmente para evitar double-reporting.
- Exportación individual o descarga masiva de todos los reportes en un **ZIP**.
- Contador de reportes por usuario para medir uso real de la herramienta.

### 💸 Liquidación de Guías

Cierra el ciclo económico: qué se le debe a cada guía y en qué estado está el pago.

- **Busqueda por guía + mes + año**, que cruza automáticamente las órdenes del período con las liquidaciones existentes y marca cada File como `SIN LIQUIDAR` / `SOLICITADO` / `PAGADO`.
- **Motor de criterios de precio** — analiza el histórico de órdenes y sugiere un precio por actividad según idioma, turno diurno/nocturno y si el grupo es de 5 personas o más. Incluye un panel **"Probar Motor"** para verificar el cálculo antes de aplicarlo.
- Precio automático al crear una liquidación: el idioma del guía se sugiere solo y se recuerda para las siguientes.
- Registro de pago con fecha, edición de montos línea por línea y **PDF con el logo de la agencia**.
- Historial con filtros por estado y búsqueda por guía, File, número de liquidación o pasajero.

### ✈️ Búsqueda de Vuelos

Buscador de un vuelo por número y fecha, con estética de tablero de aeropuerto.

- Consulta **tres proveedores** en cascada: NAABOL (tablero oficial de Bolivia), FlightAware AeroAPI y AirLabs, con preferencia por el resultado que toca `LPB`.
- **Cuotas diarias por proveedor** controladas por transacciones en Firestore, con medidor de uso y estimación de costo consumida del crédito gratuito. Si una API falla, el sistema sigue funcionando.
- **Caché de rutas** que guarda origen, destino, segmento y duración real de cada vuelo, para hacer las consultas siguientes más rápidas y para completar horarios incompletos.
- Normalización de códigos de aerolínea entre IATA e ICAO (`8J`↔`ECO`, `AVA`↔`AV`, `LA`↔`LAN`, `LPE`…), validación del formato del número de vuelo y manejo de los casos límite de cada proveedor (vuelo demasiado lejano en el futuro, rate limit).
- Todos los horarios se presentan en `America/La_Paz`.

### 🛫 Monitoreo de Vuelos

Cruza las órdenes de servicio próximas contra el tablero operativo real y avisa cuando el mundo no cuadra.

- Panel de **hoy, mañana y pasado mañana**, con actualización cada 75 segundos.
- Cada fila muestra la hora esperada en la orden, la hora real en el tablero y la **diferencia entre ambas**; los descuadres quedan marcados, y los vuelos que no aparecen en el tablero también.
- Guarda el último dato conocido de cada vuelo durante el resto del día, para que un vuelo no desaparezca solo porque el proveedor cerró su ventana.
- Fallback a FlightAware para vuelos que ya pasaron su hora y no tienen dato del tablero.
- **Reloj en vivo GMT-4** corregido contra el header de respuesta del proveedor, para no depender del reloj local desincronizado.

### 👑 Panel de Administración

- **Dashboard** con estadísticas de uso y actividad reciente.
- **Datos maestros** — guías, hoteles, choferes, actividades, vuelos, buses. CRUD completo con carga masiva desde Excel y buscador.
- **Reglas de negocio** — edición de las reglas de caja chica y de las reglas palabra clave → actividad del generador de órdenes, con activación y borrado por regla.
- **Gestión de usuarios** con roles y control de acceso por módulo.

---

## 🛠️ Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) · React 18 · Turbopack |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS 3.4 · ShadCN UI |
| Backend | Firebase 10 — Auth · Firestore · Hosting · Cloud Functions |
| Formularios | React Hook Form · Zod |
| Datos | Recharts |
| Archivos | SheetJS (`xlsx`) · ExcelJS · jsPDF · html2canvas · modern-screenshot · JSZip |
| IA | Genkit + Google Gemini 2.0 Flash *(integración preparada)* |
| Testing | Vitest · Playwright · Testing Library |
| Calidad | ESLint · Prettier |

---

## 💡 Decisiones técnicas destacadas

- **Un solo archivo de configuración por deploy** (`src/config/agency.ts`) concentra nombre, moneda, locale, ciudades y textos por defecto. No hay literales de branding regados por el código, así que adaptar el sistema a otra agencia es editar un archivo.
- **Reglas como datos, no como código** — tanto las reglas de gasto como las de mapeo de actividades y los criterios de precio viven en Firestore y se editan desde la UI, sin deploy.
- **Edición idempotente** — un lock por orden evita que dos clics guarden la misma orden dos veces.
- **Cuotas y cachés en Firestore** — el control de consumo de APIs externas y la caché de rutas usan transacciones y expiración por fecha, de modo que funcionan con varias instancias de la app a la vez.
- **Fallo abierto en servicios no críticos** — si el contador de cuotas falla, permite el uso en lugar de bloquear la herramienta.
- **Zonas horarias explícitas** — `date-fns-tz` y `America/La_Paz` en cada conversión, para que un cambio de horario no corra los reportes.
- **Borrado lógico en todo el módulo de órdenes**, con restauración y sin pérdida de datos.

---

## 🧪 Testing

**215 tests unitarios** en 21 suites, cubriendo las piezas con más riesgo de regresión:

```
npm test          # Vitest — unitarios
npm run test:visual   # Playwright — regresión visual
```

Los tests corren sin backend: la lógica de generación de órdenes, el procesamiento de reportes, los parsers de vuelos, los servicios de liquidación y los formatters están aislados de Firebase.

---

## 📁 Estructura

```
src/
├── app/
│   ├── (main)/                 # Rutas de la aplicación
│   │   ├── service-order/      # Órdenes de servicio
│   │   ├── generator/          # Caja chica
│   │   ├── guide-liquidation/  # Liquidaciones (by-guide, criteria, new, edit, history)
│   │   ├── flight-search/      # Buscador de vuelos
│   │   ├── flight-monitor/     # Monitoreo vs. tablero real
│   │   ├── deleted-orders/     # Papelera de órdenes
│   │   └── admin/              # Dashboard, datos maestros, reglas, usuarios
│   ├── api/                    # Route handlers
│   └── login · register · forgot-password · service-order-print
├── components/                 # Componentes por dominio + UI de ShadCN
├── lib/                        # Lógica de negocio y servicios de datos
│   ├── serviceOrder*.ts        # Generación, consulta, CRUD, caché de órdenes
│   ├── guideLiquidation*.ts    # Motor de criterios y PDFs
│   ├── flight*.ts              # Parsers, cuotas y caché de rutas
│   └── report*.ts              # Caja chica
├── ai/                         # Integraciones de búsqueda de vuelo
├── config/agency.ts            # Configuración del deploy
└── __tests__/unit/             # Tests
```

---

## 📝 Licencia

© TourFile · Todos los derechos reservados. Código publicado con fines informativos y de portafolio; no se concede permiso de uso comercial ni de redistribución.

---

## 🌐 English overview

TourFile is a web application for managing tourism operations: service orders, guides'
petty cash reports, guide settlements and flight tracking. It takes a monthly itinerary
spreadsheet and turns it into the official documents the operations team actually needs —
printable work orders split across guides and drivers, expense reports built from
configurable business rules, and settlement sheets priced by a criteria engine.

**Stack:** Next.js 15, React 18, TypeScript, Firebase (Auth + Firestore), Tailwind CSS,
ExcelJS, jsPDF, Vitest and Playwright.

**Author:** Daniel Alejandro Carrasco Apaza.

---

<div align="center">

**Hecho con ☕ en La Paz, Bolivia**

</div>
