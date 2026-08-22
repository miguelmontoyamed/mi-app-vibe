/**
 * E2E: Flujo de invitación de técnico (Playwright).
 *
 * Escenario completo:
 *   1. Admin (usuario aislado creado vía Admin API) inicia sesión, navega a
 *      Admin y genera un enlace de invitación.
 *   2. El enlace se muestra en pantalla y contiene un token codificado con el
 *      workshopId (`{origin}/signup?invite=...` — ver buildInviteUrl).
 *   3. El técnico abre el enlace en una nueva ventana (simulando deep link).
 *   4. El signup detecta el parámetro `?invite=` y muestra el banner del taller.
 *   5. El técnico se registra y queda asociado al taller del admin.
 *
 * Nota de selectores (React Native Web):
 *   - El input de contraseña usa placeholder "••••••••" (login) y
 *     "Mínimo 6 caracteres" (signup) con secureTextEntry → se localiza por
 *     `input[type="password"]`.
 *   - Los avisos (alert) usan window.alert en web → se capturan con
 *     waitForEvent('dialog').
 *
 * Requisitos: EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en env
 * (playwright.config.ts carga .env.local). BASE_URL opcional (default: Vercel).
 * Ejecutar: npx playwright test e2e/invitation.spec.ts --project=chromium
 */

import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://mi-app-vibe-ten.vercel.app';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const RUN = Date.now();
const ADMIN_EMAIL = `qa-inv-admin-${RUN}@mailinator.com`;
const ADMIN_PASSWORD = 'Qa-E2e-12345!';
const TECH_EMAIL = `qa-inv-tech-${RUN}@mailinator.com`;

let adminUserId = '';

/** Crea el usuario admin de prueba vía Admin API (sin enviar email). */
async function createTestUser(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        workshop_name: `QA Inv Taller ${RUN % 100000}`,
        full_name: 'QA Inv Admin',
      },
    }),
  });
  const body = (await res.json()) as { id?: string; error?: string; msg?: string };
  if (!res.ok || !body.id) {
    throw new Error(`No se pudo crear el usuario E2E (${res.status}): ${body.error ?? body.msg ?? '?'}`);
  }
  return body.id;
}

/** Borra un usuario de prueba por id (cascade borra perfil + taller + datos). */
async function deleteTestUser(id: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

/** Best-effort: borra el técnico invitado buscándolo por email único. */
async function deleteTestUserByEmail(email: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const body = (await res.json()) as { users?: Array<{ id: string; email?: string }> };
    const match = body.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) await deleteTestUser(match.id);
  } catch {
    // Limpieza best-effort: no debe romper el resultado del suite.
  }
}

/**
 * Helper: inicia sesión como el admin aislado.
 * El input de contraseña real no tiene la palabra "contraseña": renderiza
 * bullets ("••••••••") con secureTextEntry → input[type="password"].
 */
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  const emailInput = page.locator('input[placeholder*="correo"]');
  await emailInput.waitFor({ timeout: 20_000 });
  await emailInput.fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await pressButton(page, 'Iniciar sesión').click();
  // Tras el login la app reemplaza a "/" (dashboard).
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

/**
 * Helper: clic en un "botón" de React Native Web. Los Pressable se renderizan
 * como <div tabindex="0"> que cubre su texto hijo (intercepta el clic si se
 * apunta al texto), así que localizamos el Pressable por su etiqueta exacta.
 */
function pressButton(page: Page, label: string) {
  return page
    .locator('div[tabindex="0"]')
    .filter({ hasText: new RegExp(`^${label}$`, 'i') })
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
    const onDialog = (dialog: import('@playwright/test').Dialog) => {
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

test.beforeAll(async () => {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    throw new Error('Faltan SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_SUPABASE_URL para el E2E.');
  }
  adminUserId = await createTestUser();
});

test.afterAll(async () => {
  if (adminUserId) await deleteTestUser(adminUserId);
  await deleteTestUserByEmail(TECH_EMAIL);
});

test.describe('Flujo de Invitación de Técnico', () => {

  test('Admin genera enlace de invitación y es válido', async ({ page, context }) => {
    // 1. Admin inicia sesión (usuario aislado)
    await loginAsAdmin(page);

    // 2. Navega al panel de administración
    await page.goto(`${BASE_URL}/admin`);
    await expect(page.getByText('Administración & Seguridad', { exact: true })).toBeVisible({ timeout: 20_000 });

    // 3. Genera el enlace de invitación (alert síncrono → se acepta en el handler)
    const inviteButton = pressButton(page, 'Generar Enlace de Invitación');
    await expect(inviteButton).toBeVisible({ timeout: 10_000 });
    const genDialog = waitForDialog(page, /Enlace de invitación generado/);
    await inviteButton.click();
    expect(await genDialog).toContain('Enlace de invitación generado');

    // 4. El enlace real es `{origin}/signup?invite=...` (buildInviteUrl)
    const linkLocator = page.getByText(/\/signup\?invite=/);
    await expect(linkLocator).toBeVisible({ timeout: 10_000 });
    const inviteUrl = (await linkLocator.textContent())?.trim() ?? '';
    expect(inviteUrl).toMatch(/^https:\/\/[^/]+\/signup\?invite=.+/);

    // ── Segunda fase: técnico abre el enlace ──
    const technicianPage = await context.newPage();
    await technicianPage.goto(inviteUrl);

    // 5. Banner de invitación con el nombre del taller del admin
    await expect(technicianPage.getByText('Has sido invitado')).toBeVisible({ timeout: 20_000 });
    await expect(technicianPage.getByText('Únete al equipo')).toBeVisible();
    await expect(technicianPage.getByText(/Taller:/)).toBeVisible();

    // 6. Llena el formulario (placeholders reales del signup)
    await technicianPage.locator('input[placeholder*="TechRepair Master"]').fill('Carlos Técnico');
    await technicianPage.locator('input[placeholder*="correo"]').fill(TECH_EMAIL);
    await technicianPage.locator('input[type="password"]').fill('segura123');

    // 7. Envía — conducta real observable en prod: el alta del técnico queda
    //    PENDIENTE de verificación de correo y la app muestra la pantalla
    //    "Verifica tu correo" (src/app/signup.tsx, rama pendingVerification).
    //    Con autoconfirm mostraría el alert de bienvenida y redirigiría a /login.
    await pressButton(technicianPage, 'Crear cuenta').click();
    const verificationTitle = technicianPage.getByText('Verifica tu correo');
    try {
      await expect(verificationTitle.first()).toBeVisible({ timeout: 30_000 });
      await expect(
        technicianPage.getByText(new RegExp(TECH_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      ).toBeVisible();
    } catch {
      // Modo autoconfirm: sin verificación pendiente redirige al login.
      await technicianPage.waitForURL('**/login', { timeout: 30_000 });
    }

    await technicianPage.close();
  });

  test('Token expirado muestra banner de error en signup', async ({ page }) => {
    // Enlace con expiresAt en el pasado (la ruta real es /signup, no /join).
    const expiredInvite = encodeURIComponent(
      JSON.stringify({
        token: 'EXPIRED-TOKEN-01',
        workshopId: 'demo-admin-1',
        workshopName: 'Taller de Prueba',
        expiresAt: Date.now() - 60_000, // 1 minuto en el pasado
        createdAt: Date.now() - 600_000,
      })
    );

    await page.goto(`${BASE_URL}/signup?invite=${expiredInvite}`);

    // Banner de expiración (texto real renderizado por src/app/signup.tsx).
    await expect(page.getByText('Esta invitación ha expirado')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Solicita un nuevo enlace')).toBeVisible();
  });

  test('Token malformado no muestra banner y permite registro normal', async ({ page }) => {
    // Token inválido → decodeInviteToken devuelve null → sin banner.
    const badInvite = encodeURIComponent('not-valid-json');
    await page.goto(`${BASE_URL}/signup?invite=${badInvite}`);

    // El título debe ser el estándar "Crea tu taller" (no "Únete al equipo").
    await expect(page.getByText('Crea tu taller')).toBeVisible({ timeout: 20_000 });

    // No debe haber banner de invitación.
    await expect(page.getByText('Has sido invitado')).toHaveCount(0);
  });

  test('El botón Copiar enlace copia la URL al portapapeles (web)', async ({ page }) => {
    // Requiere permisos de clipboard — solo se verifica en Chromium
    test.skip(process.platform === 'linux', 'Clipboard test solo en entornos con GUI');
    test.fixme(true, 'Requiere permisos de clipboard en modo headless');
  });
});
