import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CANCELLATION_REASONS,
  PAYMENT_METHODS,
  accumulatedProfit,
  applyPayment,
  commissionForRepair,
  hasActiveRepairs,
  isAssignedToTechnician,
  isValidCancellation,
  canCancel,
  profitForRepair,
  type RepairLike,
  type ViewUser,
  visibleRepairs,
} from './repair-logic.ts';

function testRepair(overrides: Partial<RepairLike>): RepairLike {
  return {
    id: 'r1',
    status: 'Pendiente',
    budget: 100000,
    ...overrides,
  };
}

function technicianUser(id: string, name: string): ViewUser {
  return { id, name, role: 'technician' };
}

describe('PAYMENT_METHODS', () => {
  it('limita los métodos de pago a Efectivo, Transferencia y Tarjeta', () => {
    assert.deepEqual(PAYMENT_METHODS, ['Efectivo', 'Transferencia', 'Tarjeta']);
  });
});

describe('CANCELLATION_REASONS', () => {
  it('contiene exactamente los 4 motivos de cancelación obligatorios', () => {
    assert.deepEqual(CANCELLATION_REASONS, [
      'Fuera de presupuesto',
      'Sin reparación',
      'Repuesto no disponible',
      'Cliente retiró',
    ]);
  });
});

describe('commissionForRepair', () => {
  it('calcula el % de un trabajo Entregado redondeado a COP entero', () => {
    assert.equal(commissionForRepair(testRepair({ status: 'Entregado', budget: 480000 }), 0.3), 144000);
  });
  it('calcula el % sobre la UTILIDAD (presupuesto − repuesto)', () => {
    const withParts = testRepair({ status: 'Entregado', budget: 480000, partsCost: 80000 });
    assert.equal(commissionForRepair(withParts, 0.3), 120000);
  });
  it('devuelve 0 si el trabajo NO está Entregado', () => {
    assert.equal(commissionForRepair(testRepair({ status: 'Listo', budget: 480000 }), 0.3), 0);
    assert.equal(commissionForRepair(testRepair({ status: 'Cancelado / No Reparado', budget: 480000 }), 0.3), 0);
  });
  it('ignora tasas inválidas (NaN) devolviendo 0', () => {
    assert.equal(commissionForRepair(testRepair({ status: 'Entregado', budget: 480000 }), NaN), 0);
  });
});

describe('profitForRepair (utilidad = presupuesto − repuesto)', () => {
  it('sin repuesto la utilidad es el presupuesto completo', () => {
    assert.equal(profitForRepair(testRepair({ budget: 480000 })), 480000);
  });
  it('resta el valor del repuesto', () => {
    assert.equal(profitForRepair(testRepair({ budget: 480000, partsCost: 80000 })), 400000);
  });
  it('nunca es negativa aunque el repuesto supere el presupuesto', () => {
    assert.equal(profitForRepair(testRepair({ budget: 50000, partsCost: 120000 })), 0);
  });
});

describe('accumulatedProfit (lo que generó cada técnico)', () => {
  const repairs = [
    testRepair({ id: 'a', status: 'Entregado', budget: 480000, partsCost: 80000, technicianId: 't2', technicianName: 'Luis' }),
    testRepair({ id: 'b', status: 'Entregado', budget: 200000, technicianId: 't2', technicianName: 'Luis' }),
    testRepair({ id: 'c', status: 'En Proceso', budget: 300000, technicianId: 't2', technicianName: 'Luis' }),
    testRepair({ id: 'd', status: 'Entregado', budget: 400000, technicianId: 't3', technicianName: 'Sofia' }),
  ];
  it('suma solo los trabajos ENTREGADOS del técnico', () => {
    assert.equal(accumulatedProfit(repairs, 't2', 'Luis'), 400000 + 200000);
  });
  it('no mezcla trabajos de otros técnicos', () => {
    assert.equal(accumulatedProfit(repairs, 't3', 'Sofia'), 400000);
  });
});

describe('isAssignedToTechnician', () => {
  it('coincide por technicianId cuando está presente', () => {
    const repair = testRepair({ technicianId: 't2', technicianName: 'Luis Técnico (Hardware)' });
    assert.equal(isAssignedToTechnician(repair, 't2', 'Luis'), true);
    assert.equal(isAssignedToTechnician(repair, 't3', 'Sofia'), false);
  });
  it('hace fallback al nombre (datos legacy sin technicianId)', () => {
    const legacy = testRepair({ technicianName: 'Luis Técnico (Hardware)' });
    assert.equal(isAssignedToTechnician(legacy, 't2', 'Luis Técnico (Hardware)'), true);
  });
  it('rechaza trabajos sin técnico asignado (General)', () => {
    assert.equal(isAssignedToTechnician(testRepair({}), 't2', 'Luis'), false);
  });
});

describe('visibleRepairs (privacidad estricta)', () => {
  const all = [
    testRepair({ id: 'a', technicianId: 't2' }),
    testRepair({ id: 'b', technicianId: 't3' }),
    testRepair({ id: 'c' }), // General
  ];
  it('el admin ve todos los trabajos', () => {
    const admin: ViewUser = { id: 'u1', name: 'Carlos', role: 'admin' };
    assert.deepEqual(visibleRepairs(all, admin).map((r) => r.id), ['a', 'b', 'c']);
  });
  it('el técnico solo ve sus trabajos asignados', () => {
    const luis = technicianUser('t2', 'Luis');
    assert.deepEqual(visibleRepairs(all, luis).map((r) => r.id), ['a']);
  });
});

describe('applyPayment', () => {
  it('aplica el abono y devuelve el nuevo saldo', () => {
    const result = applyPayment(0, 200000, 50000);
    assert.equal(result.applied, 50000);
    assert.equal(result.newAdvance, 50000);
    assert.equal(result.remaining, 150000);
  });
  it('nunca supera el saldo pendiente', () => {
    const result = applyPayment(50000, 200000, 200000);
    assert.equal(result.applied, 150000);
    assert.equal(result.newAdvance, 200000);
    assert.equal(result.remaining, 0);
  });
  it('aplica un pago completo al saldo exacto', () => {
    const result = applyPayment(0, 200000, 200000);
    assert.equal(result.applied, 200000);
    assert.equal(result.remaining, 0);
  });
  it('devuelve 0 aplicado para montos inválidos', () => {
    assert.equal(applyPayment(0, 200000, -10).applied, 0);
    assert.equal(applyPayment(0, 200000, NaN).applied, 0);
  });
});

describe('canCancel / isValidCancellation', () => {
  it('permite cancelar desde Pendiente, En Proceso y Listo', () => {
    assert.equal(canCancel('Pendiente'), true);
    assert.equal(canCancel('En Proceso'), true);
    assert.equal(canCancel('Listo'), true);
  });
  it('NO permite cancelar desde Entregado ni Cancelado', () => {
    assert.equal(canCancel('Entregado'), false);
    assert.equal(canCancel('Cancelado / No Reparado'), false);
  });
  it('exige motivo obligatorio para cancelar', () => {
    assert.equal(isValidCancellation('Pendiente', 'Fuera de presupuesto'), true);
    assert.equal(isValidCancellation('Pendiente', undefined), false);
    assert.equal(isValidCancellation('En Proceso', ''), false);
  });
  it('acepta motivo en texto libre no vacío', () => {
    assert.equal(isValidCancellation('Pendiente', 'El cliente no trajo el equipo'), true);
    assert.equal(isValidCancellation('Pendiente', '   '), false);
  });
});

describe('hasActiveRepairs', () => {
  const active = [
    testRepair({ id: 'p', status: 'Pendiente', technicianId: 't2' }),
    testRepair({ id: 'f', status: 'Entregado', technicianId: 't2' }),
  ];
  it('detecta trabajos activos de un técnico', () => {
    assert.equal(hasActiveRepairs(active, 't2', 'Luis'), true);
    assert.equal(hasActiveRepairs([active[1]], 't2', 'Luis'), false);
  });
});