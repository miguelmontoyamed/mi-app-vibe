import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatNit, isValidNit, nitCheckDigit, normalizeNit } from './nit.ts';

describe('nitCheckDigit (módulo 11 DIAN)', () => {
  it('calcula el DV correcto para un NIT conocido (800197268 → 4)', () => {
    assert.equal(nitCheckDigit('800197268'), 4);
  });
  it('devuelve 0 cuando el residuo es 0 (DV = 11 → 0)', () => {
    assert.equal(nitCheckDigit('100000001'), 0);
  });
  it('devuelve 1 cuando el residuo es 10 (DV = 10 → 1)', () => {
    assert.equal(nitCheckDigit('100000005'), 1);
  });
});

describe('isValidNit', () => {
  it('acepta un NIT con DV correcto, con o sin separadores', () => {
    assert.equal(isValidNit('800197268-4'), true);
    assert.equal(isValidNit('800.197.268-4'), true);
    assert.equal(isValidNit('8001972684'), true);
  });
  it('acepta los casos límite del DV (0 y 1)', () => {
    assert.equal(isValidNit('100000001-0'), true);
    assert.equal(isValidNit('100000005-1'), true);
  });
  it('rechaza un DV incorrecto', () => {
    assert.equal(isValidNit('800197268-5'), false);
    assert.equal(isValidNit('800.197.268-3'), false);
  });
  it('rechaza longitudes distintas a 10 dígitos', () => {
    assert.equal(isValidNit('80019726-4'), false); // 8 dígitos base
    assert.equal(isValidNit('8001972684-4'), false); // 10 dígitos base
    assert.equal(isValidNit(''), false);
  });
  it('rechaza caracteres no numéricos', () => {
    assert.equal(isValidNit('80019726A-4'), false);
    assert.equal(isValidNit('800197268-'), false);
  });
});

describe('normalizeNit', () => {
  it('quita puntos, espacios y guiones', () => {
    assert.equal(normalizeNit('800.197.268-4'), '8001972684');
    assert.equal(normalizeNit('800 197 268 4'), '8001972684');
  });
});

describe('formatNit', () => {
  it('formatea como 999.999.999-9', () => {
    assert.equal(formatNit('8001972684'), '800.197.268-4');
    assert.equal(formatNit('800.197.268-4'), '800.197.268-4');
  });
  it('devuelve el valor original si no tiene 10 dígitos', () => {
    assert.equal(formatNit('123'), '123');
  });
});