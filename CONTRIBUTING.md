# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir a TourFile Generator! Este documento te guiará a través del proceso de contribución.

---

## 📋 Tabla de Contenido

1. [Código de Conducta](#código-de-conducta)
2. [Cómo Empezar](#cómo-empezar)
3. [Flujo de Trabajo](#flujo-de-trabajo)
4. [Estándares de Código](#estándares-de-código)
5. [Commits y Mensajes](#commits-y-mensajes)
6. [Pull Requests](#pull-requests)
7. [Reporte de Bugs](#reporte-de-bugs)
8. [Propuesta de Features](#propuesta-de-features)

---

## 📜 Código de Conducta

Este proyecto sigue un código de conducta profesional. Al participar, se espera que:

- ✅ Seas respetuoso con todos los colaboradores
- ✅ Proporciones feedback constructivo
- ✅ Te enfoques en lo mejor para el proyecto
- ✅ Muestres empatía hacia otros miembros
- ❌ No uses lenguaje ofensivo o inapropiado
- ❌ No hagas ataques personales

---

## 🚀 Cómo Empezar

### Prerrequisitos

Asegúrate de tener instalado:
- Node.js 18+ 
- Git
- Editor de código (recomendado: VSCode)
- Cuenta de Firebase para desarrollo local

### Setup Inicial

1. **Fork del repositorio** (si no tienes acceso directo)
   ```bash
   # En GitHub, click en "Fork"
   ```

2. **Clonar tu fork**
   ```bash
   git clone https://github.com/TU_USUARIO/tourfile.git
   cd tourfile
   ```

3. **Agregar upstream remote**
   ```bash
   git remote add upstream https://github.com/REPO_ORIGINAL/tourfile.git
   ```

4. **Instalar dependencias**
   ```bash
   npm install
   ```

5. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales de Firebase
   ```

6. **Verificar instalación**
   ```bash
   npm run dev
   # Abrir http://localhost:9003
   ```

---

## 🔄 Flujo de Trabajo

### 1. Sincronizar con main

Antes de empezar, asegúrate de tener los últimos cambios:

```bash
git checkout main
git pull upstream main
git push origin main  # Si usas fork
```

### 2. Crear Branch

**Nomenclatura de branches:**

- `feature/nombre-descriptivo` - Nueva funcionalidad
- `fix/descripcion-bug` - Corrección de bugs
- `refactor/area-a-mejorar` - Refactoring
- `docs/que-se-documenta` - Documentación
- `test/que-se-testea` - Tests

**Ejemplos:**
```bash
git checkout -b feature/export-pdf-orders
git checkout -b fix/pagination-duplicate-items
git checkout -b refactor/optimize-firestore-queries
git checkout -b docs/update-readme-setup
```

### 3. Hacer Cambios

**Checklist antes de commit:**

- [ ] Código sigue estándares del proyecto
- [ ] Tests pasan: `npm test`
- [ ] No hay errores de TypeScript: `npm run typecheck`
- [ ] No hay errores de linting: `npm run lint` 
- [ ] Cambios están documentados (si aplica)
- [ ] README actualizado (si agregaste features/scripts)

### 4. Commit

Ver [sección de commits](#commits-y-mensajes) para formato.

### 5. Push a tu Fork/Branch

```bash
git push origin feature/tu-feature
```

### 6. Crear Pull Request

Ver [sección de Pull Requests](#pull-requests).

---

## 📏 Estándares de Código

### TypeScript

- ✅ **Siempre tipar** variables, parámetros y returns
- ✅ Usar interfaces para objetos, types para unions/primitivos
- ✅ Evitar `any` - usar `unknown` si es necesario
- ✅ Habilitar strict mode en tsconfig

```typescript
// ❌ MAL
function processOrder(order: any) {
    return order.data;
}

// ✅ BIEN
interface Order {
    id: string;
    data: ServiceOrderData;
}

function processOrder(order: Order): ServiceOrderData {
    return order.data;
}
```

### React/Next.js

- ✅ Componentes funcionales con hooks
- ✅ Usar `"use client"` solo cuando sea necesario
- ✅ Memorizar callbacks y valores con `useCallback`/`useMemo`
- ✅ Extraer lógica compleja a custom hooks

```typescript
// ✅ BIEN - Custom hook reutilizable
function useOrders(pageSize: number) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getServiceOrdersPaginated(pageSize);
            setOrders(data.orders);
        } finally {
            setLoading(false);
        }
    }, [pageSize]);
    
    return { orders, loading, fetchOrders };
}
```

### Estilos (Tailwind)

- ✅ Usar utility classes de Tailwind
- ✅ Agrupar clases: layout → spacing → sizing → colors → effects
- ✅ Usar `cn()` helper para clases condicionales
- ✅ Theme colors (`primary`, `secondary`, `destructive`, etc.)

```typescript
// ✅ BIEN - Organizado y con cn()
<Button className={cn(
    "flex items-center gap-2",  // Layout
    "px-4 py-2",                 // Spacing
    "text-sm font-medium",       // Typography
    "bg-primary hover:bg-primary/90",  // Colors
    "rounded-md shadow-sm",      // Effects
    isDisabled && "opacity-50 cursor-not-allowed"  // Conditional
)}>
    Click me
</Button>
```

### Firestore

- ✅ Siempre usar batch para múltiples writes
- ✅ Limitar queries con `limit()`
- ✅ Log de reads para optimización
- ✅ Manejo de errores robusto

```typescript
// ✅ BIEN
const batch = writeBatch(db);

orders.forEach(order => {
    const ref = doc(db, 'orders', order.id);
    batch.update(ref, { status: 'processed' });
});

try {
    await batch.commit();
    console.log(`✅ Updated ${orders.length} orders`);
} catch (error) {
    console.error('❌ Batch update failed:', error);
    throw error;
}
```

### Naming Conventions

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Variables/Functions | camelCase | `getUserProfile()` |
| Constants | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| Interfaces | PascalCase + "Props"/"Data" | `ButtonProps`, `OrderData` |
| Types | PascalCase | `OrderStatus` |
| Components | PascalCase | `ServiceOrderCard` |
| Files (components) | PascalCase.tsx | `ServiceOrderCard.tsx` |
| Files (utils) | camelCase.ts | `formatDate.ts` |

---

## 💬 Commits y Mensajes

### Formato de Commit

Usar [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<scope>): <descripción corta>

[cuerpo opcional con detalles]

[footer opcional con referencias]
```

### Tipos Permitidos

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `refactor`: Refactoring sin cambiar funcionalidad
- `docs`: Cambios en documentación
- `style`: Formateo, puntos y comas, etc (no afecta código)
- `test`: Agregar o modificar tests
- `chore`: Mantenimiento (deps, config, etc)
- `perf`: Mejoras de performance

### Ejemplos de Buenos Commits

```bash
# Feature
git commit -m "feat(orders): agregar paginación cursor-based en listado"

# Bug fix
git commit -m "fix(pagination): corregir duplicación de órdenes hijas al editar"

# Refactor
git commit -m "refactor(storage): extraer lógica de lock a función separada"

# Docs
git commit -m "docs(readme): actualizar sección de instalación con screenshots"

# Test
git commit -m "test(orders): agregar tests para detección de duplicados"

# Con cuerpo
git commit -m "feat(admin): agregar página de órdenes eliminadas

- Nueva ruta /deleted-orders solo para admin
- Query optimizada con índice compuesto
- Función de restauración de órdenes
- UI con tema rojo distintivo

Closes #123"
```

### ❌ Ejemplos de Malos Commits

```bash
# Muy vago
git commit -m "fix bug"
git commit -m "update"
git commit -m "wip"

# Sin tipo
git commit -m "agregué paginación"

# Muy largo en descripción corta
git commit -m "feat: agregué toda la funcionalidad nueva de paginación con cursor y arreglé varios bugs de performance"
```

---

## 🔀 Pull Requests

### Antes de Crear PR

- [ ] Branch actualizado con `main`
- [ ] Todos los tests pasan
- [ ] No hay conflictos
- [ ] Commits tienen mensajes claros
- [ ] CHANGELOG actualizado (si aplica)

### Título del PR

Seguir mismo formato que commits:

```
feat(orders): agregar exportación a PDF
fix(auth): corregir validación de email en registro
```

### Descripción del PR

Usar template:

```markdown
## 📝 Descripción

[Breve descripción de qué hace este PR]

## 🎯 Motivación y Contexto

[¿Por qué es necesario este cambio? ¿Qué problema resuelve?]

## 🔧 Tipo de Cambio

- [ ] 🐛 Bug fix (cambio que corrige un issue)
- [ ] ✨ Nueva feature (cambio que agrega funcionalidad)
- [ ] ⚡ Mejora (cambio que mejora funcionalidad existente)
- [ ] 🔨 Refactor (cambio que no corrige bug ni agrega feature)
- [ ] 📚 Documentación
- [ ] ⚠️ Breaking change (cambio que rompe compatibilidad)

## ✅ Checklist

- [ ] He seguido los estándares de código del proyecto
- [ ] He realizado self-review de mi código
- [ ] He comentado áreas complejas de mi código
- [ ] He actualizado documentación relacionada
- [ ] Mis cambios no generan nuevos warnings
- [ ] He agregado tests que prueban mi fix/feature
- [ ] Tests unitarios pasan localmente (`npm test`)
- [ ] TypeScript compile sin errores (`npm run typecheck`)
- [ ] He actualizado CHANGELOG.md (si aplica)

## 📸 Screenshots (si aplica)

[Agregar screenshots de cambios UI]

## 🧪 Cómo Testear

1. Checkout del branch: `git checkout feature/mi-feature`
2. Instalar deps: `npm install`
3. Correr dev: `npm run dev`
4. Pasos específicos para testear la funcionalidad...

## 🔗 Issues Relacionados

Closes #123
Relates to #456

## 📌 Notas Adicionales

[Cualquier información adicional relevante]
```

### Proceso de Review

1. **Autor crea PR** con descripción completa
2. **Reviewers son asignados** automáticamente
3. **Review inicial** (1-2 días laborables)
4. **Feedback** - cambios solicitados o aprobación
5. **Autor implementa cambios** (si hay feedback)
6. **Re-review** hasta aprobación
7. **Merge** - por maintainer authorized

### Durante Review

**Como autor:**
- ✅ Responde feedback de manera constructiva
- ✅ Implementa cambios solicitados
- ✅ Push nuevos commits (no force-push durante review)
- ✅ Marca conversaciones como resueltas apropiadamente

**Como reviewer:**
- ✅ Proporciona feedback constructivo y específico
- ✅ Sugiere mejoras en lugar de solo criticar
- ✅ Prueba los cambios localmente si es posible
- ✅ Aprueba cuando todo está bien

---

## 🐛 Reporte de Bugs

### Antes de Reportar

1. **Buscar duplicados** - ¿Alguien ya reportó esto?
2. **Versión actualizada** - ¿Ocurre en la última versión?
3. **Reproducible** - ¿Puedes reproducirlo consistentemente?

### Crear Issue de Bug

**Título:** Breve descripción del problema

**Template:**

```markdown
## 🐛 Descripción del Bug

[Descripción clara de qué es el bug]

## 🔄 Pasos para Reproducir

1. Ir a '...'
2. Click en '...'
3. Scroll hasta '...'
4. Ver error

## ✅ Comportamiento Esperado

[Qué esperabas que pasara]

## ❌ Comportamiento Actual

[Qué está pasando actualmente]

## 📸 Screenshots

[Si aplica, agregar screenshots]

## 🌍 Entorno

- **OS**: [e.g. Windows 11, macOS 13]
- **Browser**: [e.g. Chrome 120, Firefox 121]
- **Versión App**: [e.g. 3.1.0]
- **Node Version**: [e.g. 18.17.0]

## 📋 Logs

```
[Pegar logs de consola si hay]
```

## 🔍 Contexto Adicional

[Cualquier otra información relevante]

## 🎯 Severidad

- [ ] 🔴 Crítico - La app no funciona
- [ ] 🟠 Alto - Funcionalidad importante rota
- [ ] 🟡 Medio - Bug menor pero molesto
- [ ] 🟢 Bajo - Cosmético o edge case
```

---

## 💡 Propuesta de Features

### Antes de Proponer

1. **Revisar roadmap** - ¿Ya está planeado?
2. **Buscar similares** - ¿Alguien lo propuso?
3. **Considerar scope** - ¿Encaja con la visión del proyecto?

### Crear Issue de Feature

**Título:** `[Feature Request] Breve descripción`

**Template:**

```markdown
## 💡 Feature Solicitada

[Descripción clara de la feature que quieres]

## 🎯 Problema que Resuelve

[Describe el problema que esta feature resolvería]

## 💭 Solución Propuesta

[Cómo imaginás que funcionaría]

## 🔄 Alternativas Consideradas

[Otras soluciones que consideraste]

## 📸 Mockups (opcional)

[Wireframes o diseños si tienes]

## ✨ Beneficios

- Beneficio 1
- Beneficio 2

## ⚠️ Consideraciones

- Posible complejidad
- Impacto en otras features
- Recursos necesarios

## 🎯 Prioridad Sugerida

- [ ] 🔴 Alta - Necesaria para uso básico
- [ ] 🟡 Media - Mejoraría UX significativamente  
- [ ] 🟢 Baja - Nice to have

## 📚 Contexto Adicional

[Cualquier información extra]
```

---

## 🧪 Testing

### Escribir Tests

**Para cada feature nueva:**

```typescript
// src/__tests__/unit/myFeature.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '@/lib/myFeature';

describe('myFunction', () => {
    beforeEach(() => {
        // Setup antes de cada test
    });

    it('should handle normal input', () => {
        const result = myFunction('input');
        expect(result).toBe('expected');
    });

    it('should handle edge case - empty input', () => {
        const result = myFunction('');
        expect(result).toBe('default');
    });

    it('should throw on invalid input', () => {
        expect(() => myFunction(null)).toThrow('Invalid input');
    });
});
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Con watch mode
npm run test:ui

# Tests específicos
npm test myFeature.test.ts

# Con coverage
npm test -- --coverage
```

---

## 📚 Recursos Útiles

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Firebase Docs](https://firebase.google.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)

---

## 💬 Preguntas

Si tienes preguntas que no están cubiertas aquí:

1. Revisa la documentación en `/docs`
2. Busca en issues cerrados
3. Crea un issue con label `question`
4. Contacta al equipo de desarrollo

---

## 🙏 Agradecimientos

¡Gracias por contribuir a TourFile Generator! Tu tiempo y esfuerzo son muy apreciados.

---

<div align="center">

**Desarrollado con ❤️ por la comunidad**

[⬆ Volver arriba](#-guía-de-contribución)

</div>
