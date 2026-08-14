/**
 * E2E: Flujo de invitación de técnico (Playwright).
 *
 * Escenario completo:
 *   1. Admin inicia sesión, navega a Admin y genera un enlace de invitación.
 *   2. El enlace se copia y contiene un token codificado con el workshopId.
 *   3. El técnico abre el enlace en una nueva ventana (simulando deep link).
 *   4. El signup detecta el parámetro `?invite=` y muestra el banner del taller.
 *   5. El técnico se registra y queda asociado al taller del admin.
 *
 * Requisitos: `@playwright/test` instalado (`npm i -D @playwright/test`)
 * y un servidor de desarrollo corriendo en `http://localhost:8081`.
 *
 * Para ejecutar: npx playwright test e2e/invitation.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';

/**
 * Helper: inicia sesión como el admin (usuario de prueba).
 * Usa credenciales demo del pool local (sin Supabase).
 */
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[placeholder*="correo"]', { timeout: 10_000 });
  await page.locator('input[placeholder*="correo"]').fill('admin@techrepair.com');
  await page.locator('input[placeholder*="contraseña"]').fill('demo123');
  await page.locator('button, [role="button"]').filter({ hasText: /iniciar sesión/i }).click();
  await page.waitForURL('**/(tabs)/**', { timeout: 10_000 });
}

/**
 * Helper: extrae el valor del campo de texto seleccionable que contiene
 * el enlace de invitación generado.
 */
async function getInviteLink(page: import('@playwright/test').Page): Promise<string> {
  // El enlace se muestra en un elemento selectable con la URL de invitación.
  const linkText = await page
    .locator('text=https://techrepair.saas/join?invite=')
    .textContent({ timeout: 10_000 });
  if (!linkText) throw new Error('No se encontró el enlace de invitación en la página.');
  return linkText.trim();
}

test.describe('Flujo de Invitación de Técnico', () => {

  test('Admin genera enlace de invitación y es válido', async ({ page, context }) => {
    // 1. Admin inicia sesión
    await loginAsAdmin(page);

    // 2. Navega a la pestaña Admin
    await page.locator('[role="tab"]', { hasText: /admin/i }).click();
    await page.waitForURL('**/admin', { timeout: 10_000 });

    // 3. Genera el enlace de invitación
    const inviteButton = page.locator('button, [role="button"]').filter({ hasText: /generar enlace/i });
    await expect(inviteButton).toBeVisible({ timeout: 5_000 });
    await inviteButton.click();

    // 4. Verifica que el enlace aparece en pantalla (con URL codificada)
    const linkLocator = page.locator('text=https://techrepair.saas/join?invite=');
    await expect(linkLocator).toBeVisible({ timeout: 10_000 });

    const inviteUrl = await getInviteLink(page);

    // 5. Extrae el token de la URL para inspección
    expect(inviteUrl).toMatch(/^https:\/\/techrepair\.saas\/join\?invite=.+/);

    // ── Segunda fase: técnico abre el enlace ──
    // 6. Abre una nueva ventana (simula que el técnico hace clic en el enlace)
    const technicianPage = await context.newPage();
    await technicianPage.goto(inviteUrl);

    // 7. En la página de signup, debe aparecer el banner de invitación
    await technicianPage.waitForSelector('text=Has sido invitado', { timeout: 10_000 });
    await expect(technicianPage.locator('text=Únete al equipo')).toBeVisible();

    // 8. El banner debe mostrar el nombre del taller del admin
    await expect(technicianPage.locator('text=Taller:')).toBeVisible();

    // 9. El técnico llena el formulario de registro
    await technicianPage.locator('input[placeholder*="Nombre del taller"]').fill('Carlos Técnico');
    await technicianPage.locator('input[placeholder*="correo"]').fill('carlos.tecnico@taller.com');
    await technicianPage.locator('input[placeholder*="contraseña"]').fill('segura123');

    // 10. Envía el formulario — debe redirigir a login (técnico asociado)
    await technicianPage.locator('button, [role="button"]').filter({ hasText: /crear cuenta/i }).click();

    // 11. Mensaje de éxito: bienvenida + asociación al taller
    await expect(technicianPage.locator('text=asociada al taller')).toBeVisible({ timeout: 10_000 });

    // 12. Redirige al login para que el técnico inicie sesión
    await technicianPage.waitForURL('**/login', { timeout: 10_000 });

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

    // Debe aparecer el banner de expiración
    await expect(page.locator('text=Esta invitación ha expirado')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Solicita un nuevo enlace')).toBeVisible();
  });

  test('Token malformado no muestra banner y permite registro normal', async ({ page }) => {
    // Token inválido
    const badInvite = encodeURIComponent('not-valid-json');
    await page.goto(`${BASE_URL}/join?invite=${badInvite}`);

    // No debe haber banner de invitación
    await page.waitForLoadState('networkidle');
    const inviteBanner = page.locator('text=Has sido invitado');
    await expect(inviteBanner).toHaveCount(0);

    // El título debe ser el estándar "Crea tu taller" (no "Únete al equipo")
    await expect(page.locator('text=Crea tu taller')).toBeVisible();
  });

  test('El botón Copiar enlace copia la URL al portapapeles (web)', async ({ page }) => {
    // Requiere permisos de clipboard — solo se verifica en Chromium
    test.skip(process.platform === 'linux', 'Clipboard test solo en entornos con GUI');
    test.fixme(true, 'Requiere permisos de clipboard en modo headless');
  });
});