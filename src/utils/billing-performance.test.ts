/**
 * Tests unitarios (node --test) de la lógica pura del panel de Liquidación
 * y Rendimiento Mensual por Técnico: `src/utils/billing-performance.ts`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAvailablePeriods,
  buildPeriodOptions,
  deliveryMonthOf,
  formatPeriodLabel,
  summarizePerformances,
  type PerformanceRepairLike,
} from './billing-performance.ts';
import type { TechnicianMonthlyPerformance } from '../types/billing.ts';

function repair(overrides: Partial<PerformanceRepairLike>): PerformanceRepairLike {
  return {
    status: 'Entregado',
    budget: 100000,
    date: '2026-08-01',
    ...overrides,
  };
}

describe('deliveryMonthOf', () => {
  it('usa deliveredAt como mes de entrega real', () => {
    const r = repair({ deliveredAt: '2026-07-31T22:10:00Z', date: '2026-06-15' });
    assert.equal(deliveryMonthOf(r), '2026-07');
  });

  it('cae a la fecha de la orden en legacy sin deliveredAt', () => {
    const r = repair({ date: '2026-05-20' });
    assert.equal(deliveryMonthOf(r), '2026-05');
  });

  it('devuelve null para órdenes no entregadas', () => {
    assert.equal(deliveryMonthOf(repair({ status: 'En Proceso' })), null);
    assert.equal(deliveryMonthOf(repair({ status: 'Cancelado / No Reparado' })), null);
  });
});

describe('buildAvailablePeriods', () => {
  it('une mes actual + cierres + entregas, ordenado descendente y sin duplicados', () => {
    const periods = buildAvailablePeriods('2026-08', ['2026-07', '2026-06'], [
      repair({ deliveredAt: '2026-08-02T12:00:00Z' }),
      repair({ date: '2026-05-11' }),
    ]);
    assert.deepEqual(periods, ['2026-08', '2026-07', '2026-06', '2026-05']);
  });

  it('ignora periodos con formato inválido', () => {
    const periods = buildAvailablePeriods('agosto', ['20260801'], []);
    assert.deepEqual(periods, []);
  });
});

describe('buildPeriodOptions', () => {
  it('marca el mes en curso y etiqueta los archivados', () => {
    const options = buildPeriodOptions('2026-08', ['2026-07'], []);
    assert.deepEqual(options, [
      { period: '2026-08', label: 'Agosto 2026', isCurrent: true },
      { period: '2026-07', label: 'Julio 2026', isCurrent: false },
    ]);
  });
});

describe('formatPeriodLabel', () => {
  it('formatea meses en español', () => {
    assert.equal(formatPeriodLabel('2026-01'), 'Enero 2026');
    assert.equal(formatPeriodLabel('2025-12'), 'Diciembre 2025');
  });

  it('devuelve el periodo crudo si el formato es inválido', () => {
    assert.equal(formatPeriodLabel('sin-formato'), 'sin-formato');
  });
});

describe('summarizePerformances', () => {
  const tech = (
    name: string,
    netProduction: number,
    revenue: number,
    parts: number,
    commission: number
  ): TechnicianMonthlyPerformance => ({
    technicianId: `id-${name}`,
    technicianName: name,
    commissionRate: 0.3,
    deliveredCount: 2,
    totalRevenue: revenue,
    totalPartsCost: parts,
    netProduction,
    commissionTotal: commission,
    workshopNetProfit: netProduction - commission,
  });

  it('agrega totales globales y utilidad neta del taller', () => {
    const summary = summarizePerformances('2026-08', false, [
      tech('Ana', 70000, 100000, 30000, 21000),
      tech('Luis', 50000, 60000, 10000, 15000),
    ]);
    assert.equal(summary.totalRevenue, 160000);
    assert.equal(summary.totalPartsCost, 40000);
    assert.equal(summary.totalCommissions, 36000);
    assert.equal(summary.workshopNetProfit, 84000);
    assert.equal(summary.isArchived, false);
  });

  it('ordena técnicos por producción neta descendente', () => {
    const summary = summarizePerformances('2026-08', true, [
      tech('Bajo', 10000, 20000, 10000, 3000),
      tech('Alto', 90000, 95000, 5000, 27000),
    ]);
    assert.deepEqual(
      summary.technicians.map((t) => t.technicianName),
      ['Alto', 'Bajo']
    );
  });
});
