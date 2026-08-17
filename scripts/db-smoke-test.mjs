#!/usr/bin/env node
/**
 * Smoke test real contra Supabase (proyecto: phmhlbodkoicjctlamah / TechRepair Master).
 *
 * Objetivo: confirmar que (a) las credenciales (URL + anon key) son válidas,
 * (b) el endpoint REST responde, (c) las políticas RLS de public.repairs se
 * comportan como se espera para SELECT e INSERT.
 *
 * Modos:
 *  - Anónimo (por defecto): SELECT debe devolver 0 filas (RLS filtra) e INSERT
 *    debe ser rechazado con 42501 (RLS bloquea) — es lo que cualquier cliente
 *    SIN sesión obtiene.
 *  - Con usuario real: si el proyecto tiene autoconfirm activo, signUp devuelve
 *    sesión y se ejecuta el roundtrip completo INSERT -> SELECT -> DELETE con
 *    limpieza. Si hay SUPABASE_SERVICE_ROLE_KEY, se crea/borra un usuario de
 *    prueba vía Admin API para el mismo roundtrip.
 *
 * Uso: node scripts/db-smoke-test.mjs
 * Env (o .env / .env.local): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
 *                            [SUPABASE_SERVICE_ROLE_KEY]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Configuración
// ────────────────────────────────────────────────────────────────────────────

// Valores públicos del bundle desplegado (las anon keys son públicas por diseño).
const DEFAULT_URL = 'https://phmhlbodkoicjctlamah.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobWhsYm9ka29pY2pjdGxhbWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMTkzMzUsImV4cCI6MjEwMTc5NTMzNX0.a4w9DW-NarxLVnOgSMnZ_PNwZdFJimIcpi8MCBtasUQ';

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
const URL = env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || null;

let passed = 0;
let failed = 0;
const results = [];

function report(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n       ${String(detail).replace(/\n/g, '\n       ')}` : ''}`);
}

const anon = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = SERVICE_ROLE_KEY ? createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const FAKE_ID = 'SMOKE-TEST-' + Date.now().toString(36).toUpperCase();

// ────────────────────────────────────────────────────────────────────────────
// Test 1: conectividad + credenciales válidas
// ────────────────────────────────────────────────────────────────────────────
try {
  const res = await fetch(`${URL}/rest/v1/repairs?select=id&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  const reachable = res.status === 200;
  report('Conectividad: REST responde y la anon key es válida', reachable, `HTTP ${res.status} ${res.statusText}`);
} catch (err) {
  report('Conectividad: REST responde y la anon key es válida', false, err.message);
}

// ────────────────────────────────────────────────────────────────────────────
// Test 2: SELECT anónimo (RLS debe filtrar -> 0 filas, sin error)
// ────────────────────────────────────────────────────────────────────────────
try {
  const { data, error } = await anon.from('repairs').select('id').limit(1);
  const rows = Array.isArray(data) ? data.length : -1;
  report('SELECT anónimo: RLS filtra (0 filas, sin error)', !error && rows === 0, error ? `error=${error.code} ${error.message}` : `filas=${rows}`);
} catch (err) {
  report('SELECT anónimo: RLS filtra (0 filas, sin error)', false, err.message);
}

// ────────────────────────────────────────────────────────────────────────────
// Test 3: INSERT anónimo (RLS debe rechazar -> 42501)
// ────────────────────────────────────────────────────────────────────────────
try {
  const { data, error } = await anon.from('repairs').insert({
    id: FAKE_ID,
    client_name: 'Smoke Test',
    device: 'No-op',
    budget: 0,
    status: 'Pendiente',
    date: new Date().toISOString().split('T')[0],
  }).select('id');
  const rejected = !!error && String(error.code) === '42501';
  report('INSERT anónimo: RLS rechaza (42501)', rejected && !data, error ? `code=${error.code} ${error.message}` : `SIN ERROR (filas=${data?.length}) — ¡revisar RLS!`);
} catch (err) {
  report('INSERT anónimo: RLS rechaza (42501)', false, err.message);
}

// ────────────────────────────────────────────────────────────────────────────
// Test 4: roundtrip con usuario real (solo si hay sesión o service role)
// ────────────────────────────────────────────────────────────────────────────
let userToCleanup = null;
let techUserToCleanup = null;
let techOrphanWorkshop = null;
let healedWorkshop = null;

try {
  let session = null;

  // 4a: probar autoconfirm del proyecto con un email desechable.
  if (!session && !admin) {
    const email = `smoke.test.${Date.now()}@gmail.com`;
    const { data, error } = await anon.auth.signUp({ email, password: 'SmokeTest123!' });
    if (!error && data.session) {
      session = data.session;
      userToCleanup = data.user?.id ?? null;
      report('SignUp con autoconfirm devuelve sesión', true, email);
    } else if (!error && !data.session) {
      console.log(`SKIP  Roundtrip con usuario real: autoconfirm desactivado (signUp no devuelve sesión). Define SUPABASE_SERVICE_ROLE_KEY para el roundtrip garantizado.`);
    } else {
      report('SignUp con autoconfirm devuelve sesión', false, error?.message ?? 'error desconocido');
    }
  }

  // 4b: crear usuario de prueba vía Admin API si hay service role.
  if (!session && admin) {
    const email = `smoke-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'SmokeTest123!',
      email_confirm: true,
    });
    if (!error && data.user) {
      userToCleanup = data.user.id;
      const { data: s, error: sErr } = await anon.auth.signInWithPassword({ email, password: 'SmokeTest123!' });
      if (!sErr && s.session) session = s.session;
      report('Creación de usuario de prueba vía Admin API', !!session, sErr ? sErr.message : email);
    } else {
      report('Creación de usuario de prueba vía Admin API', false, error?.message ?? 'sin usuario');
    }
  }

  if (session) {
    const client = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false } });

    // Simular una cuenta "rota" (creada antes del trigger o con trigger que
    // tragó el error): borrar su fila en profiles con service role.
    if (admin && userToCleanup) {
      const { error: delProfErr } = await admin.from('profiles').delete().eq('id', userToCleanup);
      report('Setup: perfil eliminado (simula cuenta sin fila en profiles)', !delProfErr, delProfErr ? delProfErr.message : 'ok');
    }

    // Self-healing: ensure_workshop debe crear taller + perfil (rol admin).
    const { data: healed, error: healErr } = await client.rpc('ensure_workshop');
    const healedOk = !healErr && typeof healed === 'string' && healed.length > 0;
    if (healedOk) healedWorkshop = healed;
    report('Self-heal: ensure_workshop crea taller+perfil (workshop_id no null)', healedOk, healErr ? `code=${healErr.code} ${healErr.message}` : `workshop=${healed}`);

    // current_workshop_id ya no puede ser null para un usuario activo.
    const { data: wid2, error: widErr2 } = await client.rpc('current_workshop_id');
    const consistent = !widErr2 && typeof wid2 === 'string' && wid2 === healed;
    report('Self-heal: current_workshop_id ya no devuelve null (y coincide con ensure_workshop)', consistent, widErr2 ? `code=${widErr2.code} ${widErr2.message}` : `workshop=${wid2}`);

    const wid = healedOk ? healed : (typeof wid2 === 'string' && wid2 ? wid2 : null);
    if (wid) {
      const row = {
        id: FAKE_ID,
        workshop_id: wid,
        client_name: 'Smoke Test Roundtrip',
        phone: '+573001112233',
        device: 'iPhone 13',
        issue: 'Smoke test — se elimina al terminar',
        budget: 150000,
        advance_payment: 0,
        status: 'Pendiente',
        date: new Date().toISOString().split('T')[0],
      };
      const { data: ins, error: insErr } = await client.from('repairs').insert(row).select('id');
      report('INSERT con usuario real: HTTP 201 + ID confirmado de Supabase', !insErr && ins?.length === 1 && ins[0].id === FAKE_ID, insErr ? `code=${insErr.code} ${insErr.message}` : `id=${ins?.[0]?.id}`);

      const { data: sel, error: selErr } = await client.from('repairs').select('*').eq('id', FAKE_ID);
      const found = !selErr && Array.isArray(sel) && sel.length === 1 && sel[0].client_name === row.client_name;
      report('SELECT con usuario real (RLS permite y devuelve la fila)', found, selErr ? `code=${selErr.code} ${selErr.message}` : `filas=${sel?.length}`);

      // 4c: TÉCNICO del mismo taller NO puede eliminar órdenes (RLS: DELETE solo admin).
      if (admin) {
        const techEmail = `tech-${Date.now()}@example.com`;
        const { data: techUser, error: techErr } = await admin.auth.admin.createUser({
          email: techEmail,
          password: 'SmokeTest123!',
          email_confirm: true,
        });
        if (!techErr && techUser.user) {
          techUserToCleanup = techUser.user.id;
          // El trigger handle_new_user ya creó perfil (y taller propio) para el
          // técnico; lo redirigimos al taller del admin con rol técnico vía upsert.
          const { data: techProfBefore, error: techProfReadErr } = await admin
            .from('profiles').select('workshop_id').eq('id', techUser.user.id).maybeSingle();
          if (!techProfReadErr && techProfBefore?.workshop_id && techProfBefore.workshop_id !== healedWorkshop) {
            techOrphanWorkshop = techProfBefore.workshop_id;
          }
          const { error: profErr } = await admin.from('profiles').upsert({
            id: techUser.user.id,
            workshop_id: healedWorkshop,
            full_name: 'Tecnico Prueba',
            role: 'technician',
          }, { onConflict: 'id' });
          const { data: techSession, error: tSignErr } = await anon.auth.signInWithPassword({ email: techEmail, password: 'SmokeTest123!' });
          if (!profErr && !tSignErr && techSession.session) {
            const techClient = createClient(URL, ANON_KEY, {
              global: { headers: { Authorization: `Bearer ${techSession.session.access_token}` } },
              auth: { persistSession: false },
            });
            // DELETE filtrado por RLS devuelve 200/204 con 0 filas (NO lanza 42501):
            // la fila es invisible para `using (… AND role='admin')` y no se borra.
            const { data: delData, error: delErr } = await techClient.from('repairs').delete().eq('id', FAKE_ID).select('id');
            const silentBlock = !delErr && (!delData || delData.length === 0);
            // Prueba contundente: la orden SIGUE existiendo tras el intento del técnico.
            const { data: stillThere, error: stillErr } = await techClient.from('repairs').select('id').eq('id', FAKE_ID);
            const rowSurvived = !stillErr && Array.isArray(stillThere) && stillThere.length === 1;
            const blocked = silentBlock && rowSurvived;
            report('Seguridad: técnico NO puede eliminar (RLS bloquea, la orden sobrevive)', blocked,
              delErr ? `code=${delErr.code} ${delErr.message}` : `DELETE devolvió ${delData?.length ?? 0} filas; SELECT tras intento=${stillThere?.length ?? 0}`);
          } else {
            report('Seguridad: técnico NO puede eliminar (RLS bloquea, la orden sobrevive)', false, profErr ? profErr.message : (tSignErr ? tSignErr.message : 'sin sesión de técnico'));
          }
        } else {
          report('Seguridad: técnico NO puede eliminar (RLS 42501)', false, techErr?.message ?? 'no se pudo crear el técnico de prueba');
        }
      } else {
        report('Seguridad: técnico NO puede eliminar (RLS 42501)', false, 'sin admin (service role) no se puede crear el técnico');
      }

      const { error: delErr } = await client.from('repairs').delete().eq('id', FAKE_ID);
      report('Limpieza: DELETE del registro de prueba', !delErr, delErr ? delErr.message : 'ok');
    }
  }
} catch (err) {
  report('Roundtrip con usuario real', false, err.message);
}

// Limpieza del usuario de prueba (si se creó vía Admin API) y del taller
// auto-aprovisionado por ensure_workshop (si quedó huérfano tras el cascade).
if (userToCleanup && admin) {
  const { error } = await admin.auth.admin.deleteUser(userToCleanup);
  console.log(`CLEAN  usuario de prueba ${userToCleanup} ${error ? `(fallo: ${error.message})` : 'eliminado'}`);
  if (healedWorkshop) {
    const { error: wErr } = await admin.from('workshops').delete().eq('id', healedWorkshop);
    console.log(`CLEAN  taller de prueba ${healedWorkshop} ${wErr ? `(fallo: ${wErr.message})` : 'eliminado'}`);
  }
}
if (techUserToCleanup && admin) {
  const { error } = await admin.auth.admin.deleteUser(techUserToCleanup);
  console.log(`CLEAN  técnico de prueba ${techUserToCleanup} ${error ? `(fallo: ${error.message})` : 'eliminado'}`);
  if (techOrphanWorkshop) {
    const { error: wErr } = await admin.from('workshops').delete().eq('id', techOrphanWorkshop);
    console.log(`CLEAN  taller huérfano del técnico ${techOrphanWorkshop} ${wErr ? `(fallo: ${wErr.message})` : 'eliminado'}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────────');
console.log(`RESULTADO: ${passed} PASS, ${failed} FAIL`);
if (SERVICE_ROLE_KEY) console.log('(modo: service role + Admin API)');
else console.log('(modo: anónimo + autoconfirm probe; para roundtrip garantizado defina SUPABASE_SERVICE_ROLE_KEY)');
process.exit(failed === 0 ? 0 : 1);
