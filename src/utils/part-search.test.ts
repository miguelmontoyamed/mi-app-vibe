import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeSearchText,
  searchInventoryParts,
  matchInventoryPart,
  type PartSearchResultItem,
} from './part-search.ts';

const MOCK_INVENTORY: PartSearchResultItem[] = [
  { id: '1', name: 'Pantalla OLED iPhone 11', category: 'Pantallas', stock: 5, price: 180000 },
  { id: '2', name: 'Pantalla LCD iPhone XR', category: 'Pantallas', stock: 2, price: 140000 },
  { id: '3', name: 'Batería Original Samsung S21', category: 'Baterías', stock: 3, price: 95000 },
  { id: '4', name: 'Pin de Carga Tipo C Moto G8', category: 'Conectores', stock: 12, price: 25000 },
  { id: '5', name: 'Cámara Principal Xiaomi Redmi Note 10', category: 'Cámaras', stock: 1, price: 85000 },
  { id: '6', name: 'Tapa Trasera Cristal iPhone 12', category: 'Carcasas', stock: 0, price: 60000 },
];

describe('part-search utils', () => {
  describe('normalizeSearchText', () => {
    it('debe convertir a minúsculas y eliminar tildes', () => {
      assert.equal(normalizeSearchText('Batería Óptima'), 'bateria optima');
      assert.equal(normalizeSearchText('   CÁMARA TRASERA  '), 'camara trasera');
      assert.equal(normalizeSearchText('Pantalla OLED'), 'pantalla oled');
      assert.equal(normalizeSearchText(''), '');
    });
  });

  describe('searchInventoryParts', () => {
    it('debe devolver arreglo vacío si la consulta está vacía o son solo espacios', () => {
      assert.deepEqual(searchInventoryParts(MOCK_INVENTORY, ''), []);
      assert.deepEqual(searchInventoryParts(MOCK_INVENTORY, '   '), []);
    });

    it('debe encontrar piezas por coincidencia de nombre ignorando mayúsculas y tildes', () => {
      const results = searchInventoryParts(MOCK_INVENTORY, 'bateria');
      assert.equal(results.length, 1);
      assert.equal(results[0]?.name, 'Batería Original Samsung S21');
      assert.equal(results[0]?.price, 95000);
    });

    it('debe encontrar piezas por coincidencia de categoría', () => {
      const results = searchInventoryParts(MOCK_INVENTORY, 'pantallas');
      assert.equal(results.length, 2);
      assert.ok(results.some((r) => r.name.includes('iPhone 11')));
      assert.ok(results.some((r) => r.name.includes('iPhone XR')));
    });

    it('debe priorizar coincidencias que inician con el término buscado', () => {
      const results = searchInventoryParts(MOCK_INVENTORY, 'pantalla');
      assert.equal(results.length, 2);
      assert.ok(results[0]?.name.startsWith('Pantalla'));
      assert.ok(results[1]?.name.startsWith('Pantalla'));
    });

    it('debe respetar el límite máximo de resultados', () => {
      const results = searchInventoryParts(MOCK_INVENTORY, 'i', 2);
      assert.equal(results.length, 2);
    });

    it('debe manejar inventarios vacíos sin reventar', () => {
      assert.deepEqual(searchInventoryParts([], 'pantalla'), []);
    });
  });

  describe('matchInventoryPart', () => {
    it('debe encontrar una pieza por nombre exacto normalizado', () => {
      const match = matchInventoryPart(MOCK_INVENTORY, 'pantalla oled iphone 11');
      assert.ok(match);
      assert.equal(match.id, '1');
      assert.equal(match.price, 180000);
    });

    it('debe devolver undefined si no hay coincidencia exacta', () => {
      const match = matchInventoryPart(MOCK_INVENTORY, 'Pantalla Inexistente');
      assert.equal(match, undefined);
    });
  });
});
