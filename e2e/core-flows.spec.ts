/**
 * e2e/core-flows.spec.ts — Capa 3: E2E de los flujos críticos.
 *
 * Escenario (usuario de prueba aislado, creado y borrado en este spec):
 *   1. Inicio de sesión real (correo + contraseña) contra la app desplegada.
 *   2. Recepción: crear una orden con número TRM-XXXX.
 *   3. Trabajos: cambiar el estado de la orden (Pendiente → En Proceso →
 *      Listo → Entregado).
 *   4. Cobro: registrar el pago de la reparación.
 *   5. Panel de administración: navegar y verificar que carga.
 *
 * El usuario se crea vía Admin API (service role, email_confirm=true) con un
 * taller 100% propio; al terminar se borra (cascade elimina perfiles y datos).
 *
 * Nota de selectores (React Native Web): los Pressables se renderizan como
 * <div tabindex="0"> cuyo texto hijo tiene pointer-events:none, por eso los
 * clics van al CONTENEDOR presionable vía pressButton() (etiqueta exacta),
 * scoped a la tarjeta del cliente cuando aplica (evita chocar con los chips
 * de filtro de estado). Los alerts síncronos se capturan con waitForDialog().
 *
 * Requisitos: SUPABASE_SERVICE_ROLE_KEY en env (o .env.local), BASE_URL
 * opcional (default: Vercel). Ejecutar: npx playwright test e2e/core-flows.spec.ts
 */

import { expect, test, type Dialog, type Locator, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://mi-app-vibe-ten.vercel.app';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const RUN = Date.now();
const EMAIL = `qa-e2e-${RUN}@mailinator.com`;
const PASSWORD = 'Qa-E2e-12345!';
const CLIENT_NAME = `QA E2E Cliente ${RUN % 100000}`;
const DEVICE = 'iPhone 13 QA';
const BUDGET = '150000';

let userId = '';

/** Crea el usuario de prueba vía Admin API (sin enviar email). */
async function createTestUser(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'admin', workshop_name: `QA E2E ${RUN}`, full_name: 'QA E2E' },
    }),
  });
  const body = (await res.json()) as { id?: string; error?: string; msg?: string };
  if (!res.ok || !body.id) {
    throw new Error(`No se pudo crear el usuario E2E (${res.status}): ${body.error ?? body.msg ?? '?'}`);
  }
  return body.id;
}

/** Borra el usuario de prueba (cascade borra perfil + taller + datos). */
async function deleteTestUser(id: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

/**
 * Helper: clic en un "botón" de React Native Web. Los Pressable se renderizan
 * como <div tabindex="0"> que cubre su texto hijo (el hijo interno tiene
 * pointer-events:none y el hit-target check falla si se apunta al texto), así
 * que localizamos el Pressable CONTENEDOR por su etiqueta exacta.
 * Acepta Page o Locator (para scoping a la tarjeta del cliente).
 */
function pressButton(root: Page | Locator, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return root
    .locator('div[tabindex="0"]')
    .filter({ hasText: new RegExp(`^${escaped}$`, 'i') })
    .last();
}

/**
 * Helper: espera un window.alert cuyo mensaje coincida y lo acepta.
 * Los notify() de la app son SÍNCRONOS en web (window.alert bloquea el hilo
 * durante el dispatch del clic), así que un patrón waitForEvent+accept-after
 * haría deadlock: aquí cada diálogo se acepta de inmediato en el handler.
 */
function waitForDialog(page: Page, pattern: RegExp, timeout = 15_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off('dialog', onDialog);
      reject(new Error(`No apareció ningún dialog que coincida con ${pattern}`));
    }, timeout);
    const onDialog = (dialog: Dialog) => {
      const message = dialog.message();
      void dialog.accept();
      if (pattern.test(message)) {
        clearTimeout(timer);
        page.off('dialog', onDialog);
        resolve(message);
      }
    };
    page.on('dialog', onDialog);
  });
}

/** Tarjeta de trabajo de ESTE cliente (contiene su nombre y "Cambiar estado"). */
function jobCard(page: Page) {
  return page
    .locator('div')
    .filter({ hasText: CLIENT_NAME })
    .filter({ hasText: 'Cambiar estado' })
    .last();
}

test.beforeAll(async () => {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    throw new Error('Faltan SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_SUPABASE_URL para el E2E.');
  }
  userId = await createTestUser();
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test.describe('Flujos críticos (usuario aislado)', () => {
  test('Login → Recepción TRM-XXXX → Estado → Cobro → Admin', async ({ page }) => {
    // ── 1. LOGIN ──────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[placeholder*="correo"]', { timeout: 20_000 });
    await page.locator('input[placeholder*="correo"]').fill(EMAIL);
    await page.locator('input[placeholder*="contraseña"], input[type="password"]').fill(PASSWORD);
    await pressButton(page, 'Iniciar sesión').click();
    // Tras el login la app reemplaza a "/" (dashboard).
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });

    // ── 2. RECEPCIÓN: crear la orden ─────────────────────────────────────
    await page.goto(`${BASE_URL}/receive`);
    await page.waitForSelector('input[placeholder*="Juan Pérez"]', { timeout: 20_000 });
    await page.locator('input[placeholder*="Juan Pérez"]').fill(CLIENT_NAME);
    await page.locator('input[placeholder*="300 1234567"]').fill('+57 300 1234567');
    await page.locator('input[placeholder*="iPhone 13"]').fill(DEVICE);
    await pressButton(page, 'Cambio de pantalla').click();
    await page.locator('input[placeholder="Ej. 80000"]').fill('50000');
    await page.locator('input[placeholder="Ej. 480000"]').fill(BUDGET);

    // El alert "¡Equipo recibido…!" confirma el INSERT en Supabase.
    // (alert SÍNCRONO: el handler persistente de waitForDialog lo acepta
    // durante el dispatch del clic; waitForEvent+accept-after haría deadlock)
    const dialog1Promise = waitForDialog(page, /Equipo recibido/);
    await pressButton(page, 'Registrar Recepción y Asignar').click();
    expect(await dialog1Promise).toContain('Equipo recibido');
    await page.waitForURL('**/jobs', { timeout: 20_000 });

    // ── 3. TRABAJOS: verificar la orden y capturar TRM-XXXX ──────────────
    const card = jobCard(page);
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Número de orden TRM-XXXX desde el recibo (URL /receipt/TRM-…).
    await pressButton(jobCard(page), 'Ver Recibo').click();
    await page.waitForURL('**/receipt/TRM-**', { timeout: 20_000 });
    const orderId = page.url().match(/\/receipt\/(TRM-[A-Z0-9]{4})/)?.[1];
    expect(orderId).toBeTruthy();
    await page.goBack();
    await page.waitForURL('**/jobs', { timeout: 20_000 });

    // ── 4. ESTADO: Pendiente → En Proceso → Listo → Entregado ────────────
    // Los botones de estado son Pressables: clic al CONTENEDOR, scoped a la
    // tarjeta de ESTE cliente (el texto interno tiene pointer-events:none).
    const statusBtn = (label: string) => pressButton(jobCard(page), label);

    await statusBtn('En Proceso').click();
    await expect(jobCard(page).getByText('En Proceso', { exact: true })).toBeVisible({ timeout: 20_000 });

    await statusBtn('Listo').click();
    await statusBtn('Entregado').click();
    await expect(jobCard(page).getByText('Entregado', { exact: true })).toBeVisible({ timeout: 20_000 });

    // ── 5. COBRO: registrar el pago del saldo ─────────────────────────────
    await pressButton(jobCard(page), 'Registrar Pago').click();
    // (alert síncrono → handler persistente; scope page: el modal de pago
    // puede renderizar en portal fuera de la tarjeta)
    const payDialogPromise = waitForDialog(page, /Pago registrado/);
    await pressButton(page, 'Cobrar').click();
    expect(await payDialogPromise).toContain('Pago registrado');

    // Saldo cubierto → el footer muestra "Pago completo" (status Entregado).
    await expect(jobCard(page).getByText('Pago completo', { exact: true })).toBeVisible({ timeout: 20_000 });

    // ── 6. ADMIN: navegar al panel y verificar que carga ─────────────────
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForSelector('text=Administración & Seguridad', { timeout: 20_000 });
    await expect(page.getByText('Administración & Seguridad', { exact: true })).toBeVisible();
  });
});