// scripts/keep-alive.mjs — Ping ligero para evitar pausa por inactividad (Supabase Free).
// Uso local:  node scripts/keep-alive.mjs   (lee .env.local)
// Uso CI:     SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY como secrets.
// No requiere dependencias: usa fetch nativo (Node 18+).

import fs from 'node:fs';
import path from 'node:path';

// 1) Cargar .env.local solo en local (en CI ya vienen por env).
try {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath) && !process.env.SUPABASE_URL) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^"|"$/g, '');
      if (!(k in process.env)) process.env[k] = v;
    }
  }
} catch {
  // sin .env.local → sigue con env del sistema
}

const url =
  process.env.SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

if (!url.startsWith('http')) {
  console.error('❌ Falta SUPABASE_URL (o EXPO_PUBLIC_SUPABASE_URL).');
  process.exit(1);
}
if (!key) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY (o ANON KEY).');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

async function ping(name, target, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(target, { headers, signal: ctrl.signal });
    const body = (await res.text()).slice(0, 300);
    console.log(`${res.ok ? '✅' : '⚠️'} ${name}: HTTP ${res.status} — ${body}`);
    return res.ok;
  } catch (e) {
    console.error(`❌ ${name} falló:`, e?.message ?? e);
    return false;
  } finally {
    clearTimeout(t);
  }
}

const okAuth = await ping('auth/health', `${url}/auth/v1/health`);
const okRest = await ping(
  'rest/workshops?limit=1',
  `${url}/rest/v1/workshops?select=id&limit=1`
);

if (!okAuth && !okRest) {
  console.error('❌ Keep-alive falló en ambos endpoints.');
  process.exit(1);
}
console.log('✅ Keep-alive OK — proyecto activo.');
