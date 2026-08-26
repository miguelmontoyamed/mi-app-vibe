# Active Context — TechRepair Master

> **Documento de estado actual.** Leer SIEMPRE antes de comenzar cualquier tarea.
> Actualizar al finalizar cada tarea (ver `progress.md`).

## Estado Actual (Consolidado — verificado contra el código)
- **Importaci�n de Inventario PIME (2026-08-26):** Ingesta masiva del cat�logo de repuestos PIME (84 registros) para jaiderpr@gmail.com, vinculando/creando el taller "PIME Accesorios" mediante scripts/import-pime-inventory.mjs. Mapeo de stock y costo con upsert en la tabla public.inventory.
- **Módulo de Compra y Venta de Equipos (Trade-in & Refurbished Devices) optimizado en 3 submódulos (2026-08-25):**
  - Navegación segmentada en 3 pestañas:
    1. **1. Compra de Equipos:** Formulario de adquisición a distribuidores (marca, modelo, IMEI, costo, garantía proveedor) + historial de compras registradas.
    2. **2. Venta de Equipos:** Catálogo de celulares en stock disponibles para vender con formulario rápido de factura/garantía + historial de ventas realizadas con botón para ver/compartir factura en PDF y WhatsApp.
    3. **3. Utilidad e Inventario:** Tarjetas KPI de resumen financiero (Stock, Inversión, Ventas Totales, Utilidad Neta Real) + inventario consolidado con balances por celular y filtros de estado.
  - **Aislamiento Contable Estricto:** La utilidad por reventa de equipos (`Precio Venta − Costo Compra`) vive en `public.devices` y no afecta órdenes de trabajo (`repairs`), presupuestos ni comisiones a técnicos.
  - Factura y Comprobante de Venta con Garantía (`src/app/device-receipt/[id].tsx`): generación e impresión de PDF en web (jsPDF) y nativo (`expo-print`/`expo-sharing`) con botón para compartir por WhatsApp.
  - Suite de pruebas unitarias 122/122 PASS (`device-logic.test.ts`, `device-receipt-pdf-web.test.ts`).
- **Integración de Inventario con Órdenes de Reparación operativa (2026-08-23):**
  modal interactivo en el detalle de la orden (`src/app/job/[id].tsx`) con
  pestañas "Desde Inventario" y "Costo Manual". Permite seleccionar repuestos del
  taller con indicador de stock en tiempo real, selector de cantidad `+ / -`,
  cálculo automático del costo (`parts_cost`) y deducción/reintegro de stock en
  `public.inventory` al asignar, cambiar o remover la pieza. Lógica pura testeada
  en `src/utils/inventory-parts.ts` (+11 tests PASS: `hasAvailableStock`,
  `calculateRemainingStock`, `calculateRestoredStock`, `calculatePartsCost`,
  `filterInventoryParts`). Contexto extendido con `assignInventoryPartToRepair` y
  `removeInventoryPartFromRepair` en `src/context/repair-context.tsx`. Esquema
  espejado en `supabase/schema.sql` con `inventory_part_id`,
  `inventory_part_name` e `inventory_part_qty`.
- **Autocompletado inteligente de repuestos en Recepción con fallback manual (2026-08-24):**
  `PartAutocompleteInput` (`src/components/ui/part-autocomplete-input.tsx`) integrado en `receive.tsx`.
  Sugerencias en tiempo real del inventario del taller (stock > 0) por nombre/categoría con insensibilidad a tildes/mayúsculas
  (`src/utils/part-search.ts`). Al seleccionar sugerencia → autocompleta nombre, setea `selectedPartId`, qty=1, calcula
  `partsCost = precio × qty`, muestra subtotal y badge verde "Se descontará stock".
  Si el texto NO coincide exacto con inventario → `selectedPartId = null`, aparece campo "Valor del Repuesto Manual (COP)"
  con badge amarillo "Repuesto manual — No afecta inventario". Al guardar: `addRepair` valida stock si hay inventario,
  descuenta vía `updateInventoryStock(-qty)`, guarda `inventoryPartId/Name/Qty`; si manual → `inventoryPartId=null`,
  `partsCost = manualPartsCost`, no toca inventario. Separación limpia: `partName` (autocomplete) vs `manualPartsCost` (numérico).
  Tests unitarios `part-search.ts` (9 tests) + `inventory-parts.ts` (6 tests) → suite 105/105 PASS.
- **Aislamiento Seguro de Google OAuth Web (2026-08-23):** creación de
  `src/lib/google-auth.web.ts` para evitar que `expo-auth-session` arroje error
  fatal en web cuando `EXPO_PUBLIC_GOOGLE_CLIENT_ID` no está configurado en dev
  local (en web el sign-in con Google utiliza la redirección directa de Supabase).
- **DeviceSecurityInput operativo en recepción (2026-08-22):** selector
  interactivo de seguridad del equipo (`src/components/ui/device-security-
  input.tsx`) con 3 modos por chips: 'Ninguna', 'PIN / Contraseña' (prefijo
  automático: dígitos → 'PIN: x'; mixto → 'Contraseña: x') y 'Patrón' —
  cuadrícula 3x3 táctil (tap nodo a nodo o ARRASTRE del trazo vía Responder
  API con captura; nodos de 44px accesibles, líneas trigonométricas sin SVG,
  botón Limpiar trazo) que genera 'Patrón: 1-2-5-8-9'. Se guarda en la
  columna EXISTENTE `repairs.unlock_code` (sin migración ni cambios de RLS).
  Lógica pura en `src/utils/device-security.ts` (+14 tests: contratos S1–S5,
  seeds legacy 'Pass:'/'Patrón:', geometría) → suite 77/77. El detalle de la
  orden (`job/[id].tsx`) muestra la clave legible (🔑) o una PatternPreview
  compacta del trazo. Componente NO CONTROLADO: se resetea remontándolo con
  `key` desde receive.tsx (evita setState en efectos). Invariante intacto:
  unlockCode NUNCA se persiste en AsyncStorage.
- **RepairWorkflowStepper operativo en el detalle de orden (2026-08-22):**
  diagrama interactivo `src/components/ui/repair-workflow-stepper.tsx` con los
  4 estados reales del modelo (`Pendiente → En Proceso → Listo → Entregado`)
  y rama especial `Cancelado / No Reparado` en acento error (flujo cerrado).
  Nodos circulares de 40px con iconos del dashboard (hourglass/construct/
  checkmark/checkmark-done), conectores que se colorean de success al superar
  etapa, paleta semántica de `tokens.colors.status`, scroll horizontal seguro
  (sin desbordes) y accesibilidad (role button, labels es-CO, activeOpacity
  0.7). Integrado bajo el folio TRM en `job/[id].tsx`; tocar una etapa
  POSTERIOR avanza la orden vía `updateRepairStatus` — solo dueño o técnico
  asignado (`canEdit`), estados terminales bloqueados. NOTA de diseño: la spec
  pedía 'recibido/diagnostico/esperando_repuesto'; se mapeó al modelo real
  para no romper el constraint SQL ni la lógica de comisiones.
- **Asignación y reasignación de técnico en órdenes operativa (2026-08-21):**
  - Al crear (`receive.tsx`): selector "Asignar a" con chips — el usuario actual
    primero (`(tú)`, default = comportamiento histórico) + el resto de miembros
    activos del taller desde `useAuth().users`; el id/nombre elegido viaja en
    `addRepair({ technicianId, technicianName })`. El elegido NO se persiste en
    el blob `receiptData` de AsyncStorage.
  - Al editar (`job/[id].tsx`): botón "👥 Reasignar técnico" (oculto si la
    orden está cancelada) + modal con chips (asignado actual marcado
    "(actual)", self "(tú)") → `updateRepair(id, { technicianId,
    technicianName })`. Visible para CUALQUIER miembro que pueda ver la orden:
    RLS `repairs_workshop_update` ya autoriza UPDATE a todo el taller, así un
    técnico que no puede continuar pasa la orden a otro. Sin migración SQL.
  - Privacidad intacta: `visibleRepairs`/`canViewRepair` siguen filtrando —
    el técnico solo ve SUS órdenes; al reasignar, la orden desaparece de su
    lista y aparece en la del nuevo técnico.
- **Búsqueda multicriterio en tiempo real operativa** en
  `src/app/(tabs)/jobs.tsx`: filtra por **Folio TRM**, **IMEI/Serial**,
  **Teléfono** y **Nombre del Cliente** (`normalizeSearch()` + chips de estado).
- **Compartir recibo en PDF por WhatsApp operativo en TODOS los dispositivos:**
  - Web (`src/utils/receipt-pdf.web.ts`): `jspdf` genera el PDF real y el
    **Web Share API** abre WhatsApp/otras apps (`navigator.share({files})`);
    en PC donde no hay share, **fallback de descarga** (`<a download>`).
  - Nativo (`src/utils/receipt-pdf.ts`): `expo-print` → `expo-sharing`.
  - Membrete del taller, **cálculo DIAN Módulo 11** (`src/utils/nit.ts`),
    botones de impresión web y de compartir por WhatsApp/PDF con feedback.
- **Panel de Liquidación y Rendimiento Mensual por Técnico operativo
  (histórico mes a mes):**
  - `repairs.delivered_at` (fecha real de entrega/cobro) estampada por el
    trigger `trg_repairs_delivered_at` al pasar a 'Entregado' (se limpia si
    sale del estado); backfill aplicado con `updated_at` para órdenes previas.
  - RPC `get_technician_monthly_performance(p_period 'YYYY-MM')`
    (SECURITY DEFINER, taller resuelto desde la sesión, sin sesión → vacío):
    agrupa las órdenes ENTREGADAS por MES DE ENTREGA real
    (`coalesce(delivered_at, updated_at, date)::date`) y devuelve por técnico:
    órdenes entregadas, total recaudado (`budget`), repuestos (`parts_cost`),
    producción neta (Σ `max(budget − parts_cost, 0)`), comisión a liquidar
    (Σ redondeo de producción neta × `commission_rate`, fracción 0–1) y
    ganancia neta del taller. Órdenes legacy sin `technician_id` se agrupan
    por nombre histórico con comisión 0. Aplicada en vivo a la BD real.
  - Tipado estricto en `src/types/billing.ts` (`TechnicianMonthlyPerformance`,
    `MonthlyBreakdownSummary`, `PeriodOption`; cero `any`).
  - Lógica pura testeable en `src/utils/billing-performance.ts` (+9 tests:
    periodos disponibles, etiquetas es-CO, resumen global).
  - `BillingProvider.fetchMonthlyPerformance(period)` en
    `src/context/billing-context.tsx`: llama a la RPC y normaliza numeric → number.
  - UI en `admin.tsx`: selector de periodo (Mes Actual "En Curso" + meses
    archivados de `monthly_closures` y entregas, solo lectura), tarjeta de
    resumen global (Facturado / Repuestos / Comisiones por Pagar / Utilidad
    Neta) y tarjetas por técnico con badge de %, métricas COP exactas y fila
    destacada "Por liquidar al técnico".
- **Cierres de mes operativos** (snapshot mensual para verificación futura +
  facturación inmediata del mes nuevo):
  - Tabla `public.monthly_closures` (workshop_id, period 'YYYY-MM', revenue,
    parts_cost, delivered_count, cancelled_count, total_count) con RLS de SOLO
    lectura por taller.
  - RPC `ensure_month_closure()` (SECURITY DEFINER, idempotente): cierra los
    meses vencidos sin cierre y devuelve el periodo abierto ('YYYY-MM').
    Aplicada en vivo a la BD real (verificada 2 ejecuciones).
  - `src/context/billing-context.tsx` (`BillingProvider`/`useBilling`) en
    `src/app/_layout.tsx`: al abrir la app con sesión, ejecuta el RPC
    (auto-cierre) y expone `currentPeriod` + `closures` históricos.
- **Seguridad RLS multi-tenant por `workshop_id`** completada: toda tabla filtra
  por taller; RPCs `security definer` sin sesión bloqueadas.
- **Sistema de invitaciones por token temporal (10 min)** y **gestión de
  técnicos (hasta `MAX_TECHNICIANS = 5`)** completados.
- **Monetización Bre-B activa** (Llave: `3002011801`, 20.000 COP/mes) con
  **acumulación matemática de tiempo** de suscripción (90 días de prueba,
  alerta visual a 10 días del vencimiento).
- **Fix de sesiones obsoletas aplicado y desplegado:** un JWT de un usuario
  eliminado ya no bloquea `fetchRepairs`; el cliente se auto-desloguea.
- **Facturación y Recibos Simplificados (2026-08-23):** La vista
  `src/app/receipt/[id].tsx` y la plantilla HTML para exportación térmica/PDF
  (`expo-print`) muestran exclusivamente el "Total reparación", eliminando las
  filas de desglose de costo de repuesto y abono de cara al cliente.
- **UI & Estabilidad E2E (2026-08-23):** Integradas correcciones de contención
  en `GlassCard` (`flexShrink: 1`), manejo de errores de login visible en UI
  (`loginError` state), y suite E2E de invitaciones para técnicos con usuario
  aislado y selectores robustos (`getByRole`, `getByText` con regex).
- **Despliegue en Producción (2026-08-23):** Release Candidate verificado y
  activo en Vercel (`mi-app-vibe-ten.vercel.app`) superando smoke tests en
  Chromium y WebKit (Safari) — 2/2 PASS.
- **Security & Hardening Sweep (2026-08-24):** Auditoría completa de 20 puntos aplicada:
  - Secrets & Git: `.gitignore` cubre `.env`, `.env.local`, `.env*.local`; `src/` sin `service_role` ni credenciales hardcodeadas; solo `EXPO_PUBLIC_SUPABASE_ANON_KEY` en bundle.
  - HTTP Security Headers en `vercel.json`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - Dependency audit: `npm audit fix` → 16 vulnerabilidades residuales (4 high, 12 moderate) en dependencias transitivas de Expo (`image-size`, `uuid`, `nanoid`); `npm audit fix --force` requiere breaking changes en Expo SDK 57 → diferido.
  - `npx tsc --noEmit`: 0 errores; `npm test`: 106/106 PASS.
  - Despliegue verificado: `mi-app-vibe-ten.vercel.app` con headers de seguridad activos.
- **Fix cancelRepair + Modal Submission (2026-08-24):** Botón "Confirmar" en modal "Marcar como No Realizado" (`job/[id].tsx`) operativo:
  - Validación motivo obligatorio + alerta si vacío
  - Estado `isSubmitting` (`cancellingOrder`) con "Cancelando..." + botón deshabilitado
  - `await cancelRepair(id, cleanMotivo)` con try/finally + manejo error
  - En éxito: cierra modal, limpia input, UI actualiza a 'Cancelado / No Reparado'
  - En fallo: alerta con error exacto
- **Blindaje cancelRepair y deleteRepair (`repair-context.tsx`):** Payload estricto a Supabase (`status`, `motivo_cancelacion`, `inventory_part_*`, `parts_cost`, `budget: 0`, `advance_payment: 0`). Reintegro automático de inventario al cancelar o eliminar una orden de la base de datos de manera atómica para evitar descuadre de inventario y fugas de ganancias.
- **Reglas de Cancelación (`repair-logic.ts`):** Nueva constante `CANCELLABLE_STATUSES = ['Pendiente', 'En Proceso']`; `canCancel` usa esta constante -> 'Listo', 'Entregado', 'Cancelado' = NO cancelables; `isValidCancellation` valida motivo con `trim().length > 0`; tests 106/106 PASS (`canCancel('Listo') = false`)
- **Migración faltante aplicada en vivo (2026-08-24):** Creada la migración `20260824220000_repairs_cancel_reason_status.sql` (agregando `motivo_cancelacion` y permitiendo el estado 'Cancelado / No Reparado' en el check constraint `repairs_status_check`). Aplicada directamente en producción usando la cadena de conexión de la base de datos vía script.

## Foco Operativo Inmediato (Sprint Actual)
**Importaci�n de inventario y puesta en marcha:** Carga masiva del inventario PIME (84 registros) en producci�n de Supabase para la cuenta jaiderpr@gmail.com completada. Pr�ximo: validaci�n funcional en el dashboard de inventario y resoluci�n de deuda t�cnica E2E.
## Decisiones Recientes
- **Liquidación en tiempo real (2026-08-21):** el panel se suscribe a
  `postgres_changes` sobre `public.repairs` (canal `admin-liquidacion-realtime`)
  con DEBOUNCE de 800 ms que incrementa `realtimeTick`, dependencia del efecto
  que llama a la RPC. Requiere `repairs` en la publicación `supabase_realtime`
  (migración idempotente; la visibilidad de eventos respeta RLS por taller).
  El setState ocurre en el callback de la suscripción, nunca síncrono en el
  cuerpo del efecto (regla react-hooks/set-state-in-effect).
- **RPC liquidación (fix 2026-08-21):** `count(*)` devuelve bigint y
  `RETURN QUERY` no downcastea → error 42804 solo con usuario REAL (con
  service_role `auth.uid()` es null y la función salía temprano: por eso el
  smoke test no lo detectó). Fix: `count(*)::int`. Para probar RPCs con
  sesión simulada vía CLI: `supabase db query --linked` + set_config de
  `request.jwt.claims` en un statement con CROSS JOIN LATERAL.
- **Lint react-hooks (2026-08-21):** el periodo por defecto del panel de
  liquidación es DERIVADO (`effectivePeriod = selectedPeriod ?? currentPeriod
  ?? periodOptions[0]?.period`), sin efecto de ajuste; el spinner de carga se
  deriva comparando `loadedPeriod` vs `effectivePeriod` (todos los setState de
  la RPC ocurren tras el await). `jobs.tsx`/`customers.tsx` memoizan ANTES del
  guard de autenticación (regla de hooks) devolviendo vacío sin usuario. El
  dashboard lee el reloj con `useSyncExternalStore` (snapshot SSR = valor
  enorme para no disparar la alerta de trial en HTML estático). Quedan 3
  warnings de variables sin usar (refreshBilling, supabase, notifyError).
- **Liquidación mensual:** la comisión se liquida sobre la PRODUCCIÓN NETA
  (`max(budget − parts_cost, 0)`) con `commission_rate` como FRACCIÓN 0–1
  (0.30 = 30%), idéntico a `commissionForRepair()`; el agrupado mensual usa la
  FECHA DE ENTREGA REAL (`delivered_at`, trigger) y no la fecha de creación.
- Los meses archivados NO guardan snapshot por técnico: el histórico por
  técnico se recalcula desde `repairs` (inmutables en la práctica); el badge
  de % muestra la comisión VIGENTE del perfil también en meses pasados.
- `ensure_workshop()` devuelve `null` (sin violar FK) cuando el usuario ya no
  existe en `auth.users`; `resolveWorkshopId()` cierra la sesión obsoleta.
- `expo-print` en web solo llama a `window.print()` (no genera PDF); por eso el
  PDF web se construye con `jspdf` y se comparte con Web Share API.
- `metro.config.js` redirige `jspdf` a `dist/jspdf.es.min.js` (build ESM) en
  todas las plataformas: el SSR estático de Expo corre en Node y resolvería la
  build `node` que usa `require(["html2canvas"], t)` (AMD no transformable por
  Metro, rompía `expo export -p web`). jspdf solo se importa desde
  `src/utils/receipt-pdf.web.ts`, así que el redirect es inocuo en nativo.
- `monthly_closures` es SOLO lectura por RLS: la escritura ocurre vía RPC
  `ensure_month_closure()` (SECURITY DEFINER), nunca desde el cliente.
- El glass se aplica con moderación; en plataformas nativas se degrada a sólido.
- Las anon keys son públicas por diseño (RLS es la barrera real).
- **Deuda Técnica Diferida — Vulnerabilidades Transitivas Expo SDK 57 (2026-08-24):** `npm audit` reporta 16 vulnerabilidades residuales (4 high: `image-size` DoS, `nanoid` loop; 12 moderate: `uuid` bounds, `image-size` transitive) en dependencias de Expo (`metro`, `@expo/metro`, `@expo/config-plugins`, `expo-sharing`, `expo-splash-screen`). `npm audit fix --force` requiere downgrade a Expo 46 → breaking changes en SDK 57. Diferida para próxima actualización mayor de Expo (SDK 58+). Mitigación actual: headers `Permissions-Policy` restringen superficie de ataque; RLS aísla datos; no hay vectores de explotación conocidos en código propio.

## Próximo Paso Esperado
- El panel de liquidación ya funciona en producción (fix 42804 aplicado en
  vivo el 2026-08-21): verificar en vivo alternando mes archivado vs en curso.
- La migración `20260821000000_technician_monthly_performance.sql` y el fix
  `20260821210000_fix_monthly_performance_count_type.sql` están aplicados en
  vivo; schema.sql espejado con delivered_at, trigger, RPC (count(*)::int).

## Deuda Técnica No Bloqueante (E2E)
- **Registrado:** `.omo/plans/e2e-debt-login-feedback.md`
- **Objetivo:** Reparación de deuda de tests E2E y feedback de login (pending implementation)
- **Hallazgos clave:** 
  - `invitation.spec.ts:19` — `BASE_URL` default `localhost:8081` (no apunta a producción)
  - `core-flows.spec.ts` — locator `text=Iniciar sesión` resuelve a div con `pointer-events:none`; credenciales hardcodeadas sin seed en prod Supabase
  - `login.tsx` — feedback silencioso al fallar credenciales
  - `web-smoke` PASS en chromium+webkit: la pantalla no tiene pantallas blancas (build renderiza correctamente)
- **Estado:** deuda documentada, pendiente de implementación en sprint subsiguiente; no bloquea release candidate actual.