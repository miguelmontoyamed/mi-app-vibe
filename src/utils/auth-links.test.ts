import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  generateInviteToken,
  encodeInviteToken,
  decodeInviteToken,
  validateInviteToken,
  buildInviteUrl,
  INVITE_EXPIRY_MS,
  type InviteToken,
} from './auth-links.ts';

describe('auth-links utils', () => {
  const workshopId = 'a5d7e033-0f60-4ce3-8d16-4ca6f20359ad';
  const workshopName = 'Taller Central';

  it('debe generar un InviteToken con formato válido y expiración de 10 minutos', () => {
    const before = Date.now();
    const token = generateInviteToken(workshopId, workshopName);
    const after = Date.now();

    assert.strictEqual(token.workshopId, workshopId);
    assert.strictEqual(token.workshopName, workshopName);
    assert.strictEqual(typeof token.token, 'string');
    assert.strictEqual(token.token.length, 16);
    assert.ok(token.createdAt >= before && token.createdAt <= after);
    assert.strictEqual(token.expiresAt, token.createdAt + INVITE_EXPIRY_MS);
  });

  it('debe codificar y decodificar el token sin pérdida de datos', () => {
    const token = generateInviteToken(workshopId, workshopName);
    const encoded = encodeInviteToken(token);
    const decoded = decodeInviteToken(encoded);

    assert.deepStrictEqual(decoded, token);
  });

  it('debe manejar decodificación con caracteres especiales en el nombre del taller', () => {
    const specialToken = generateInviteToken(workshopId, 'Taller 100% Electrónica & Más');
    const encoded = encodeInviteToken(specialToken);
    const decoded = decodeInviteToken(encoded);

    assert.deepStrictEqual(decoded, specialToken);
  });

  it('debe retornar null al decodificar un token malformado o JSON inválido', () => {
    assert.strictEqual(decodeInviteToken('not-a-token'), null);
    assert.strictEqual(decodeInviteToken('{"invalid": true}'), null);
  });

  it('debe validar un token vigente correctamente', () => {
    const token = generateInviteToken(workshopId, workshopName);
    const validation = validateInviteToken(token);

    assert.strictEqual(validation.valid, true);
    if (validation.valid) {
      assert.strictEqual(validation.workshopId, workshopId);
      assert.strictEqual(validation.workshopName, workshopName);
    }
  });

  it('debe marcar como expirado un token con timestamp vencido', () => {
    const expiredToken: InviteToken = {
      token: '1234567890ABCDEF',
      workshopId,
      workshopName,
      createdAt: Date.now() - 20 * 60 * 1000,
      expiresAt: Date.now() - 5 * 60 * 1000, // 5 min atrás
    };

    const validation = validateInviteToken(expiredToken);
    assert.strictEqual(validation.valid, false);
    if (!validation.valid) {
      assert.strictEqual(validation.reason, 'expired');
    }
  });

  it('debe construir la URL de invitación adecuada', () => {
    const token = generateInviteToken(workshopId, workshopName);
    const url = buildInviteUrl(token);

    assert.ok(url.includes('/signup?invite='));
    assert.ok(url.includes(token.workshopId) || url.includes(encodeURIComponent(token.workshopId)));
  });
});
