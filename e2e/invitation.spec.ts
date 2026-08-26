/**
 * E2E: Flujo de invitación de técnico (Playwright).
 *
 * Escenario completo:
 *   1. Admin (usuario aislado creado vía Admin API) inicia sesión.
 *   2. Navega a Admin y genera un enlace de invitación.
 *   3. El enlace se copia y contiene un token codificado con el workshopId.
 *   4. El técnico abre el enlace en una nueva ventana (simulando deep link).
 *   5. El signup detecta el parámetro `?invite=` y muestra el banner del taller.
 *   6. El técnico se registra y queda asociado al taller del admin.
 *
 * Requisitos: `@playwright/test` instalado (`npm i -D @playwright/test`)
 * y SUPABASE_SERVICE_ROLE_KEY en env (para crear usuario aislado).
 *
 * Para ejecutar: npx playwright test e2e/invitation.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://mi-app-vibe-ten.vercel.app';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const RUN = Date.now();
const ADMIN_EMAIL = `qa-invite-admin-${RUN}@mailinator.com`;
const ADMIN_PASSWORD = 'Qa-Invite-12345!';
const TECH_EMAIL = `qa-invite-tech-${RUN}@mailinator.com`;
const TECH_PASSWORD = 'Qa-Tech-12345!';
const WORKSHOP_NAME = `QA Invite Workshop ${RUN}`;

let adminUserId = '';

/** Crea el usuario admin de prueba vía Admin API (sin enviar email). */
async function createAdminUser(): Promise<string> {
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
      user_metadata: { role: 'admin', workshop_name: WORKSHOP_NAME, full_name: 'QA Invite Admin' },
    }),
  });
  const body = (await res.json()) as { id?: string; error?: string; msg?: string };
  if (!res.ok || !body.id) {
    throw new Error(`No se pudo crear el usuario admin E2E (${res.status}): ${body.error ?? body.msg ?? '?'}`);
  }
  return body.id;
}

/** Borra el usuario admin de prueba (cascade borra perfil + taller + datos). */
async function deleteAdminUser(id: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

/** Inicia sesión con credenciales dadas. */
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 15_000 });
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-submit-button').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

/** Extrae el enlace de invitación de la página de Admin. */
async function getInviteLink(page: Page): Promise<string> {
  // El enlace se muestra en un elemento con la URL de invitación
  const linkLocator = page.locator('text=https://techrepair.saas/join?invite=');
  await expect(linkLocator).toBeVisible({ timeout: 15_000 });
  const linkText = await linkLocator.textContent({ timeout: 10_000 });
  if (!linkText) throw new Error('No se encontró el enlace de invitación en la página.');
  return linkText.trim();
}

test.describe.configure({ retries: 0 });

test.beforeAll(async () => {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    throw new Error('Faltan SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_SUPABASE_URL para el E2E de invitación.');
  }
  adminUserId = await createAdminUser();
});

test.afterAll(async () => {
  if (adminUserId) await deleteAdminUser(adminUserId);
});

test.describe('Flujo de Invitación de Técnico', () => {
  test('Admin genera enlace de invitación y técnico se registra', async ({ page, context }) => {
    // 1. Admin inicia sesión (usuario aislado)
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // 2. Navega a la pestaña Admin
    await page.getByRole('tab', { name: /admin/i }).click();
    await page.waitForURL('**/admin', { timeout: 15_000 });

    // 3. Genera el enlace de invitación
    const inviteButton = page.getByTestId('btn-generate-invite');
    await expect(inviteButton).toBeVisible({ timeout: 10_000 });
    await inviteButton.click();

    // 4. Verifica que el enlace aparece en pantalla
    const inviteUrl = await getInviteLink(page);
    expect(inviteUrl).toMatch(/^https:\/\/techrepair\.saas\/join\?invite=.+/);

    // ── Segunda fase: técnico abre el enlace ──
    // 5. Abre una nueva ventana (simula que el técnico hace clic en el enlace)
    const technicianPage = await context.newPage();
    await technicianPage.goto(inviteUrl);

    // 6. En la página de signup, debe aparecer el banner de invitación
    await technicianPage.waitForSelector('text=Has sido invitado', { timeout: 15_000 });
    await expect(technicianPage.getByText('Únete al equipo')).toBeVisible();

    // 7. El banner debe mostrar el nombre del taller del admin
    await expect(technicianPage.getByText('Taller:')).toBeVisible();
    await expect(technicianPage.getByText(WORKSHOP_NAME)).toBeVisible();

    // 8. El técnico llena el formulario de registro
    await technicianPage.locator('input[placeholder*="Nombre del taller"]').fill('Carlos Técnico');
    await technicianPage.locator('input[placeholder*="correo"]').fill(TECH_EMAIL);
    await technicianPage.locator('input[placeholder*="contraseña"]').fill(TECH_PASSWORD);

    // 9. Envía el formulario — debe redirigir a login (técnico asociado)
    await technicianPage.getByRole('button', { name: /crear cuenta/i }).click();

    // 10. Mensaje de éxito: bienvenida + asociación al taller
    await expect(technicianPage.getByText(/asociad[ao] al taller/i)).toBeVisible({ timeout: 15_000 });

    // 11. Redirige al login para que el técnico inicie sesión
    await technicianPage.waitForURL('**/login', { timeout: 15_000 });

    // Limpieza
    await technicianPage.close();
  });

  test('Token expirado muestra banner de error en signup', async ({ page }) => {
    // Simula un enlace con un token expirado manualmente
    const expiredInvite = encodeURIComponent(
      JSON.stringify({
        token: 'EXPIRED-TOKEN-01',
        workshopId: 'demo-admin-1',
        workshopName: 'Taller de Prueba',
        expiresAt: Date.now() - 60_000, // 1 minuto en el pasado
        createdAt: Date.now() - 600_000,
      })
    );

    await page.goto(`${BASE_URL}/join?invite=${expiredInvite}`);

    // Debe aparecer el banner de expiración (texto flexible para producción)
    await expect(page.getByText(/invitaci[oó]n ha expirado/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/solicita un nuevo enlace/i)).toBeVisible();
  });

  test('Token malformado no muestra banner y permite registro normal', async ({ page }) => {
    // Token inválido
    const badInvite = encodeURIComponent('not-valid-json');
    await page.goto(`${BASE_URL}/join?invite=${badInvite}`);

    // No debe haber banner de invitación
    await page.waitForLoadState('networkidle');
    const inviteBanner = page.getByText('Has sido invitado');
    await expect(inviteBanner).toHaveCount(0);

    // El título debe ser el estándar de signup (texto flexible)
    await expect(page.getByText(/crea tu taller|reg[ií]strate|crear cuenta/i)).toBeVisible({ timeout: 10_000 });
  });

  test('El botón Copiar enlace copia la URL al portapapeles (web)', async ({ page }) => {
    // Requiere permisos de clipboard — solo se verifica en Chromium
    test.skip(process.platform === 'linux', 'Clipboard test solo en entornos con GUI');
    test.fixme(true, 'Requiere permisos de clipboard en modo headless');
  });
});