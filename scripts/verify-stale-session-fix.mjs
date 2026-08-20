#!/usr/bin/env node
/**
 * Reproduce la falla de producción exacta y verifica el fix:
 *
 * Escenario: el navegador conserva un JWT válido de una cuenta que fue
 * eliminada de auth.users (p. ej. QA user borrado vía Admin API).
 *
 * Antes del fix:  ensure_workshop() → FK 23503 profiles_id_fkey → taller sin
 *                 resolver → fetchRepairs bloqueado (job/[id] y receipt/[id]
 *                 inalcanzables).
 * Después del fix: ensure_workshop() devuelve null sin error, y getUser()
 *                 falla → el cliente (resolveWorkshopId) cierra la sesión.
 *
 * Uso: node scripts/verify-stale-session-fix.mjs
 * Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnvFile(file) {
  const full = path.join(root, file);
  if (!existsSync(full)) return {};
  const out = {};
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local'), ...process.env };
const URL = env.EXPO_PUBLIC_SUPABASE_URL || 'https://phmhlbodkoicjctlamah.supabase.co';
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobWhsYm9ka29pY2pjdGxhbWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMTkzMzUsImV4cCI6MjEwMTc5NTMzNX0.a4w9DW-NarxLVnOgSMnZ_PNwZdFJimIcpi8MCBtasUQ';
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || null;

let passed = 0, failed = 0;
const report = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? passed++ : failed++;
};

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY no está disponible. No se puede crear/borrar el usuario de prueba.');
  process.exit(1);
}

const RUN = Date.now();
const EMAIL = `stale-session-${RUN}@mailinator.com`;
const PASSWORD = 'Stale-Test-12345!';
const service = createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, ANON_KEY, { auth: { persistSession: false } });

let userId = '';
let staleAccessToken = '';

try {
  // 1) Crear usuario real (trigger handle_new_user crea taller + perfil).
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'QA Stale Session' },
  });
  report('Setup: Admin API crea usuario', !createErr && !!created.user?.id, createErr?.message ?? created.user?.id);
  if (createErr || !created.user?.id) process.exit(1);
  userId = created.user.id;

  // 2) Iniciar sesión real → JWT válido.
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  report('Setup: signIn devuelve sesión', !signInErr && !!signIn.session, signInErr?.message ?? 'ok');
  if (signInErr || !signIn.session) process.exit(1);
  staleAccessToken = signIn.session.access_token;
  const staleClient = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${staleAccessToken}` } },
    auth: { persistSession: false },
  });

  // 3) ensure_workshop con usuario VIVO → debe crear taller+perfil.
  const { data: wid, error: liveErr } = await staleClient.rpc('ensure_workshop');
  report('LIVE: ensure_workshop devuelve workshop_id (sin error)', !liveErr && typeof wid === 'string' && wid.length > 0, liveErr ? `code=${liveErr.code} ${liveErr.message}` : `workshop=${wid}`);

  // 4) BORRAR el usuario (simula la cuenta eliminada mientras el navegador
  //    conservaba la sesión).
  const { error: delErr } = await service.auth.admin.deleteUser(userId);
  report('Setup: Admin API elimina usuario', !delErr, delErr?.message ?? 'ok');
  if (delErr) process.exit(1);

  // 5) EL TEST CLAVE: ensure_workshop con el JWT AHORA OBSOLETO.
  //    Antes del fix → error 23503. Después del fix → null SIN error.
  const { data: staleWid, error: staleErr } = await staleClient.rpc('ensure_workshop');
  const cleanNull = !staleErr && staleWid === null;
  report('FIX: ensure_workshop con sesión obsoleta devuelve null SIN error 23503', cleanNull,
    staleErr ? `code=${staleErr.code} ${staleErr.message}` : `data=${JSON.stringify(staleWid)}`);

  // 6) El trigger del cliente: getUser() debe fallar (usuario no existe).
  const { data: ghost, error: ghostErr } = await staleClient.auth.getUser();
  const ghostDetected = ghostErr || !ghost.user;
  report('FIX: getUser() detecta la cuenta fantasma (cliente puede cerrar sesión)', ghostDetected,
    ghostErr ? `code=${ghostErr.code ?? ghostErr.status} ${ghostErr.message}` : `user=${ghost.user?.id}`);

  // 7) current_workshop_id también debe devolver null sin error (no data fantasma).
  const { data: cw, error: cwErr } = await staleClient.rpc('current_workshop_id');
  report('FIX: current_workshop_id con sesión obsoleta devuelve null', !cwErr && cw === null,
    cwErr ? `code=${cwErr.code} ${cwErr.message}` : `data=${JSON.stringify(cw)}`);
} catch (err) {
  report('Ejecución', false, err.message);
} finally {
  // Cleanup: si el usuario sigue existiendo, borrarlo.
  if (userId) {
    const { error } = await service.auth.admin.deleteUser(userId);
    console.log(`CLEAN usuario ${userId} ${error ? `(fallo: ${error.message})` : 'eliminado'}`);
  }
  console.log(`\nRESULTADO: ${passed} pass, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
}