# TourFile Generator

TourFile Generator es una aplicación web integral diseñada para optimizar las operaciones de agencias de turismo. Simplifica la creación de reportes de caja chica y la gestión de órdenes de servicio, todo integrado con un robusto sistema de autenticación y administración basado en Firebase.

## Características Principales

- **Generador de Cajas Chicas:** Procesa automáticamente archivos de programa (`.xlsx`) para generar reportes de gastos detallados, aplicando reglas de negocio personalizables.
- **Gestión de Órdenes de Servicio:** Crea, edita, visualiza e imprime órdenes de servicio. Incluye un generador automatizado que interpreta itinerarios desde archivos Excel.
- **Panel de Administración:** Una sección centralizada para que los administradores gestionen todos los aspectos de la aplicación.
- **Autenticación Segura:** Sistema completo de registro, inicio de sesión y recuperación de contraseña utilizando Firebase Authentication.
- **Base de Datos Centralizada:** Utiliza Firestore para almacenar y gestionar datos maestros como guías, hoteles, choferes, actividades y vuelos.
- **Interfaz Moderna y Adaptable:** Construida con Next.js, React y ShadCN UI, ofreciendo una experiencia de usuario fluida en escritorio y dispositivos móviles.

---

## Guía de Uso

### 1. Cajas Chicas

Esta funcionalidad permite generar reportes de gastos de manera rápida a partir de un archivo de programa.

1.  **Ir a Cajas Chicas:** Desde la página principal, selecciona la opción "Cajas Chicas" y luego la ciudad (ej. La Paz).
2.  **Subir Archivo:** Sube el archivo de programa mensual en formato `.xlsx`.
3.  **Buscar File:** Ingresa el número de "File" que deseas procesar y haz clic en el botón de búsqueda. La aplicación encontrará el grupo y el número de pasajeros (PAX).
4.  **Ingresar Guía:** Escribe el nombre del guía responsable.
5.  **Generar Reporte:** Haz clic en "Generar". El reporte aparecerá en una lista en la parte inferior.
6.  **Visualizar y Descargar:** Puedes visualizar los detalles del reporte o descargarlo directamente en formato Excel. También puedes descargar múltiples reportes en un archivo `.zip`.

### 2. Órdenes de Servicio

Crea y gestiona las órdenes de servicio para los guías y choferes.

1.  **Ir a Órdenes de Servicio:** Desde la página principal, selecciona la opción "Órdenes de Servicio".
2.  **Crear una Nueva Orden:**
    - **Modo Automatizado:** Sube un archivo de programa, busca el "File" y la aplicación generará automáticamente los servicios basándose en las reglas predefinidas.
    - **Modo Manual:** Completa los datos generales (File, Guía, Hotel, etc.) y añade cada servicio manualmente.
3.  **Guardar Orden:** Una vez completada, guarda la orden. Aparecerá en la lista principal.
4.  **Gestionar Órdenes:** En la lista, puedes:
    - **Visualizar:** Obtener una vista previa para copiar como imagen a WhatsApp.
    - **Editar:** Modificar el itinerario o los datos generales. La lógica de edición permite dividir la orden si hay múltiples guías o choferes.
    - **Descargar Excel:** Generar un archivo `.xlsx` de la orden.
    - **Imprimir PDF:** Generar una vista de impresión en formato PDF.
    - **Eliminar:** Marcar una orden como eliminada.

---

## Panel de Administración

El panel de administración ofrece control total sobre los datos y la lógica de la aplicación.

-   **Dashboard:** Ofrece una vista general y acceso a todas las secciones de administración. Muestra estadísticas de uso, como reportes generados por mes y por guía.
-   **Administrar Datos Maestros:** Permite a los administradores añadir, editar y eliminar registros de guías, hoteles, choferes, actividades y vuelos predefinidos. También soporta la carga masiva de datos desde archivos Excel.
-   **Editar Lógica de Caja Chica:** Personaliza las reglas que se usan para calcular los gastos automáticos en los reportes de caja chica (ej. "si el itinerario contiene 'Tiwanaku', añadir un gasto de 100 BOB por pasajero").
-   **Editar Lógica de Órdenes:** Define las reglas que el generador automático de órdenes de servicio utiliza para asociar palabras clave del itinerario (ej. "CITY TOUR") con actividades específicas de la base de datos.
-   **Administrar Usuarios:** Visualiza una lista de todos los usuarios registrados, sus roles (admin/usuario), y su actividad (número de reportes generados).

---

## Pila Tecnológica (Tech Stack)

-   **Framework:** Next.js (con App Router)
-   **Lenguaje:** TypeScript
-   **Backend y Base de Datos:** Firebase (Authentication, Firestore)
-   **Estilos:** Tailwind CSS
-   **Componentes UI:** ShadCN UI
-   **Generación de Archivos:**
    -   `xlsx` para leer archivos de programa.
    -   `exceljs` para generar los reportes de Excel.
    -   `html2canvas` para la captura de imágenes para WhatsApp.
-   **Gestión de Formularios:** React Hook Form con Zod para validación.

