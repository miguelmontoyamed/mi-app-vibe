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
  it('calcula el DV correcto para una base corta de 8 dígitos (79403529 → 1)', () => {
    // pesos derecha→izquierda [3,7,13,17,19,23,29,37]: suma 769 → residuo 10 → DV 1
    assert.equal(nitCheckDigit('79403529'), 1);
  });
  it('calcula el DV correcto para una base larga de 13 dígitos (1234567890123 → 8)', () => {
    // pesos hasta 59: suma 1499 → residuo 3 → DV 8
    assert.equal(nitCheckDigit('1234567890123'), 8);
  });
});

describe('isValidNit', () => {
  it('acepta un NIT de 9 dígitos base con DV correcto, con o sin separadores', () => {
    assert.equal(isValidNit('800197268-4'), true);
    assert.equal(isValidNit('800.197.268-4'), true);
    assert.equal(isValidNit('8001972684'), true);
  });
  it('acepta los casos límite del DV (0 y 1)', () => {
    assert.equal(isValidNit('100000001-0'), true);
    assert.equal(isValidNit('100000005-1'), true);
  });
  it('acepta bases MÁS CORTAS de 9 dígitos (personas naturales)', () => {
    assert.equal(isValidNit('79403529-1'), true); // 8 dígitos base
    assert.equal(isValidNit('79.403.529-1'), true);
    assert.equal(isValidNit('794035291'), true);
  });
  it('acepta bases MÁS LARGAS de 9 dígitos', () => {
    assert.equal(isValidNit('1234567890123-8'), true); // 13 dígitos base
    assert.equal(isValidNit('1.234.567.890.123-8'), true);
    assert.equal(isValidNit('12345678901238'), true);
  });
  it('rechaza un DV incorrecto', () => {
    assert.equal(isValidNit('800197268-5'), false);
    assert.equal(isValidNit('800.197.268-3'), false);
    assert.equal(isValidNit('79403529-2'), false);
    assert.equal(isValidNit('1234567890123-7'), false);
  });
  it('rechaza cadenas vacías o sin dígito de verificación', () => {
    assert.equal(isValidNit(''), false);
    assert.equal(isValidNit('800197268-'), false);
  });
  it('rechaza caracteres no numéricos', () => {
    assert.equal(isValidNit('80019726A-4'), false);
  });
});

describe('normalizeNit', () => {
  it('quita puntos, espacios y guiones', () => {
    assert.equal(normalizeNit('800.197.268-4'), '8001972684');
    assert.equal(normalizeNit('800 197 268 4'), '8001972684');
    assert.equal(normalizeNit('79.403.529-1'), '794035291');
  });
});

describe('formatNit', () => {
  it('formatea la longitud clásica como 999.999.999-9', () => {
    assert.equal(formatNit('8001972684'), '800.197.268-4');
    assert.equal(formatNit('800.197.268-4'), '800.197.268-4');
  });
  it('agrupa de a 3 desde la derecha en bases cortas', () => {
    assert.equal(formatNit('794035291'), '79.403.529-1');
  });
  it('agrupa de a 3 desde la derecha en bases largas', () => {
    assert.equal(formatNit('12345678901238'), '1.234.567.890.123-8');
  });
  it('formatea cualquier cadena con forma de base+DV sin validar el DV', () => {
    assert.equal(formatNit('123'), '12-3'); // 2 base + DV: forma válida, DV no verificado
  });
  it('devuelve el valor original si no tiene la estructura mínima', () => {
    assert.equal(formatNit('abc'), 'abc');
    assert.equal(formatNit('5'), '5'); // un solo dígito: ni base ni DV
  });
});
