<div align="center">

# 🗂️ TourFile Generator

**Gestión Inteligente de Operaciones Turísticas**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.0-orange?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
**Derechos:** código propietario; consulta la sección de licencia.

Aplicación web integral para optimizar las operaciones de agencias de turismo, simplificando la creación de reportes de caja chica y la gestión de órdenes de servicio.

[📖 Documentación](#guía-de-uso) • [🚀 Inicio Rápido](#instalación-y-configuración) • [💡 Características](#-características-principales)

</div>

---

## El proyecto en un minuto

**Autor:** [Daniel Alejandro Carrasco Apaza](https://github.com/danidevdc).

Desarrollé TourFile para el área de operaciones de Crillon Tours, a partir de la necesidad de gestionar cajas chicas de guías y órdenes de trabajo para conductores y guías. La aplicación conecta información de programas turísticos con documentos operativos y catálogos de servicios.

### Funciones relevantes para gestión de datos y procesos

- Importación de programas desde Excel para generar reportes de caja chica y órdenes de servicio.
- Gestión centralizada de datos maestros: guías, conductores, hoteles, actividades, vuelos y buses.
- Configuración de reglas de negocio para relacionar actividades con servicios, tiempos y gastos.
- Validación de formularios con Zod y manejo de datos con TypeScript.
- Generación de documentos en Excel y PDF para apoyar el trabajo del área de operaciones.
- Autenticación con Firebase y almacenamiento de información en Firestore.

**Tecnologías:** Next.js 15, React, TypeScript, Firebase Authentication, Firestore, Tailwind CSS, React Hook Form, Zod, ExcelJS, jsPDF y Vitest.

### English overview

TourFile is a web application developed for Crillon Tours' Operations Department to manage guides' petty cash reports and work orders for drivers and guides. It brings together tourism itineraries, operational documents and service master data.

The project covers Excel imports, master data management, configurable business rules, form validation and Excel/PDF document generation. It demonstrates the connection between tourism operations and software tools for organizing information and standardizing workflows.

**Author:** Daniel Alejandro Carrasco Apaza. **Stack:** Next.js, React, TypeScript, Firebase and Tailwind CSS.

[Características y guía de uso](#-características-principales) · [Instalación](#-instalación-y-configuración) · [Pruebas](./TESTING.md)

---

## ✨ Características Principales

### 💰 Generador de Cajas Chicas
Procesa automáticamente archivos de programa (`.xlsx`) para generar reportes de gastos detallados, aplicando reglas de negocio personalizables.

### 📋 Gestión de Órdenes de Servicio
- Creación automatizada desde archivos Excel
- División inteligente por guías y choferes
- Exportación a PDF y Excel
- Vista previa optimizada para WhatsApp

### 👥 Panel de Administración
- Dashboard con estadísticas en tiempo real
- Gestión de datos maestros (guías, hoteles, choferes, actividades, vuelos)
- Configuración de reglas de negocio
- Administración de usuarios y roles

### 🔐 Autenticación Segura
Sistema completo con Firebase Authentication:
- 🔑 Registro y login
- 📧 Recuperación de contraseña
- 🛡️ Validación de base de datos antes del login
- 📱 Multi-dispositivo simultáneo

### 💾 Base de Datos Centralizada
Firestore para almacenamiento escalable y sincronización en tiempo real.

### 🎨 Interfaz Moderna
- Diseño responsivo (desktop y mobile)
- Tema claro/oscuro
- Componentes UI con ShadCN
- Experiencia de usuario fluida

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 20 LTS o una versión compatible con Next.js 15 
- npm o yarn
- Cuenta de Firebase con proyecto configurado

### Configuración Inicial

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/danidevdc/tourfile.git
   cd tourfile
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Crear archivo `.env.local` en la raíz del proyecto:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en navegador**
   ```
   http://localhost:9003
   ```

### Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo (puerto 9003) |
| `npm run build` | Genera build de producción |
| `npm start` | Inicia servidor de producción |
| `npm test` | Ejecuta tests unitarios |
| `npm run test:ui` | Inicia Vitest en modo interactivo/watch |
| `npm run lint` | Verifica código con ESLint |
| `npm run typecheck` | Verifica tipos de TypeScript |

---

## 📖 Guía de Uso

### 💰 Cajas Chicas

Genera reportes de gastos automáticamente desde archivos de programa.

1. **Acceder al módulo:** Página principal → "Cajas Chicas" → Seleccionar ciudad
2. **Subir archivo:** Cargar programa mensual (`.xlsx`)
3. **Buscar File:** Ingresar número de File → Buscar
4. **Configurar:** Seleccionar guía responsable
5. **Generar:** Clic en "Generar" → Reporte aparece en lista
6. **Exportar:** 
   - 👁️ Visualizar detalles
   - 📥 Descargar Excel individual
   - 📦 Descargar múltiples en ZIP

### 📋 Órdenes de Servicio

Crea y gestiona órdenes para guías y choferes.

#### Crear Nueva Orden

**🤖 Modo Automatizado:**
1. Subir archivo de programa
2. Buscar por File
3. Sistema genera servicios automáticamente basado en reglas

**✍️ Modo Manual:**
1. Completar datos generales (File, Guía, Hotel)
2. Añadir servicios uno por uno
3. Configurar horarios y responsables

#### Gestionar Órdenes

- **👁️ Visualizar:** Vista previa optimizada para WhatsApp
- **✏️ Editar:** Modificar itinerario y datos
  - División automática si hay múltiples guías/choferes
  - Protección contra ediciones duplicadas
- **📥 Descargar Excel:** Exportar a `.xlsx`
- **🖨️ Imprimir PDF:** Vista de impresión profesional
- **🗑️ Eliminar:** Mover a archivo de eliminadas (solo admin)

#### Filtros (Admin)

- **Activas:** Órdenes en uso
- **Todas:** Ver todas las órdenes activas
- **Ver Eliminadas:** Página separada con órdenes archivadas
  - Función de restauración disponible

---

## 👑 Panel de Administración

Control total sobre datos y lógica de la aplicación.

### 📊 Dashboard
- Vista general del sistema
- Estadísticas de uso en tiempo real
- Reportes por mes y por guía
- Acceso rápido a todas las secciones

### 🗃️ Datos Maestros

Gestión centralizada de:
- 👤 **Guías:** Registro completo con nombre y apellido
- 🏨 **Hoteles:** Base de datos de alojamientos
- 🚗 **Choferes:** Conductores asignados
- 🎯 **Actividades:** Servicios con tiempos sugeridos
- ✈️ **Vuelos:** Vuelos predefinidos con horarios
- 🚌 **Buses:** Flota de vehículos disponibles

**Funcionalidades:**
- ✏️ CRUD completo (Crear, Leer, Actualizar, Eliminar)
- 📤 Carga masiva desde archivos Excel
- 🔍 Búsqueda y filtrado
- 📝 Validación de datos

### ⚙️ Configuración de Lógica

**Reglas de Caja Chica:**
```
Ejemplo: "Si itinerario contiene 'Tiwanaku'
         → Añadir gasto de 100 BOB por pasajero"
```

**Reglas de Órdenes de Servicio:**
```
Ejemplo: "CITY TOUR" → Actividad "City Tour La Paz"
         Tiempo sugerido: 03:00 horas
```

### 👥 Gestión de Usuarios

- Lista completa de usuarios registrados
- Asignación de roles (Admin/Usuario)
- Métricas de actividad
- Historial de reportes generados

---

## 🛠️ Tecnologías Utilizadas

### Core
- **⚡ Next.js 15** - Framework React con App Router
- **📘 TypeScript 5** - Tipado estático y type-safety
- **🔥 Firebase** - Backend as a Service
  - Authentication (autenticación de usuarios)
  - Firestore (base de datos NoSQL)
  - Hosting (despliegue de aplicación)

### Frontend
- **🎨 Tailwind CSS** - Estilos utility-first
- **🧩 ShadCN UI** - Componentes accesibles y personalizables
- **📝 React Hook Form** - Manejo eficiente de formularios
- **✅ Zod** - Validación de esquemas TypeScript-first
- **📅 date-fns** - Manipulación de fechas

### Generación de Archivos
- **📊 xlsx** - Lectura de archivos Excel
- **📈 exceljs** - Generación de reportes Excel
- **📸 html2canvas** - Captura de imágenes para compartir
- **🖨️ jsPDF** - Generación de PDFs

### Testing
- **🧪 Vitest** - Framework de testing rápido

### Desarrollo
- **🔧 ESLint** - Linter para calidad de código
- **🚀 Turbopack** - Bundler de desarrollo rápido

---

## 📁 Estructura del Proyecto

```
tourfile/
├── src/
│   ├── app/              # App Router de Next.js
│   │   ├── (main)/       # Rutas principales
│   │   ├── api/          # API routes
│   │   ├── login/        # Autenticación
│   │   └── layout.tsx    # Layout raíz
│   ├── components/       # Componentes React
│   │   ├── ui/           # Componentes UI base (ShadCN)
│   │   ├── auth/         # Componentes de autenticación
│   │   ├── layout/       # Layouts y navegación
│   │   └── service-order/ # Componentes de órdenes
│   ├── lib/              # Lógica de negocio
│   │   ├── firebase.ts           # Configuración Firebase
│   │   ├── serviceOrderStorage.ts # CRUD de órdenes
│   │   ├── reportService.ts       # Generación de reportes
│   │   └── validators.ts          # Validaciones Zod
│   ├── hooks/            # Custom React hooks
│   ├── types/            # Definiciones TypeScript
│   └── __tests__/        # Pruebas unitarias
├── public/               # Archivos estáticos
├── docs/                 # Documentación del proyecto
├── functions/            # Cloud Functions (Firebase)

```

---

## 🔒 Seguridad y Mejores Prácticas

### Protecciones Implementadas

✅ **Prevención de duplicados:** Lock mechanism en guardado de órdenes  
✅ **Validación de DB:** Verificación de conexión antes de login  
✅ **Type-safety:** TypeScript en todo el código  
✅ **Validación de entrada:** Zod schemas en formularios  
✅ **Multi-dispositivo:** Sesiones concurrentes permitidas  
✅ **Paginación optimizada:** Cursor-based para grandes datasets  

### Recomendaciones

📋 **Ver [BEST_PRACTICES.md](./BEST_PRACTICES.md)** para guía completa sobre:
- Cómo hacer cambios seguros
- Patrones a seguir
- Debugging y testing
- Deployment

---

## 📊 Versiones

### Notas de la versión 3.1.0
- ✨ Nueva página de órdenes eliminadas para admin
- ✨ Paginación mejorada con filtro de estado
- ✨ Ordenamiento por columnas (4 campos)
- ✨ Multi-dispositivo simultáneo
- ✨ Validación de DB antes de login
- ✨ Protección contra guardados duplicados
- ⚡ Cache deshabilitado (datos siempre frescos)
- 🐛 Fix: Paginación mostrando cantidad incorrecta
- 🧪 Pruebas unitarias con Vitest; consulta [TESTING.md](./TESTING.md).

---

## 🤝 Contribución

Este repositorio es público para presentar el proyecto y su documentación. Para proponer mejoras:

1. Revisar [BEST_PRACTICES.md](./BEST_PRACTICES.md)
2. Crear una rama desde `master`
3. Hacer cambios con commits descriptivos
4. Ejecutar tests: `npm test`
5. Verificar no hay errores: `npm run typecheck`
6. Crear Pull Request con descripción detallada

---

## 📝 Licencia

Este proyecto es propietario. La disponibilidad pública del repositorio no modifica sus derechos ni concede una licencia de uso, modificación o distribución. Todos los derechos reservados.

---

## 📞 Soporte

Para reportar problemas o solicitar funcionalidades, contactar al equipo de desarrollo.

---

<div align="center">

**Hecho con ❤️ para optimizar operaciones turísticas**

[⬆ Volver arriba](#-tourfile-generator)

</div>
