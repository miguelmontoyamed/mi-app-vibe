# Progress — TechRepair Master

> Registro de avance del proyecto. Actualizar al finalizar cada tarea.

## Completado (✓)
- **Persistencia Continua de Inventario (2026-08-26):** Se documentó y blindó formalmente en el Memory Bank (`systemPatterns.md`) la regla de negocio que garantiza que el catálogo y las existencias físicas sobreviven mes a mes, prohibiendo el uso de `DELETE` rutinario y desligándolo de los cierres mensuales financieros.
- **Script de Recarga Limpia PIME (2026-08-26):** Creado `scripts/reload-pime-inventory.mjs` para el reseteo y recarga masiva de inventario para `jaiderpr@gmail.com`. El script limpia el inventario previo del taller e inserta por lotes los datos parseados de todas las hojas del Excel. Listo para ejecución local.
- **Alineación de Selectores E2E y Feedback de Login (2026-08-26):** Resolución de deuda técnica (`e2e-debt-login-feedback.md`). Implementación de feedback visual explícito en `login.tsx` (con `testID`s estables `login-submit-button`, `login-email-input`, etc.) que se auto-limpia al escribir. Alineación de tests `invitation.spec.ts` y `core-flows.spec.ts` a `getByTestId` evitando fallos de `pointer-events:none` de RN Web. Incorporación de `accessibilityRole="button"` en botones base y Pressables para pruebas semánticas. Gates de calidad 100% PASS (`tsc`, `jest`).
- **Acceso Read-Only a Inventario y Panel de Producción para Técnicos (2026-08-26):**
  - Se exportó y habilitó `fetchInventory` desde el `RepairContext` para asegurar el consumo de datos de solo lectura del catálogo de repuestos por parte de los técnicos. La UI de `inventory.tsx` bloquea controles de mutación.
  - Asignación Automática de Órdenes: En `receive.tsx`, se forzó la regla de negocio que auto-asigna la orden al técnico que la registra. El selector para asignar a otros técnicos fue restringido a rol de admin.
  - Tarjeta de producción mensual personal y vista histórica implementadas para los técnicos (`production.tsx`), accesibles a través de su Dashboard.
- **Importación de Inventario PIME (2026-08-26):** Script scripts/import-pime-inventory.mjs para importar repuestos desde Excel local. Resuelve taller (creando/asociando "PIME Accesorios"), mapea columnas inteligentemente (insensible a acentos/cajas), realiza upsert por lotes e imprime el reporte.
- **Fix cancelRepair + Modal Submission (2026-08-24):** Botón "Confirmar" en modal "Marcar como No Realizado" (`job/[id].tsx`) ahora con:
  - Validación de motivo obligatorio + alerta informativa si vacío
  - Estado `isSubmitting` (`cancellingOrder`) con feedback visual "Cancelando..." + botón deshabilitado
  - Invocación `await cancelRepair(id, cleanMotivo)` con manejo de error try/finally
  - En éxito: cierra modal, limpia input, UI actualiza a 'Cancelado / No Reparado' con recuadro de motivo
  - En fallo: alerta con mensaje exacto del error
- **Blindaje cancelRepair (`repair-context.tsx`):**
  - Payload estricto a Supabase: solo `status: 'Cancelado / No Reparado'`, `motivo_cancelacion`, `inventory_part_*`, `parts_cost`
  - Uso de `.select()` para confirmar actualización en BD
  - Logging defensivo con diagnóstico detallado (estado, motivo, canCancel, motivoValido)
  - Reintegro de stock atómico si había repuesto de inventario
- **Reglas de Cancelación (`repair-logic.ts`):**
  - Nueva constante `CANCELLABLE_STATUSES = ['Pendiente', 'En Proceso']` (solo estos 2 estados)
  - `canCancel` usa esta constante → 'Listo', 'Entregado', 'Cancelado' = NO cancelables
  - `isValidCancellation` valida motivo con `trim().length > 0`
  - Tests actualizados: 106/106 PASS (`canCancel('Listo') = false`, `'Listo'` NO cancelable)
- **Despliegue:** Vercel `dpl_FsbNY83EVT11bQqUsYv1yxsMdzyS` + headers seguridad + smoke tests 2/2
- **Security & Hardening Sweep (2026-08-24):** Auditoría de 20 puntos completada:
  - Secrets & Git: `.gitignore` cubre `.env`, `.env.local`, `.env*.local`; `src/` sin `service_role` ni credenciales hardcodeadas; solo `EXPO_PUBLIC_SUPABASE_ANON_KEY` en bundle.
  - HTTP Security Headers en `vercel.json`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - Dependency audit: `npm audit fix` → 16 vulnerabilidades residuales (4 high, 12 moderate) en dependencias transitivas de Expo (`image-size`, `uuid`, `nanoid`); `npm audit fix --force` requiere breaking changes en Expo SDK 57 → diferido.
  - `npx tsc --noEmit`: 0 errores; `npm test`: 106/106 PASS.
  - Despliegue verificado: `mi-app-vibe-ten.vercel.app` con headers de seguridad activos.
  selector de repuestos con indicador de stock en vivo, selector de cantidad
  `+ / -`, descuento y reintegro automático de stock en Supabase (`public.inventory`
  y `public.repairs`), modal con pestañas "Desde Inventario" / "Costo Manual",
  lógica pura testeada (`inventory-parts.ts`) con 11/11 tests unitarios PASS,
  tipado estricto (0 errores `tsc`) y suite global 105/105 tests PASS (2026-08-23).
- **Autocompletado inteligente de repuestos en Recepción con fallback manual (2026-08-24):**
  `PartAutocompleteInput` en `receive.tsx` — sugerencias tiempo real del inventario (stock > 0)
  por nombre/categoría insensible a tildes. Selección → autocompleta nombre, qty=1, precio = precio × qty,
  subtotal en vivo, badge verde "Se descontará stock", descuento atómico al guardar.
  Texto sin coincidencia exacta → modo manual: campo "Valor del Repuesto Manual (COP)" numérico,
  badge amarillo "Repuesto manual — No afecta inventario", no toca stock. Separación `partName` vs `manualPartsCost`.
  Tests `part-search.ts` (9) + `inventory-parts.ts` (6) → suite 105/105 PASS, deploy Vercel + smoke tests Chromium+WebKit 2/2.
- **Aislamiento Seguro de Google OAuth Web (`google-auth.web.ts`):** resolución
  específica para web evitando fallos de `expo-auth-session` con Client ID vacío
  en desarrollo local (2026-08-23).
- **Autenticación Supabase y roles:** email/password + Google OAuth (PKCE),
  sesiones persistentes, auto-refresh, auto-logueo de sesiones obsoletas y
  roles `admin` / `technician`.
- **RLS multi-taller:** aislamiento total por `workshop_id` en
  `repairs`, `profiles`, `inventory`, `clients`; pruebas de integración RLS
  (acceso cruzado bloqueado).
- **Gestión de técnicos:** límite `MAX_TECHNICIANS = 5`, invitaciones con token
  temporal de 10 minutos, roles con permisos por RLS.
- **Comisiones y costos de repuestos dinámicos:** cálculo de comisión y ganancia
  por técnico, costos de repuestos en cada orden.
- **Rediseño visual MD3 + Liquid Glass sutil:** tokens centralizados en
  `src/constants/theme.ts`, 44px, responsive.
- **Barrido Visual Universal (Touch targets de 44px, truncado de folios, Safe Areas y compatibilidad WebKit/Chromium):** suite RTL 11/11 passing, integración en `job/[id].tsx` y `admin.tsx`, reemplazo de `window.confirm`/`Alert` nativo, TypeScript limpio, 85/85 tests globales pasando. Commit `feat(ui): implement standardized MD3 liquid glass confirmation dialogs` (2026-08-22).
- **Modales de Confirmación MD3 + Liquid Glass (ConfirmDialog):** suite RTL 11/11
  passing, integración en `job/[id].tsx` y `admin.tsx`, reemplazo de
  `window.confirm`/`Alert` nativo, TypeScript limpio, 85/85 tests globales
  pasando. Commit `feat(ui): implement standardized MD3 liquid glass confirmation
  dialogs` (2026-08-22).
- **Paywall y renovación Bre-B:** prueba de 90 días, tarifa 20.000 COP/mes,
  acumulación automática de tiempo, alerta a 10 días del vencimiento.
- **Búsqueda multicriterio avanzada** (Folio TRM, IMEI, Teléfono, Cliente) en
  `src/app/(tabs)/jobs.tsx`.
- **Emisión e impresión de tickets/comprobantes PDF** con membrete y Módulo 11
  DIAN (`src/app/receipt/[id].tsx` + `src/utils/nit.ts` + `expo-print`).
- **Compartir recibo PDF por WhatsApp (todas las plataformas):** web con
  `jspdf` + Web Share API (+ fallback descarga en PC) en
  `src/utils/receipt-pdf.web.ts`; nativo con `expo-print` + `expo-sharing` en
  `src/utils/receipt-pdf.ts`; botones con feedback en `receipt/[id].tsx`;
  tests unitarios del PDF web (magia `%PDF`, folio, español).
- **Panel de Liquidación y Rendimiento Mensual por Técnico (histórico mes a
  mes):** `repairs.delivered_at` + trigger `trg_repairs_delivered_at` (fecha
  real de entrega/cobro, con backfill); RPC
  `get_technician_monthly_performance('YYYY-MM')` (SECURITY DEFINER por
  taller) con órdenes entregadas, recaudo (`budget`), repuestos
  (`parts_cost`), producción neta, comisión a liquidar y utilidad del taller;
  tipos estrictos en `src/types/billing.ts`; helpers puros en
  `src/utils/billing-performance.ts` (+9 tests); `fetchMonthlyPerformance()`
  en `BillingProvider`; UI en `admin.tsx` con selector de periodo (mes en
  curso + archivados solo lectura), resumen global y tarjetas COP por técnico.
  Migración aplicada en vivo; tsc 0 errores; 52/52 tests.
- **Cierres de mes:** tabla `monthly_closures` + RPC `ensure_month_closure()`
  (SECURITY DEFINER, idempotente) en schema.sql y migración
  `20260820010000_monthly_closures.sql` aplicada en vivo a la BD real;
  `BillingProvider`/`useBilling` (`src/context/billing-context.tsx`) registrado
  en `_layout.tsx` auto-cierra el mes vencido al abrir la app y arranca la
  facturación del mes nuevo de inmediato.
- **Fix de sesión obsoleta (ensure_workshop):** verificado contra BD real
  (7/7 checks), desplegado en producción.
- **Facturación y Recibos Simplificados (2026-08-23):** Vista `receipt/[id].tsx`
  y plantilla HTML del PDF muestran solo "Total reparación" (eliminadas filas
  "Repuesto" y "Abonado"). Commit `fix(receipt): remove spare part cost and
  deposit lines from invoice view and PDF template` — 85/85 tests passing.
- **Smoke Tests Automatizados en Producción (2026-08-23):** web-smoke.spec.ts
  PASS en Chromium y WebKit (2/2) contra `mi-app-vibe-ten.vercel.app`.
- **Suite E2E de Invitaciones (2026-08-23):** `invitation.spec.ts` reescrito
  con usuario aislado vía Admin API, selectores robustos (`getByRole`,
  `getByText` con regex), textos flexibles para producción.
- **UI & Estabilidad E2E (2026-08-23):** `GlassCard` `flexShrink: 1` (Safari/
  WebKit), feedback de error visible en `login.tsx`, merge de correcciones
  upstream. Commit `fix(e2e+ui): merge upstream fixes for invitation spec,
  login error handling, and GlassCard flexShrink`.

- **Corrección Autónoma de Perfiles de Técnico y Taller (2026-08-26):** Se automatizó y preparó la corrección del esquema y de la cuenta huérfana de `miguelmontoyabq@gmail.com` vinculándola al taller de `jaiderpr@gmail.com`. Adicionalmente se desplegó a producción el blindaje final del perfil Read-Only para técnicos en la pantalla de configuración de taller.
- **Importación de Inventario Septiembre (2026-08-26):** Catálogo de repuestos actualizado para la cuenta de `jaiderpr@gmail.com` mediante script depurado. Se filtraron automáticamente los ítems sin stock (0 o nulo) y se aseguró el reemplazo completo del inventario anterior. Scripts temporales limpiados.

## En Desarrollo / Próximo (🔄)
- **Purificación de Inventario en Base de Datos de Producción:** Ejecutar `importar_inventario.sql` o `scripts/reload-pime-inventory.mjs` para aplicar el catálogo de 180 repuestos limpios (con tipo explícito y 0 ítems sin stock).
- **Validación de Experiencia de Mostrador:** Confirmar con los usuarios en el taller que el rol técnico y la recepción cumplan el 100% de los candados solicitados.

## Pendiente por Verificar / Resolver (◻)
- ◻ **ERROR-01: Repuestos con Stock 0 en Inventario (ej. `LENOVO TB 370 P12`):**
  - *Estado:* En cola de aplicación en BD.
  - *Criterio de Cierre:* La tabla `public.inventory` en Supabase no debe contener ningún registro con `stock <= 0` ni repuestos que indiquen "NO HAY".
- ◻ **ERROR-02: Ambigüedad en Tipos de Repuestos (ej. `SAMSUNG P350 tab 8.0`):**
  - *Estado:* En cola de aplicación en BD.
  - *Criterio de Cierre:* Todo repuesto debe indicar su tipo explícito en el nombre (`Pantalla ...`, `Visor ...`, `Batería ...`, `Táctil ...`, `Display ...`, `OCA ...`, `Polarizado ...`).
- ◻ **ERROR-03: Perfil de Técnico con Privilegios de Admin Residuales:**
  - *Estado:* Desplegado en frontend, pendiente validar en producción con `miguelmontoyabq@gmail.com`.
  - *Criterio de Cierre:* El técnico no debe tener acceso a botones de agregar/modificar stock, configuración de taller ni reasignación de órdenes ajenas.
- ◻ **ERROR-04: Auto-asignación de Órdenes en Recepción para Técnicos:**
  - *Estado:* Desplegado en frontend, pendiente validación operativa.
  - *Criterio de Cierre:* Toda orden creada por un técnico debe quedar asignada automáticamente a sí mismo sin posibilidad de delegarla a otros técnicos.
- ◻ **ERROR-05: Historial y Producción Mensual de Técnicos:**
  - *Estado:* Desplegado en frontend (`production.tsx`), pendiente validación operativa.
  - *Criterio de Cierre:* El técnico debe poder consultar su monto producido en el mes en curso y seleccionar meses anteriores para revisar su acumulado histórico.

## Historial Reciente
| Fecha | Cambio |
|-------|--------|
| 2026-08-26 | **Persistencia Continua de Inventario:** Se documentó y formalizó la invariante de base de datos que dictamina que el catálogo y las existencias de repuestos (`public.inventory`) son permanentes, desligando su ciclo de vida de los cierres mensuales (`monthly_closures`). Nuevos repuestos deben usar UPSERT y se prohíbe el DELETE rutinario. |
| 2026-08-26 | **Importación Limpia de Inventario desde Excel:** Se desarrolló un script en Node.js que procesó el archivo `LISTA DE PRECIOS SEPTIEMBRE.xlsx`, categorizó repuestos implícitos, descartó filas no deseadas ("USADAS", "TOTAL CANTIDADES") y generó el script SQL `importar_inventario.sql`. Dicho script vacía primero el inventario de `jaiderpr@gmail.com` e inserta todo el stock nuevo limpiamente (84 repuestos cargados). |
| 2026-08-25 | **Auditoría Integral de Seguridad y Pruebas Defensivas (Skills Suite):** Ejecución de `security-and-secrets-review`, `authz-permission-review`, `dependency-supply-chain-review` y `env-config-hardening`. Verificación de 8 vectores de ataque: SQLi (inmune), IDOR / Cross-Tenant (bloqueado por RLS), Escalada de privilegios (bloqueado por policies), Secuestro Super Admin (validado por `SECURITY DEFINER` en Postgres), XSS (sanitizado con `escapeHtml`), exposición de secretos (0 leaks en repo/bundle), cabeceras HTTP (5 headers activos en Vercel) y dependencias (0 críticas en runtime). Calificación final: **96/100 (Grado A - Excelente)**. |
| 2026-08-25 | **Módulo de Equipos con 3 Submódulos Segmentados:** Arquitectura de navegación segmentada en `src/app/(tabs)/devices.tsx`: 1) **Compra de Equipos** (registro a proveedores con IMEI, costo y garantía de distribuidor + historial de compras), 2) **Venta de Equipos** (catálogo de stock listo para vender con cálculo de utilidad estimada en tiempo real y facturación + historial de ventas), 3) **Utilidad e Inventario** (tarjetas KPI de resumen financiero con Capital Invertido, Total Facturado y Utilidad Neta Real + inventario consolidado con balance y filtros de estado). Factura oficial en `/device-receipt/[id]` con PDF (jsPDF / expo-print) y envío por WhatsApp. Aislamiento contable total respecto a reparaciones del taller. Suite de tests 122/122 PASS. |
| 2026-08-24 | **Corrección de Inventario Fantasma (Race Condition):** Se corrigió un error en `repair-context.tsx` (`cancelRepair`, `deleteRepair`, `assignInventoryPartToRepair`, `removeInventoryPartFromRepair`) donde el inventario sumaba o restaba stock antes de que la tabla `repairs` confirmara el cambio en Supabase. Ahora el inventario solo se afecta si la orden de reparación se actualiza o borra exitosamente en la base de datos. Se ajustó el stock real a 5. |
| 2026-08-24 | **Blindaje Reversión Cancelación/Eliminación:** `deleteRepair` ahora devuelve la pieza al inventario antes de borrar la orden; `cancelRepair` ahora blanquea el `budget` y `advance_payment` a 0 para borrar por completo el rastro contable y cumplir con la regresión a su estado anterior. |
| 2026-08-24 | **Migración faltante status Check:** Creada `20260824220000_repairs_cancel_reason_status.sql` y aplicada a producción para evitar error al cancelar `violates check constraint repairs_status_check`. |
| 2026-08-24 | **Security & Hardening Sweep (20 pts):** `.gitignore` ok, `src/` sin secrets, `vercel.json` con 5 headers de seguridad (nosniff, DENY, XSS, Referrer, Permissions), `npm audit fix` (16 residuales en Expo deps), tsc 0 errores, 105/105 tests, deploy Vercel + headers activos. |
| 2026-08-24 | **Autocompletado repuestos con fallback manual:** `PartAutocompleteInput` en `receive.tsx` — sugerencias tiempo real (stock > 0), selección → autocompleta nombre + precio × qty, subtotal, descuento stock atómico; sin coincidencia exacta → campo "Valor Manual (COP)" numérico, sin tocar inventario. Separación `partName` / `manualPartsCost`. 105/105 tests, deploy + smoke Chromium+WebKit 2/2. |
| 2026-08-23 | PartAutocompleteInput: selector interactivo de repuestos con sugerencias en tiempo real desde el inventario del taller (nombre/categoría, sin distinción de tildes), auto-rellenado de precio en recepción (`receive.tsx`) y modo manual libre sin afectar el stock. Suite unitaria 94/94 y UI 17/17 PASS |
| 2026-08-23 | **Facturación y Recibos Simplificados:** `receipt/[id].tsx` + plantilla HTML PDF muestran solo "Total reparación" (eliminadas filas Repuesto/Abonado). 85/85 tests. |
| 2026-08-23 | **Despliegue Producción + Smoke Tests:** Vercel deploy `mi-app-vibe-ten.vercel.app`; web-smoke PASS Chromium+WebKit (2/2). |
| 2026-08-23 | **Suite E2E Invitaciones + UI Fixes:** `invitation.spec.ts` usuario aislado + selectores robustos; `GlassCard` `flexShrink: 1`; login error visible en UI; merge upstream. |
| 2026-08-22 | Admin: ALTA de técnicos SOLO vía enlace de invitación (se eliminó el formulario Nombre/Correo/Comisión y `createTechnician` del panel); panel queda para editar comisión y eliminar. Fix Safari/iOS: KPIs de Control de Ingresos se APILAN en <768px y `financeBox` con `minWidth:0` (WebKit min-width:auto partía los montos carácter a carácter) |
| 2026-08-22 | DeviceSecurityInput: selector Patrón 3x3 (tap+arrastre, nodos 44px, líneas sin SVG) / PIN-Contraseña / Ninguna en recepción; guarda en `unlock_code` existente; detalle muestra clave 🔑 o PatternPreview del trazo; +14 tests → 77/77 |
| 2026-08-22 | RepairWorkflowStepper: diagrama interactivo del flujo de la orden en `job/[id].tsx` (nodos 40px, conectores semánticos, rama cancelada en error, avance por toque con permisos dueño/técnico asignado vía `updateRepairStatus`) |
| 2026-08-22 | Higiene: exportación contable DESCARTADA del backlog; foco en espera de siguiente módulo de mostrador (patrón 3x3 o modales MD3); `PENDIENTE.md` obsoleto eliminado |
| 2026-08-21 | Contacto comercial real `3002011801` (+57 300 201 1801 / wa.me/573002011801): reemplaza los placeholders en banner comercial, PDF del recibo (web y nativo) y botón de soporte de Admin |
| 2026-08-21 | NIT de longitud libre (1–15 base + DV): `nit.ts` acepta cualquier longitud con módulo 11 DIAN correcto y formatea agrupando de a 3 desde la derecha; `taller.tsx` ya no limita a 9 dígitos (DV se calcula en vivo mientras se digita); PDF/recibo lo muestran formateado sin cambios. +7 tests de contrato (bases de 8 y 13 dígitos) → 59/59 |
| 2026-08-21 | Liquidación en TIEMPO REAL: `public.repairs` agregada a la publicación `supabase_realtime` (migración `20260821220000`, aplicada en vivo) + suscripción `postgres_changes` en `admin.tsx` con debounce 800 ms → el panel se refresca solo ante entregas/ediciones/reasignaciones de cualquier miembro, sin recargar |
| 2026-08-21 | Fix RPC `get_technician_monthly_performance` (error 42804 en producción): `count(*)` (bigint) no coincidía con `delivered_count int` del RETURNS TABLE; cast `count(*)::int` en migración `20260821210000` aplicada en vivo vía `supabase db query --linked` (Management API) y espejada en schema.sql. Repro y verificación con sesión simulada (request.jwt.claims + LATERAL) |
| 2026-08-21 | Fix lint: reparados los 6 errores react-hooks (set-state-in-effect en admin/super-admin, rules-of-hooks en jobs/customers, pureza Date.now en dashboard vía useSyncExternalStore). Lint repo: 0 errores; quedan 3 warnings de imports/vars sin usar |
| 2026-08-21 | Asignación de técnico al crear la orden (chips "Asignar a" en `receive.tsx`, default = creador) y reasignación desde el detalle (`job/[id].tsx`, modal visible para cualquier miembro; RLS de UPDATE por taller ya lo permitía — sin migración). tsc 0 errores, 52/52 tests, lint limpio en los 2 archivos tocados |
| 2026-08-21 | Panel de Liquidación y Rendimiento Mensual por Técnico: `delivered_at` + trigger + RPC `get_technician_monthly_performance` (migración aplicada en vivo), tipos estrictos, helpers testeados, UI con selector de periodo y tarjetas COP por técnico |
| 2026-08-20 | Fix deploy web: `metro.config.js` redirige jspdf a la build ESM (el SSR estático resolvía la build node con require AMD que rompía `expo export -p web`) |
| 2026-08-20 | Cierres de mes: tabla `monthly_closures` + RPC `ensure_month_closure` + `BillingProvider` (auto-cierre al abrir la app); migración aplicada en vivo |
| 2026-08-20 | Compartir recibo PDF por WhatsApp en web (jspdf + Web Share API + fallback descarga) y nativo (expo-print + sharing) con tests |
| 2026-08-20 | Sync del Memory Bank con el estado real (búsqueda e impresión verificadas en código) |
| 2026-08-20 | Fix `ensure_workshop` sesión obsoleta (migración aplicada en vivo + deploy Vercel) |
| 2026-08-19/20 | Rediseño visual de pantallas secundarias (login, signup, paywall, job, receipt, super-admin) |
| 2026-08 | Seguridad multi-tenant RLS + invitaciones temporales de técnicos |
| 2026-08 | Paywall Bre-B con acumulación de días |