/**
 * playwright.config.ts — Configuración E2E (Capa 3).
 *
 * Target por defecto: la app desplegada (Vercel). Para correr contra un
 * servidor local: BASE_URL=http://localhost:8081 npx playwright test.
 *
 * El E2E usa un usuario de prueba AISLADO creado vía Admin API dentro del
 * propio spec (beforeAll) y eliminado al final (afterAll) — no toca datos
 * reales de talleres existentes.
 */

import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Playwright no carga .env automáticamente: cargamos .env y .env.local para
// que los specs tengan EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
for (const f of ['.env', '.env.local']) {
  if (existsSync(f)) process.loadEnvFile(f);
}

const BASE_URL = process.env.BASE_URL || 'https://mi-app-vibe-ten.vercel.app';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});