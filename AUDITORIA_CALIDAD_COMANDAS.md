# 📋 Reporte de Auditoría de Calidad y Pendientes — Comandas Térmicas y Flujos Recientes

**Fecha:** 2026-09-10  
**Agente Auditor:** 🌀 **Gravedad** (Google Antigravity)  
**Agente de Desarrollo para Continuación:** 💻 **Código** (OpenCode)  
**Alcance:** Commits recientes de la rama `main` (`57164a8` a `c355d8a`), enfocado en la funcionalidad de impresión de comandas de mostrador (`src/utils/comanda-*`, `receive.tsx`, `jobs.tsx`, `job/[id].tsx`), badge/WhatsApp de Beta Testers (`beta-bits.tsx`) y ciclo de offboarding de técnicos (`admin.tsx`, `auth-context.tsx`).

---

## 🎯 Resumen Ejecutivo

La suite de pruebas base actual (`npm test`) pasa al 100% (152/152 pruebas exitosas) y el compilador TypeScript (`tsc --noEmit`) no reporta errores estáticos. Sin embargo, al someter el sistema a **pruebas adversarias, datos legacy incompletos, tipos laxos (pistolas de código de barras/PIN numéricos) y comportamiento de impresoras térmicas en navegadores POS**, se detectaron **7 fallas de programación** que requieren atención antes del uso intensivo en el mostrador físico.

Este documento establece el informe técnico detallado y la lista de tareas pendientes para la sesión de trabajo de mañana.

---

## 🔬 Detalle de Hallazgos y Errores Detectados

### 1. 💥 [CRÍTICO] Caída por `TypeError` en `escapeHtml` ante valores nulos o indefinidos
- **Archivo:** [`src/utils/comanda-template.ts`](./src/utils/comanda-template.ts#L11-L19)
- **Causa raíz:** `escapeHtml(value: string)` invoca directamente `value.replace(...)` sin validar que `value` exista. En órdenes históricas de la base de datos o campos de texto vacíos/nulos (`clientName`, `clientPhone`, `device`, `issue`, `technicianName`, `receivedBy`), arroja inmediatamente:
  ```
  TypeError: Cannot read properties of undefined (reading 'replace')
  TypeError: Cannot read properties of null (reading 'replace')
  ```
- **Impacto:** Crash total al presionar "Imprimir comanda", bloqueando la acción tanto en el modal post-recepción como en la lista de trabajos y vista de detalle.
- **Acción requerida:** Sanitizar la entrada convirtiendo cualquier valor nulo/indefinido en cadena vacía:
  ```typescript
  export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  ```

---

### 2. 💥 [ALTO] Excepción de tipo al procesar IMEI o Códigos de Desbloqueo numéricos
- **Archivo:** [`src/utils/comanda-template.ts`](./src/utils/comanda-template.ts#L28-L34)
- **Causa raíz:** Se llama directamente a `.trim()` sobre `data.imei` y `data.unlockCode`:
  ```typescript
  const imeiRow = data.imei?.trim() ? ... : '';
  const securityRow = data.unlockCode?.trim() ? ... : '';
  ```
  Cuando un lector de código de barras, un payload JSON o un input numérico (ej. PIN `1234`) entrega un tipo número (`number`), el encadenamiento opcional `?.trim()` falla con:
  ```
  TypeError: data.imei?.trim is not a function
  TypeError: data.unlockCode?.trim is not a function
  ```
- **Impacto:** Fallo inmediato en la generación del HTML de la comanda para cualquier equipo con PIN puramente numérico o IMEI numérico.
- **Acción requerida:** Coaccionar a string antes de ejecutar `.trim()`:
  ```typescript
  const imeiStr = data.imei != null ? String(data.imei).trim() : '';
  const securityStr = data.unlockCode != null ? String(data.unlockCode).trim() : '';
  ```

---

### 3. ⚠️ [ALTO] Condición de carrera en navegador e impresoras térmicas Web
- **Archivo:** [`src/utils/comanda-printer.web.ts`](./src/utils/comanda-printer.web.ts#L48-L53)
- **Causa raíz:** 
  1. **Timeout fijo de 2000ms (`setTimeout(() => frame.remove(), 2000)`):** Si el operador del taller tarda más de 2 segundos en el cuadro de diálogo de impresión del sistema o si la impresora térmica tarda en recibir el spool, la eliminación forzada del iframe huérfano cancela o congela la impresión en navegadores Chromium y Firefox.
  2. **Impresión en blanco en WebKit/Safari:** Invocar síncronamente `frameWindow.print()` de inmediato tras `frameDoc.close()` sin aguardar al ciclo de renderizado del DOM del iframe provoca impresiones en blanco.
- **Acción requerida:**
  - Escuchar el evento nativo `onafterprint` en `frameWindow` para remover el iframe únicamente después de que el diálogo se cierre o imprima, manteniendo un temporizador de rescate amplio (ej. 60s).
  - Envolver la llamada a `print()` en un `requestAnimationFrame` o esperar el evento `DOMContentLoaded`/`load` del iframe.

---

### 4. ⚠️ [MEDIO] Carácter UTF-8 no codificado en WhatsApp y fragilidad de `window` en SSR
- **Archivo:** [`src/components/ui/beta-bits.tsx`](./src/components/ui/beta-bits.tsx#L24-L33)
- **Causa raíz:**
  1. La constante `BETA_WHATSAPP_URL` contiene el carácter `ó` en crudo (`extensión`) en la query string. En parsers estrictos de Android (`android.net.Uri.parse`) o WebViews embebidos, los caracteres no-ASCII pueden provocar `IllegalArgumentException` o truncamiento del mensaje.
  2. `openBetaWhatsApp` accede a `window.open` asumiendo que `window` existe si `Platform.OS === 'web'`. En SSR o prerenderizado estático genera `ReferenceError: window is not defined`.
- **Acción requerida:**
  - Codificar el parámetro con `encodeURIComponent`.
  - Utilizar de forma unificada `Linking.openURL(BETA_WHATSAPP_URL)` (compatible universalmente tanto en Web como en Android e iOS sin bifurcación frágil).

---

### 5. ⚠️ [MEDIO] Trampa de navegación y propagación de eventos en Modal de Recepción
- **Archivo:** [`src/app/(tabs)/receive.tsx`](./src/app/(tabs)/receive.tsx#L240-L280 y #L498-L525)
- **Causa raíz:**
  1. **Bloqueo si falta `repair`:** Se removió la navegación automática a `/jobs`. Si por cualquier inconsistencia de la API `result.ok` es true pero `result.repair` es nulo, el formulario se resetea pero el modal no se abre, dejando al usuario bloqueado en la vista de recepción vacía.
  2. **Burbujeo de clics en Web:** En el modal, `<Pressable testID="comanda-modal-scrim" onPress={goJobs}>` envuelve la tarjeta `<Pressable onPress={() => {}}>`. En React Native Web, una función vacía no detiene la propagación de eventos del DOM. Un clic accidental en los márgenes de la tarjeta o espacio en blanco burbujea y dispara `goJobs()`, cerrando el modal antes de que el usuario logre imprimir.
- **Acción requerida:**
  - Asegurar navegación o feedback fallback en `handleSave` si `result.repair` no está presente.
  - Separar el scrim de fondo como un elemento hermano absoluto independiente detrás de la tarjeta, evitando que el contenedor interactivo envuelva el diálogo.

---

### 6. ℹ️ [BAJO] Desincronización de reloj local en la marca de agua de Reimpresión
- **Archivos:** [`src/app/job/[id].tsx`](./src/app/job/[id].tsx#L75) y [`src/app/(tabs)/jobs.tsx`](./src/app/(tabs)/jobs.tsx#L125)
- **Detalle:** `reprintedAt: new Date().toLocaleString('es-CO')` toma el reloj de la máquina cliente. Si el equipo del mostrador tiene hora desfasada o corre en zona horaria UTC, el ticket impreso refleja una hora inexacta. Se recomienda forzar `timeZone: 'America/Bogota'`.

---

### 7. ℹ️ [BAJO / SEGURIDAD] Bypass momentáneo de técnico inactivo por fallo de red
- **Archivo:** [`src/context/auth-context.tsx`](./src/context/auth-context.tsx#L245-L255)
- **Detalle:** Si `fetchAuthoritativeProfile` falla por timeout de red, devuelve `null` y la verificación `if (authProf && !authProf.isActive)` no se ejecuta, otorgando paso transitorio a nivel de cliente hasta que RLS bloquee la siguiente petición. Se recomienda tratar el fallo de rol autoritativo con política de fallo cerrado (deny by default).

---

## 📋 Lista de Tareas Pendientes para Mañana (Sprint de Estabilidad)

- [ ] **Tarea 1 (Crítica):** En `src/utils/comanda-template.ts`, robustecer `escapeHtml` con guardas nulas/indefinidas y cast seguro a `String(value)`.
- [ ] **Tarea 2 (Alta):** En `src/utils/comanda-template.ts`, normalizar `imei` y `unlockCode` con `String(...)` antes de `.trim()`.
- [ ] **Tarea 3 (Alta):** En `src/utils/comanda-printer.web.ts`, reemplazar el `setTimeout(2000)` por el evento `onafterprint` con rescate a 60s, y asegurar que el render del iframe esté completo antes de disparar `print()`.
- [ ] **Tarea 4 (Media):** En `src/components/ui/beta-bits.tsx`, codificar con `encodeURIComponent` la URL de WhatsApp y unificar el llamado con `Linking.openURL`.
- [ ] **Tarea 5 (Media):** En `src/app/(tabs)/receive.tsx`, desacoplar el scrim del modal para eliminar el riesgo de cierre por propagación en web, y añadir fallback si `result.repair` viene vacío.
- [ ] **Tarea 6 (Baja):** Estandarizar la zona horaria `'America/Bogota'` en las marcas de reimpresión de comandas.
- [ ] **Tarea 7 (Tests):** Incorporar las 5 pruebas adversarias a la suite oficial de pruebas unitarias (`src/utils/comanda-printer.test.ts`) para garantizar cero regresiones futuras.
- [ ] **Tarea 8 (Deploy & Smoke Test):** Correr `npm test`, `tsc --noEmit`, desplegar a Vercel y realizar prueba de humo con una orden real desde el mostrador.
