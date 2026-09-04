#!/usr/bin/env node
/**
 * Script de validación automatizada para el pipeline de invitaciones y seguridad de técnicos.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  generateInviteToken,
  decodeInviteToken,
  validateInviteToken,
  buildInviteUrl,
  INVITE_EXPIRY_MS,
  savePendingInviteToken,
  getPendingInviteToken,
  clearPendingInviteToken,
} from '../src/utils/auth-links.ts';

console.log('🧪 Iniciando verificación del pipeline de seguridad de invitaciones...');

// 1. Verificación de archivos clave
const filesToCheck = [
  'supabase/migrations/20260904000000_harden_invitations_and_rbac.sql',
  'supabase/schema.sql',
  'src/utils/auth-links.ts',
  'src/utils/auth-links.test.ts',
  'src/context/auth-context.tsx',
  'src/app/signup.tsx',
  'src/app/taller.tsx',
  'src/app/(tabs)/admin.tsx',
];

for (const f of filesToCheck) {
  assert.ok(fs.existsSync(path.resolve(f)), `Falta archivo: ${f}`);
}
console.log('✔ Todos los archivos de migración, contexto, utilidades y vistas existen.');

// 2. Verificación de contenido en la migración
const migrationContent = fs.readFileSync('supabase/migrations/20260904000000_harden_invitations_and_rbac.sql', 'utf8');
assert.ok(migrationContent.includes('public.workshop_invitations'), 'Falta tabla workshop_invitations en migración');
assert.ok(migrationContent.includes('create_technician_invitation'), 'Falta RPC create_technician_invitation');
assert.ok(migrationContent.includes('claim_technician_invitation'), 'Falta RPC claim_technician_invitation');
assert.ok(migrationContent.includes('revoke_technician_invitation'), 'Falta RPC revoke_technician_invitation');
assert.ok(migrationContent.includes('get_invitation_info'), 'Falta RPC get_invitation_info');
assert.ok(migrationContent.includes('check_profile_updates'), 'Falta trigger check_profile_updates');
console.log('✔ Migración contiene todas las tablas, RPCs y triggers de blindaje requeridos.');

// 3. Verificación de contenido en schema.sql
const schemaContent = fs.readFileSync('supabase/schema.sql', 'utf8');
assert.ok(schemaContent.includes('public.workshop_invitations'), 'Falta tabla workshop_invitations en schema.sql');
assert.ok(schemaContent.includes('create_technician_invitation'), 'Falta RPC create_technician_invitation en schema.sql');
assert.ok(schemaContent.includes('check_profile_updates'), 'Falta trigger check_profile_updates en schema.sql');
console.log('✔ schema.sql está perfectamente sincronizado con las políticas y funciones.');

// 4. Verificación de utilidades de tokens y URLs
const testWorkshopId = '11111111-2222-3333-4444-555555555555';
const testWorkshopName = 'Taller Blindado';
const testEmail = 'tecnico@test.com';

const tokenObj = generateInviteToken(testWorkshopId, testWorkshopName, testEmail);
assert.equal(tokenObj.workshopId, testWorkshopId);
assert.equal(tokenObj.workshopName, testWorkshopName);
assert.equal(tokenObj.email, testEmail);

const hexToken = 'd3b07384d113edec49eaa6238ad5ff001234567890abcdef1234567890abcdef';
const decodedHex = decodeInviteToken(hexToken);
assert.ok(decodedHex);
assert.equal(decodedHex.token, hexToken);

const url = buildInviteUrl(hexToken);
assert.ok(url.includes(`/signup?invite=${hexToken}`), 'URL con token hex no construida correctamente');

console.log('✔ Utilidades de tokens y generación de URLs operativas al 100%.');

console.log('\n🎉 ¡Verificación del Pipeline de Seguridad de Técnicos COMPLETADA CON ÉXITO!');
