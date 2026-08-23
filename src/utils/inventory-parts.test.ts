import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hasAvailableStock,
  calculateRemainingStock,
  calculateRestoredStock,
  calculatePartsCost,
  filterInventoryParts,
  type InventoryItemLike,
} from './inventory-parts.ts';

describe('hasAvailableStock', () => {
  it('permite uso cuando el stock es mayor o igual a la cantidad', () => {
    assert.equal(hasAvailableStock(5, 1), true);
    assert.equal(hasAvailableStock(2, 2), true);
  });

  it('rechaza cuando el stock es menor que la cantidad solicitada', () => {
    assert.equal(hasAvailableStock(1, 2), false);
    assert.equal(hasAvailableStock(0, 1), false);
  });

  it('rechaza cantidades menores o iguales a cero o no numéricas', () => {
    assert.equal(hasAvailableStock(5, 0), false);
    assert.equal(hasAvailableStock(5, -1), false);
    assert.equal(hasAvailableStock(NaN, 1), false);
  });
});

describe('calculateRemainingStock', () => {
  it('descuenta correctamente la cantidad requerida', () => {
    assert.equal(calculateRemainingStock(10, 3), 7);
    assert.equal(calculateRemainingStock(1, 1), 0);
  });

  it('nunca devuelve valores negativos', () => {
    assert.equal(calculateRemainingStock(2, 5), 0);
    assert.equal(calculateRemainingStock(0, 1), 0);
  });
});

describe('calculateRestoredStock', () => {
  it('reintegra correctamente la cantidad devuelta al stock', () => {
    assert.equal(calculateRestoredStock(5, 2), 7);
    assert.equal(calculateRestoredStock(0, 1), 1);
  });
});

describe('calculatePartsCost', () => {
  it('calcula precio base por cantidad', () => {
    assert.equal(calculatePartsCost(50000, 2), 100000);
    assert.equal(calculatePartsCost(120000, 1), 120000);
  });

  it('respeta el precio unitario personalizado si se proporciona', () => {
    assert.equal(calculatePartsCost(50000, 2, 45000), 90000);
    assert.equal(calculatePartsCost(50000, 1, 0), 0);
  });
});

describe('filterInventoryParts', () => {
  const sampleParts: InventoryItemLike[] = [
    { id: '1', name: 'Pantalla OLED iPhone 11', category: 'Pantallas', stock: 4, price: 150000 },
    { id: '2', name: 'Batería Samsung A51', category: 'Baterías', stock: 2, price: 60000 },
    { id: '3', name: 'Pin de Carga Moto G8', category: 'Puertos', stock: 10, price: 25000 },
  ];

  it('devuelve todas las piezas con query vacía', () => {
    assert.equal(filterInventoryParts(sampleParts, '').length, 3);
  });

  it('filtra por coincidencia de nombre', () => {
    const result = filterInventoryParts(sampleParts, 'iphone');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, '1');
  });

  it('filtra por coincidencia de categoría', () => {
    const result = filterInventoryParts(sampleParts, 'baterías');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, '2');
  });
});
