import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildPatternValue,
  buildPinValue,
  parseDeviceSecurity,
  parsePatternSequence,
  patternNodeCenters,
  patternSegments,
} from './device-security.ts';

describe('buildPatternValue (contrato S1)', () => {
  it('secuencia completa → "Patrón: 1-2-5-8-9"', () => {
    assert.equal(buildPatternValue([1, 2, 5, 8, 9]), 'Patrón: 1-2-5-8-9');
  });
  it('un solo nodo → "Patrón: 5"', () => {
    assert.equal(buildPatternValue([5]), 'Patrón: 5');
  });
  it('secuencia vacía → "" (sin clave)', () => {
    assert.equal(buildPatternValue([]), '');
  });
  it('descarta nodos fuera de 1..9', () => {
    assert.equal(buildPatternValue([0, 3, 10, 6]), 'Patrón: 3-6');
  });
});

describe('buildPinValue (contratos S2 y S3)', () => {
  it('solo dígitos → prefijo PIN (S2)', () => {
    assert.equal(buildPinValue('1235'), 'PIN: 1235');
  });
  it('mezcla con letras → prefijo Contraseña (S3)', () => {
    assert.equal(buildPinValue('miPass123'), 'Contraseña: miPass123');
  });
  it('texto vacío → "" (sin clave)', () => {
    assert.equal(buildPinValue('   '), '');
  });
});

describe('parseDeviceSecurity', () => {
  it('sin clave (S4): vacío y "No especificado" → none', () => {
    assert.deepEqual(parseDeviceSecurity(''), { kind: 'none', payload: '' });
    assert.deepEqual(parseDeviceSecurity('No especificado'), { kind: 'none', payload: '' });
    assert.deepEqual(parseDeviceSecurity(null), { kind: 'none', payload: '' });
    assert.deepEqual(parseDeviceSecurity(undefined), { kind: 'none', payload: '' });
  });

  it('prefill PIN (S5): "PIN: 1234" → pin con payload limpio', () => {
    assert.deepEqual(parseDeviceSecurity('PIN: 1234'), { kind: 'pin', payload: '1234' });
  });

  it('seeds legacy: "Pass: mac2026" → password; "Patrón: L" → pattern', () => {
    assert.deepEqual(parseDeviceSecurity('Pass: mac2026'), { kind: 'password', payload: 'mac2026' });
    assert.deepEqual(parseDeviceSecurity('Patrón: L'), { kind: 'pattern', payload: 'L' });
  });

  it('patrón nuevo completo', () => {
    const parsed = parseDeviceSecurity('Patrón: 1-2-3-5-9');
    assert.equal(parsed.kind, 'pattern');
    assert.deepEqual(parsePatternSequence(parsed.payload), [1, 2, 3, 5, 9]);
  });

  it('texto libre legacy se trata como contraseña legible', () => {
    assert.deepEqual(parseDeviceSecurity('clave detrás de la funda'), {
      kind: 'password',
      payload: 'clave detrás de la funda',
    });
  });

  it('roundtrip patrón: build → parse devuelve la misma secuencia', () => {
    const seq = [2, 4, 6, 8];
    const parsed = parseDeviceSecurity(buildPatternValue(seq));
    assert.equal(parsed.kind, 'pattern');
    assert.deepEqual(parsePatternSequence(parsed.payload), seq);
  });

  it('roundtrip PIN: build → parse devuelve el mismo dígito', () => {
    const parsed = parseDeviceSecurity(buildPinValue('987654'));
    assert.equal(parsed.kind, 'pin');
    assert.equal(parsed.payload, '987654');
  });
});

describe('geometría del patrón 3x3', () => {
  it('nodo 5 queda exactamente en el centro', () => {
    const centers = patternNodeCenters(216);
    assert.equal(centers[4].x, 108);
    assert.equal(centers[4].y, 108);
  });
  it('nodo 1 arriba-izquierda y nodo 9 abajo-derecha', () => {
    const centers = patternNodeCenters(216);
    assert.equal(centers[0].x, 36);
    assert.equal(centers[0].y, 36);
    assert.equal(centers[8].x, 180);
    assert.equal(centers[8].y, 180);
  });
  it('segmentos = secuencia.length - 1, con extremos correctos', () => {
    const segs = patternSegments([1, 5, 9], 216);
    assert.equal(segs.length, 2);
    assert.deepEqual(segs[0].from, { x: 36, y: 36 });
    assert.deepEqual(segs[0].to, { x: 108, y: 108 });
    assert.deepEqual(segs[1].to, { x: 180, y: 180 });
  });
  it('secuencia vacía → sin segmentos', () => {
    assert.equal(patternSegments([], 216).length, 0);
  });
});
