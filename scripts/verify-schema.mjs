#!/usr/bin/env node
/**
 * verify-schema.mjs — Guard de esquema TechRepair Master (Capa 2)
 *
 * Compara el esquema ACTIVO en Supabase contra `supabase/schema.sql` y
 * falla (exit 1) si hay drift: tablas, columnas, tipos, funciones RPC,
 * triggers e índices que difieran o falten.
 *
 * Autenticación (en orden):
 *   1. env SUPABASE_ACCESS_TOKEN  (PAT del CLI, ideal para CI)
 *   2. Windows Credential Manager "Supabase CLI:supabase" (dev local)
 *
 * Proyecto: env SUPABASE_PROJECT_REF, o se deriva de EXPO_PUBLIC_SUPABASE_URL.
 *
 * Uso:
 *   node scripts/verify-schema.mjs
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/verify-schema.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_FILE = join(ROOT, 'supabase', 'schema.sql');

// ──────────────────────────────────────────────────────────────────────────
// 1) Cargar .env (EXPO_PUBLIC_SUPABASE_URL) para derivar el project ref
// ──────────────────────────────────────────────────────────────────────────
function loadDotEnv(file) {
  try {
    const raw = readFileSync(file, 'utf8');
    const vars = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return vars;
  } catch {
    return {};
  }
}

const dotEnv = loadDotEnv(join(ROOT, '.env'));

function getProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || dotEnv.EXPO_PUBLIC_SUPABASE_URL || '';
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) throw new Error('No se pudo derivar SUPABASE_PROJECT_REF. Define SUPABASE_PROJECT_REF o EXPO_PUBLIC_SUPABASE_URL.');
  return m[1];
}

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  // Fallback Windows: Credential Manager del Supabase CLI.
  if (process.platform === 'win32') {
    try {
      const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class CredMan {
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
  [StructLayout(LayoutKind.Sequential)]
  struct CREDENTIAL { public int Flags; public int Type; public IntPtr TargetName; public IntPtr Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist; public int AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName; }
  public static string Read(string target) {
    IntPtr p;
    if (!CredRead(target, 1, 0, out p)) return null;
    CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    byte[] bytes = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, bytes, 0, c.CredentialBlobSize);
    Marshal.FreeCoTaskMem(p);
    return Encoding.UTF8.GetString(bytes);
  }
}
"@
[CredMan]::Read("Supabase CLI:supabase")`;
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
        encoding: 'utf8',
        timeout: 15000,
      }).trim();
      if (out) return out;
    } catch {
      /* sigue al siguiente fallback */
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// 2) Parser de supabase/schema.sql → manifiesto esperado
// ──────────────────────────────────────────────────────────────────────────
const TYPE_MAP = {
  uuid: 'uuid',
  text: 'text',
  timestamptz: 'timestamp with time zone',
  timestamp: 'timestamp without time zone',
  numeric: 'numeric',
  boolean: 'boolean',
  int: 'integer',
  date: 'date',
};

function parseType(raw) {
  const t = (raw || '').trim().toLowerCase();
  return TYPE_MAP[t] ?? t;
}

/**
 * Extrae el manifiesto del schema.sql:
 *   tables:      Map<table, Set<column>>
 *   functions:   Set<name>
 *   triggers:    Set<"table:trigger">
 *   indexes:     Set<name>
 */
function parseSchema(sql) {
  const tables = new Map();
  const functions = new Set();
  const triggers = new Set();
  const indexes = new Set();

  // create table if not exists public.X ( ... );
  const tableRe = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  let m;
  while ((m = tableRe.exec(sql)) !== null) {
    const [, name, body] = m;
    const cols = new Set();
    for (const line of body.split(/\r?\n/)) {
      const cm = line.match(/^\s{2}(\w+)\s+([\w ]+?)(?:\s+(?:primary|references|not|null|default|unique|check)|,|$)/);
      if (cm && !/^(constraint|primary|foreign|unique|check)\b/i.test(line.trim())) {
        cols.add(`${cm[1]}:${parseType(cm[2])}`);
      }
    }
    tables.set(name, cols);
  }

  // alter table public.X add column if not exists Y TYPE ...
  const alterRe = /alter table public\.(\w+)\s+add column if not exists\s+(\w+)\s+([\w ]+?)(?:\s+(?:not|null|default|check|,)|;)/g;
  while ((m = alterRe.exec(sql)) !== null) {
    const [, table, col, type] = m;
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table).add(`${col}:${parseType(type)}`);
  }

  // create or replace function public.X
  const fnRe = /create or replace function public\.(\w+)/g;
  while ((m = fnRe.exec(sql)) !== null) functions.add(m[1]);

  // create trigger X ... on public.Y | on auth.users
  const trgRe = /create trigger (\w+)[\s\S]*?\bon (public|auth)\.(\w+)/g;
  while ((m = trgRe.exec(sql)) !== null) triggers.add(`${m[3]}:${m[1]}`);

  // create index if not exists X
  const idxRe = /create index if not exists (\w+)/g;
  while ((m = idxRe.exec(sql)) !== null) indexes.add(m[1]);

  return { tables, functions, triggers, indexes };
}

// ──────────────────────────────────────────────────────────────────────────
// 3) Consultas live vía Management API (database/query)
// ──────────────────────────────────────────────────────────────────────────
async function runQuery(token, ref, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Management API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchLive(token, ref) {
  const [tables, columns, functions, triggers, indexes] = await Promise.all([
    runQuery(token, ref, `select table_name from information_schema.tables where table_schema = 'public'`),
    runQuery(token, ref, `select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'`),
    runQuery(token, ref, `select routine_name from information_schema.routines where routine_schema = 'public'`),
    runQuery(token, ref, `select event_object_table, trigger_name from information_schema.triggers where trigger_schema in ('public','auth')`),
    runQuery(token, ref, `select indexname from pg_indexes where schemaname = 'public'`),
  ]);

  const liveTables = new Map(); // table -> Set<"col:type">
  for (const r of tables ?? []) liveTables.set(r.table_name, new Set());
  for (const r of columns ?? []) {
    if (!liveTables.has(r.table_name)) liveTables.set(r.table_name, new Set());
    liveTables.get(r.table_name).add(`${r.column_name}:${r.data_type}`);
  }

  // Los índices *_pkey / *_key los genera Postgres automáticamente a partir de
  // las constraints PRIMARY KEY / UNIQUE de schema.sql: NO son drift.
  const realIndexes = new Set(
    (indexes ?? [])
      .map((r) => r.indexname)
      .filter((name) => !/_pkey$/.test(name) && !/_(key)$/.test(name))
  );

  return {
    tables: liveTables,
    functions: new Set((functions ?? []).map((r) => r.routine_name)),
    triggers: new Set((triggers ?? []).map((r) => `${r.event_object_table}:${r.trigger_name}`)),
    indexes: realIndexes,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4) Comparación y reporte
// ──────────────────────────────────────────────────────────────────────────
function diff(expected, live, kind) {
  const rows = [];
  for (const item of expected) {
    if (!live.has(item)) rows.push({ kind, item, status: 'FALTA en BD' });
  }
  for (const item of live) {
    if (!expected.has(item)) rows.push({ kind, item, status: 'EXTRA en BD' });
  }
  return rows;
}

function diffTables(expected, live) {
  const rows = [];
  for (const [table, cols] of expected) {
    if (!live.has(table)) {
      rows.push({ kind: 'tabla', item: table, status: 'FALTA en BD' });
      continue;
    }
    for (const col of cols) {
      if (!live.get(table).has(col)) {
        rows.push({ kind: `columna ${table}`, item: col, status: 'FALTA/DIFF en BD' });
      }
    }
    for (const col of live.get(table)) {
      if (!cols.has(col)) {
        rows.push({ kind: `columna ${table}`, item: col, status: 'EXTRA en BD' });
      }
    }
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────
function printTable(rows) {
  if (rows.length === 0) return;
  const kindW = Math.max(...rows.map((r) => r.kind.length), 'Objeto'.length);
  const itemW = Math.max(...rows.map((r) => r.item.length), 'Elemento'.length);
  const statusW = Math.max(...rows.map((r) => r.status.length), 'Estado'.length);
  const sep = `+${'-'.repeat(kindW + 2)}+${'-'.repeat(itemW + 2)}+${'-'.repeat(statusW + 2)}+`;
  console.log(sep);
  console.log(
    `| ${'Objeto'.padEnd(kindW)} | ${'Elemento'.padEnd(itemW)} | ${'Estado'.padEnd(statusW)} |`
  );
  console.log(sep);
  for (const r of rows) {
    console.log(
      `| ${r.kind.padEnd(kindW)} | ${r.item.padEnd(itemW)} | ${r.status.padEnd(statusW)} |`
    );
  }
  console.log(sep);
}

async function main() {
  const sql = readFileSync(SCHEMA_FILE, 'utf8');
  const expected = parseSchema(sql);

  const token = getAccessToken();
  if (!token) {
    console.error('✖ No se encontró SUPABASE_ACCESS_TOKEN (env) ni credencial del CLI (Credential Manager).');
    console.error('  Exporta: SUPABASE_ACCESS_TOKEN=<tu PAT de supabase> y ejecuta de nuevo.');
    process.exit(1);
  }
  const ref = getProjectRef();

  console.log(`🔍 Verificando esquema de Supabase`);
  console.log(`   Proyecto: ${ref}`);
  console.log(`   Referencia: supabase/schema.sql`);
  console.log('');

  let live;
  try {
    live = await fetchLive(token, ref);
  } catch (err) {
    console.error(`✖ No se pudo consultar la BD: ${err.message}`);
    process.exit(1);
  }

  const rows = [
    ...diffTables(expected.tables, live.tables),
    ...diff(expected.functions, live.functions, 'función'),
    ...diff(expected.triggers, live.triggers, 'trigger'),
    ...diff(expected.indexes, live.indexes, 'índice'),
  ];

  if (rows.length === 0) {
    console.log('✔ Sin drift: el esquema activo coincide con supabase/schema.sql.');
    console.log(`   Tablas: ${expected.tables.size} | Funciones: ${expected.functions.size} | Triggers: ${expected.triggers.size} | Índices: ${expected.indexes.size}`);
    process.exit(0);
  }

  console.log(`✖ DRIFT DETECTADO (${rows.length} discrepancias):`);
  console.log('');
  printTable(rows);
  console.log('');
  console.log('  La BD real se alejó de supabase/schema.sql. Aplica las migraciones');
  console.log('  pendientes (Supabase > SQL Editor) o sincroniza schema.sql.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});