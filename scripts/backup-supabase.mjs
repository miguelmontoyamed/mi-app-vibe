#!/usr/bin/env node
/**
 * Backup Automático Supabase - TechRepair Master
 * 
 * Soporta dos modalidades:
 * 1. Base de datos completa vía pg_dump: requiere DATABASE_URL, SUPABASE_DB_URL o SUPABASE_DB_PASSWORD.
 * 2. Exportación de datos vía Supabase REST API (PostgREST): usa SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL.
 * 
 * Uso:
 *   node scripts/backup-supabase.mjs
 *   node scripts/backup-supabase.mjs --conn "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import zlib from "zlib";

// Cargar variables de .env.local si existe
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^[\"']|[\"']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Argumentos CLI
const args = process.argv.slice(2);
let cliConn = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--conn" && args[i + 1]) {
    cliConn = args[i + 1];
  }
}

// ===== CONFIGURACIÓN DINÁMICA =====
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
let derivedProjectRef = "";
if (SUPABASE_URL) {
  try {
    derivedProjectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {}
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || derivedProjectRef || "";
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || "30", 10);
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || "";
const DATABASE_URL = cliConn || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";

// Asegurar directorio de backup
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Rotación: eliminar backups antiguos
const files = fs.readdirSync(BACKUP_DIR)
  .filter((f) => f.endsWith(".sql.gz") || f.endsWith(".json.gz"))
  .sort();

for (let i = 0; i < files.length - MAX_BACKUPS; i++) {
  const oldFile = path.join(BACKUP_DIR, files[i]);
  try {
    fs.unlinkSync(oldFile);
  } catch {}
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");

async function runApiBackup() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Se requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para backup vía REST API.");
  }

  console.log("🔄 Iniciando backup vía Supabase REST API...");
  console.log("📁 Directorio destino: " + BACKUP_DIR);

  const tables = [
    "workshops",
    "profiles",
    "workshop_invitations",
    "repairs",
    "inventory",
    "workshop_profiles",
  ];

  const backupData = {
    project: PROJECT_REF,
    timestamp: new Date().toISOString(),
    tables: {},
  };

  for (const table of tables) {
    const url = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + table + "?select=*";
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: "Bearer " + SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) {
      console.warn("⚠️  Tabla \"" + table + "\" no accesible o vacía (status " + res.status + ").");
      backupData.tables[table] = [];
    } else {
      const rows = await res.json();
      backupData.tables[table] = rows;
      console.log("   ✔ " + table + ": " + rows.length + " registros exportados.");
    }
  }

  const jsonContent = JSON.stringify(backupData, null, 2);
  const compressed = zlib.gzipSync(Buffer.from(jsonContent, "utf8"));
  const backupPath = path.join(BACKUP_DIR, "backup-" + timestamp + ".json.gz");

  fs.writeFileSync(backupPath, compressed);
  const size = fs.statSync(backupPath).size;
  console.log("✅ Backup REST API completado exitosamente: " + backupPath);
  console.log("   Tamaño comprimido: " + (size / 1024).toFixed(2) + " KB");
}

async function runPgDumpBackup(connStr) {
  console.log("🔄 Iniciando backup con pg_dump...");
  const backupPath = path.join(BACKUP_DIR, "backup-" + timestamp + ".sql.gz");

  let dumpCmd = "";
  if (connStr) {
    dumpCmd = "pg_dump \"" + connStr + "\" --data-only --no-owner --no-acl | gzip > \"" + backupPath + "\"";
  } else {
    if (!PROJECT_REF || !DB_PASSWORD) {
      throw new Error("Falta PROJECT_REF o SUPABASE_DB_PASSWORD para conexión pg_dump.");
    }
    dumpCmd = "PGPASSWORD=\"" + DB_PASSWORD + "\" pg_dump --host db." + PROJECT_REF + ".supabase.co --port 5432 --username postgres --dbname postgres --data-only --no-owner --no-acl | gzip > \"" + backupPath + "\"";
  }

  execSync(dumpCmd, { stdio: "pipe" });
  const size = fs.statSync(backupPath).size;
  console.log("✅ Backup pg_dump completado exitosamente: " + backupPath);
  console.log("   Tamaño comprimido: " + (size / 1024).toFixed(2) + " KB");
}

async function main() {
  try {
    if (DATABASE_URL) {
      await runPgDumpBackup(DATABASE_URL);
    } else if (DB_PASSWORD && PROJECT_REF) {
      try {
        await runPgDumpBackup(null);
      } catch (err) {
        console.warn("⚠️  Fallo pg_dump (" + err.message + "). Cambiando a backup vía REST API...");
        await runApiBackup();
      }
    } else if (SERVICE_ROLE_KEY && SUPABASE_URL) {
      await runApiBackup();
    } else {
      console.error("❌ Error: No se encontraron credenciales suficientes para el backup.");
      console.error("   Proporciona DATABASE_URL, SUPABASE_DB_PASSWORD o SUPABASE_SERVICE_ROLE_KEY.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error fatal en backup: " + error.message);
    process.exit(1);
  }
}

main();
