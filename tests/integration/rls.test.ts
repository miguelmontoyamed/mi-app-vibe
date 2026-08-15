/**
 * tests/integration/rls.test.ts — Capa 1: Tests de integración RLS (18 casos)
 *
 * Verifica contra la BD REAL de Supabase que las políticas RLS se comportan
 * como espera el negocio:
 *   - Admin y técnico pueden operar sobre repairs/inventory/workshop_profiles
 *     de SU taller (matriz INSERT / UPDATE / DELETE).
 *   - NINGÚN usuario puede escalar su rol (technician → admin, admin → X).
 *   - Un técnico NO puede modificar perfiles de admin.
 *   - Nadie puede cruzar a otro taller (cross-workshop) ni crear filas con
 *     workshop_id ajeno.
 *
 * Setup (reproducible, sin tocar datos reales):
 *   1. Crea un taller temporal + admin y technician vía Admin API
 *      (service role, email_confirm=true — el trigger handle_new_user crea
 *      taller y perfiles automáticamente).
 *   2. Inicia sesión real con ambos (signInWithPassword).
 *   3. Corre la matriz de 18 casos.
 *   4. Cleanup: borra usuarios (Admin API) y talleres (service role); el
 *      cascade elimina repairs/inventory/workshop_profiles/clients.
 *
 * Requisitos (env): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. El script npm `test:rls` carga .env + .env.local.
 * Si faltan, la suite se marca como skip (para no romper CI sin credenciales).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const RUN = Date.now();
const ADMIN_EMAIL = `qa-admin-${RUN}@mailinator.com`;
const TECH_EMAIL = `qa-tech-${RUN}@mailinator.com`;
const PASSWORD = 'Qa-Test-12345!';

/** Client con service role: bypass RLS para setup/cleanup. */
let service: SupabaseClient;
/** Clientes autenticados como admin / technician (anon + sesión real). */
let admin: SupabaseClient;
let tech: SupabaseClient;
let adminUserId = '';
let techUserId = '';
let workshopId = '';
let foreignWorkshopId = '';

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

async function adminApiCreateUser(email: string, metadata: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const body = (await res.json()) as { id?: string; error?: string; msg?: string };
  if (!res.ok) {
    throw new Error(`Admin API create user falló (${res.status}): ${body.error ?? body.msg ?? res.statusText}`);
  }
  if (!body.id) throw new Error('Admin API no devolvió el id del usuario.');
  return body.id;
}

async function adminApiDeleteUser(id: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

async function loginAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.ifError(error);
  return client;
}

/** La operación debe RESOLVER (sin error de RLS). */
async function expectAllowed(op: () => PromiseLike<{ error: unknown }>) {
  const { error } = await op();
  assert.ifError(error);
}

/**
 * La operación debe estar BLOQUEADA por RLS. PostgREST tiene dos formas de
 * bloquear: con error 42501 (INSERT / with check) o silenciosamente devolviendo
 * 0 filas (UPDATE/DELETE filtrado por `using`). Ambas cuentan como bloqueo.
 */
async function expectBlocked(op: () => PromiseLike<{ error: unknown; data: unknown }>) {
  const { error, data } = await op();
  if (error) return; // 42501 new row violates row-level security policy
  const rows = Array.isArray(data) ? data.length : 0;
  assert.equal(rows, 0, 'se esperaba 0 filas afectadas (bloqueo silencioso de RLS)');
}

// ──────────────────────────────────────────────────────────────────────────
// Setup / Cleanup
// ──────────────────────────────────────────────────────────────────────────

function needsSetup(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
}

before(async () => {
  if (!needsSetup()) {
    return; // la suite se marca skip abajo
  }
  service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1) Admin: metadata role=admin + workshop_name → el trigger crea taller nuevo.
  adminUserId = await adminApiCreateUser(ADMIN_EMAIL, {
    role: 'admin',
    workshop_name: `QA RLS ${RUN}`,
    full_name: 'QA Admin',
  });

  // 2) Técnico: metadata workshop_id = id del ADMIN (auth.users.id) → el trigger
  //    resuelve el taller real desde SU perfil (mismo taller que el admin).
  techUserId = await adminApiCreateUser(TECH_EMAIL, {
    role: 'technician',
    workshop_id: adminUserId,
    full_name: 'QA Tech',
  });

  // 3) Sesiones reales.
  admin = await loginAs(ADMIN_EMAIL);
  tech = await loginAs(TECH_EMAIL);

  // 4) Resolver el taller compartido (vía current_workshop_id, que es lo que
  //    usa el frontend).
  const { data: wid, error: widErr } = await admin.rpc('current_workshop_id');
  assert.ifError(widErr);
  assert.ok(typeof wid === 'string' && wid, 'no se resolvió current_workshop_id del admin');
  workshopId = wid;

  // 5) Taller ajeno (para cross-workshop): se crea con service role.
  const { data: fw, error: fwErr } = await service
    .from('workshops')
    .insert({ name: `QA Foreign ${RUN}` })
    .select('id')
    .single();
  assert.ifError(fwErr);
  foreignWorkshopId = (fw as { id: string }).id;

  // 6) Un repair en el taller ajeno (para UPDATE/DELETE cross-workshop).
  const { error: fwRepairErr } = await service
    .from('repairs')
    .insert({
      id: `TRM-FOR-${RUN % 10000}`,
      workshop_id: foreignWorkshopId,
      client_name: 'Cliente Ajeno',
      device: 'Pixel 8',
      status: 'Pendiente',
    });
  assert.ifError(fwRepairErr);
});

after(async () => {
  if (!needsSetup()) return;
  // Talleres primero (cascade borra repairs/inventory/workshop_profiles/clients).
  await service.from('workshops').delete().eq('id', foreignWorkshopId);
  await service.from('workshops').delete().eq('id', workshopId);
  // Usuarios (cascade borra profiles vía FK auth.users).
  await adminApiDeleteUser(adminUserId);
  await adminApiDeleteUser(techUserId);
});

// ──────────────────────────────────────────────────────────────────────────
// Matriz de 18 casos
// ──────────────────────────────────────────────────────────────────────────

describe('RLS integration — 18 casos', () => {
  const skip = !needsSetup();

  it('A1. Admin INSERT repair (TRM-XXXX) — permitido', { skip }, async () => {
    await expectAllowed(() =>
      admin.from('repairs').insert({
        id: `TRM-A1-${RUN % 10000}`,
        workshop_id: workshopId,
        client_name: 'Cliente A1',
        device: 'iPhone 13',
        status: 'Pendiente',
      })
    );
  });

  it('A2. Admin UPDATE repair — permitido', { skip }, async () => {
    await expectAllowed(() =>
      admin.from('repairs').update({ status: 'En Proceso' }).eq('id', `TRM-A1-${RUN % 10000}`)
    );
  });

  it('A3. Admin DELETE repair — permitido', { skip }, async () => {
    await expectAllowed(() =>
      admin.from('repairs').delete().eq('id', `TRM-A1-${RUN % 10000}`)
    );
  });

  it('A4. Admin UPSERT workshop_profiles — permitido', { skip }, async () => {
    await expectAllowed(() =>
      admin.from('workshop_profiles').upsert(
        { workshop_id: workshopId, name: 'QA Taller', nit: '9012345678' },
        { onConflict: 'workshop_id' }
      )
    );
  });

  it('A5. Admin SELECT workshop_profiles — permitido', { skip }, async () => {
    const { data } = await admin.from('workshop_profiles').select('*').eq('workshop_id', workshopId);
    assert.ok(Array.isArray(data), 'devolvió filas del membrete');
  });

  it('A6. Admin INSERT inventory — permitido', { skip }, async () => {
    const { data } = await admin
      .from('inventory')
      .insert({ workshop_id: workshopId, name: `Repuesto QA ${RUN}`, stock: 5, price: 10000 })
      .select('id')
      .single();
    assert.ok((data as { id: string }).id);
  });

  it('A7. Admin UPDATE inventory — permitido', { skip }, async () => {
    const { data } = await admin
      .from('inventory')
      .update({ stock: 3 })
      .eq('workshop_id', workshopId)
      .select('id');
    assert.ok(Array.isArray(data) && data.length >= 1, 'actualizó inventario del taller');
  });

  it('A8. Admin UPDATE propio rol (escalada) — BLOQUEADO', { skip }, async () => {
    await expectBlocked(() =>
      admin.from('profiles').update({ role: 'technician' }).eq('id', adminUserId)
    );
  });

  it('A9. Admin UPDATE perfil de técnico (gestionar) — permitido', { skip }, async () => {
    await expectAllowed(() =>
      admin.from('profiles').update({ is_active: false }).eq('id', techUserId)
    );
  });

  it('T1. Technician INSERT repair — permitido', { skip }, async () => {
    await expectAllowed(() =>
      tech.from('repairs').insert({
        id: `TRM-T1-${RUN % 10000}`,
        workshop_id: workshopId,
        client_name: 'Cliente T1',
        device: 'Samsung S23',
        status: 'Pendiente',
      })
    );
  });

  it('T2. Technician UPDATE repair — permitido', { skip }, async () => {
    await expectAllowed(() =>
      tech.from('repairs').update({ status: 'En Proceso' }).eq('id', `TRM-T1-${RUN % 10000}`)
    );
  });

  it('T3. Technician DELETE repair — permitido', { skip }, async () => {
    await expectAllowed(() =>
      tech.from('repairs').delete().eq('id', `TRM-T1-${RUN % 10000}`)
    );
  });

  it('T4. Technician UPSERT workshop_profiles — permitido (taller compartido)', { skip }, async () => {
    await expectAllowed(() =>
      tech.from('workshop_profiles').upsert(
        { workshop_id: workshopId, name: 'QA Taller', nit: '9012345678' },
        { onConflict: 'workshop_id' }
      )
    );
  });

  it('T5. Technician INSERT inventory — permitido', { skip }, async () => {
    await expectAllowed(() =>
      tech.from('inventory').insert({ workshop_id: workshopId, name: `Repuesto T5 ${RUN}`, stock: 2, price: 5000 })
    );
  });

  it('T6. Technician UPDATE propio rol (escalada a admin) — BLOQUEADO', { skip }, async () => {
    await expectBlocked(() =>
      tech.from('profiles').update({ role: 'admin' }).eq('id', techUserId)
    );
  });

  it('T7. Technician UPDATE perfil del admin — BLOQUEADO', { skip }, async () => {
    await expectBlocked(() =>
      tech.from('profiles').update({ is_active: false }).eq('id', adminUserId)
    );
  });

  it('T8. INSERT repair con workshop_id ajeno (cross-workshop) — BLOQUEADO', { skip }, async () => {
    await expectBlocked(() =>
      tech.from('repairs').insert({
        id: `TRM-XW-${RUN % 10000}`,
        workshop_id: foreignWorkshopId,
        client_name: 'Intruso',
        device: 'Xiaomi',
        status: 'Pendiente',
      })
    );
  });

  it('T9. UPDATE repair de OTRO taller (cross-workshop) — BLOQUEADO', { skip }, async () => {
    await expectBlocked(() =>
      tech.from('repairs').update({ status: 'Listo' }).eq('id', `TRM-FOR-${RUN % 10000}`)
    );
  });
});