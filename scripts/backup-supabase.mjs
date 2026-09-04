#!/usr/bin/env node
/**
 * Backup Automático Supabase - TechRepair Master
 * Usa el token service_role proporcionado para conexión segura.
 * 
 * Usado: node backup-supabase.mjs --conn "postgresql://..."
 * O mediante variables de entorno: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_REF
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ===== CONFIGURACIÓN =====
// El token JWT proporcionado tiene: ref=phmhlbodkoicjctlamah, role=service_role
// Estos datos ayudan a construir la conexión, pero se necesita la password/key.
// Se prefieren las variables de entorno para seguridad.

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'phmhlbodkoicjctlamah';
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || '/Users/user/TechRepairMaster/backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validaciones mínimas
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  console.error('   Este token se obtiene en: Supabase Dashboard → Settings → API');
  console.error('   O se deriva del JWT proporcionado (ref: phmhlbodkoicjctlamah)');
  process.exit(1);
}

// Asegurar directorio de backup
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Rotación: eliminar backups antiguos
const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz').sort();
for (let i = 0; i < files.length - MAX_BACKUPS; i++) {
  const oldFile = path.join(BACKUP_DIR, files[i]);
  if (oldFile) fs.unlinkSync(oldFile);
}

// Generar timestamp y filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '') + '.sql.gz';
const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

// Ejecutar pg_dump con compresión
try {
  console.log(`🔄 Iniciando backup de Supabase (proyecto: ${PROJECT_REF})...`);
  console.log(`📁 Directorio: ${BACKUP_DIR}`);
  console.log(`⏱️  Retención: ${MAX_BACKUPS} backups máximos`);
  
  // Construir comando pg_dump
  const pgDumpCmd = `
    pg_dump \
      --host db.${PROJECT_REF}.supabase.co \
      --port 5432 \
      --username postgres \
      --dbname postgres \
      --data-only \
      --no-owner \
      --no-acl \
      --serializable \
      | gzip > "${backupPath}"
  `;
  
  // Ejecutar con el service_role key pasando por STDIN o entorno
  // Nota: pg_dump lee la password de PGPASSWORD environment variable
  execSync(
    `PGPASSWORD="${SUPABASE_SERVICE_ROLE_KEY}" ${pgDumpCmd}`,
    { stdio: 'pipe' }
  );
  
  console.log(`✅ Backup completado: ${backupPath}`);
  console.log(`   Tamaño: $(wc -c < "${backupPath}" | numfmt --to=iec-iB)');
  
  // Verificación rápida: validar que el archivo no esté vacío
  if (fs.statSync(backupPath).size < 1024) {
    console.warn('⚠️  Advertencia: El backup parece muy pequeño (posible error).');
  }
  
} catch (error) {
  console.error('❌ Error durante el backup:');
  console.error(`   ${error.message}`);
  // Limpiar archivo parcial si existe
  try { fs.unlinkSync(backupPath); } catch {}
  process.exit(1);
}

// Generar reporte de checksum
const checksum = execSync(`sha256sum "${backupPath}"`, { encoding: 'utf8' }).split(' ')[0];
console.log(`🔐 Checksum SHA256: ${checksum}`);
console.log(`🕒 Finalizado: ${new Date().toISOString()}`);
</BACKUPSCRIPT
chmod +x /Users/user/TechRepairMaster/scripts/backup-supabase.mjs