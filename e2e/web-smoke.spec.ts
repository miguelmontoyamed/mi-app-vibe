/**
 * e2e/web-smoke.spec.ts — Smoke test web (Capa 3).
 *
 * Objetivo: que una actualización NUNCA vuelva a dejar una pantalla en blanco
 * o un error fatal en producción sin que este test lo detecte antes del push.
 *
 * Verifica contra la URL desplegada (por defecto Vercel; local con
 * BASE_URL=http://localhost:8081):
 *   1. La app carga y renderiza el login (no pantalla en blanco).
 *   2. No hay excepciones de página, errores de consola ni recursos rotos.
 *
 * Excepción whitelisted: el ruido anónimo de `ensure_workshop` (401/42501
 * "permission denied") que el backend emite por diseño cuando no hay sesión.
 * Una vez desplegado el guard de `resolveWorkshopId`, este patrón deja de
 * aparecer y la whitelist queda inerte.
 */

import { expect, test, type Page } from '@playwright/test';

// Ruido conocido del estado pre-fix: el RPC anónimo `ensure_workshop` responde
// 401/42501 "permission denied" porque el rol anon no tiene GRANT en schema.sql.
// Una vez desplegado el guard de `resolveWorkshopId` (no llamar el RPC sin
// sesión), este patrón deja de aparecer y las whitelists quedan inertes.
const KNOWN_NOISE = /ensure_workshop|42501|permission denied/i;

async function collectFatalErrors(page: Page): Promise<string[]> {
  const fatal: string[] = [];
  page.on('pageerror', (err) => fatal.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // El mensaje genérico "Failed to load resource" no identifica la URL: los
    // cubre con precisión el listener de `response` de abajo (status + URL).
    if (msg.text().includes('Failed to load resource')) return;
    if (!KNOWN_NOISE.test(msg.text())) fatal.push(`console.error: ${msg.text()}`);
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400 && !KNOWN_NOISE.test(res.url())) {
      fatal.push(`HTTP ${status}: ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    // Fallos de red transitorios al backend no deben tumbar el smoke del render.
    if (!url.includes('supabase.co') && !KNOWN_NOISE.test(url)) {
      fatal.push(`requestfailed: ${url} — ${req.failure()?.errorText ?? 'unknown'}`);
    }
  });
  return fatal;
}

test('la app carga y renderiza el login sin errores fatales', async ({ page }) => {
  const fatal = await collectFatalErrors(page);

  await page.goto('/', { waitUntil: 'load', timeout: 60_000 });

  // 1. No pantalla en blanco: la marca y el formulario de login (señal de que
  // React montó la app) deben ser visibles.
  await expect(page.getByText(/TechRepair/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByPlaceholder('correo@taller.com').first()).toBeVisible({ timeout: 10_000 });

  // Pequeño margen para capturar errores asíncronos (RPCs, reactividad).
  await page.waitForTimeout(1_500);

  // 2. Cero errores fatales.
  expect(fatal, `Errores fatales en ${page.url()}:\n${fatal.join('\n')}`).toEqual([]);
});