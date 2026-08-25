import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrialDaysLeft,
  shouldShowTrialWarning,
  isWorkshopExpired,
  type WorkshopSubscriptionRow,
} from './monetization-trial.ts';

describe('monetization-trial utils', () => {
  const BASE_TIME = new Date('2026-08-25T12:00:00.000Z').getTime();

  describe('calculateTrialDaysLeft', () => {
    it('calcula correctamente los 90 días recién iniciado el trial', () => {
      const trialEndsAt = new Date('2026-11-23T12:00:00.000Z').toISOString(); // +90 días
      const daysLeft = calculateTrialDaysLeft('trial', trialEndsAt, BASE_TIME);
      assert.equal(daysLeft, 90);
    });

    it('calcula 10 días restantes con precisión', () => {
      const trialEndsAt = new Date('2026-09-04T12:00:00.000Z').toISOString(); // +10 días
      const daysLeft = calculateTrialDaysLeft('trial', trialEndsAt, BASE_TIME);
      assert.equal(daysLeft, 10);
    });

    it('calcula 1 día restante', () => {
      const trialEndsAt = new Date('2026-08-26T12:00:00.000Z').toISOString(); // +1 día
      const daysLeft = calculateTrialDaysLeft('trial', trialEndsAt, BASE_TIME);
      assert.equal(daysLeft, 1);
    });

    it('devuelve 0 si ya expiró el trial pero sigue en estado trial', () => {
      const trialEndsAt = new Date('2026-08-20T12:00:00.000Z').toISOString(); // pasado
      const daysLeft = calculateTrialDaysLeft('trial', trialEndsAt, BASE_TIME);
      assert.equal(daysLeft, 0);
    });

    it('devuelve null si el status es active (suscripción paga)', () => {
      const trialEndsAt = new Date('2026-09-04T12:00:00.000Z').toISOString();
      const daysLeft = calculateTrialDaysLeft('active', trialEndsAt, BASE_TIME);
      assert.equal(daysLeft, null);
    });

    it('devuelve null si no hay fecha de fin de trial', () => {
      const daysLeft = calculateTrialDaysLeft('trial', null, BASE_TIME);
      assert.equal(daysLeft, null);
    });
  });

  describe('shouldShowTrialWarning (aviso de 10 días)', () => {
    it('NO muestra advertencia si faltan más de 10 días (ej. 85 días)', () => {
      const trialEndsAt = new Date('2026-11-18T12:00:00.000Z').toISOString();
      const show = shouldShowTrialWarning('trial', trialEndsAt, BASE_TIME);
      assert.equal(show, false);
    });

    it('SÍ muestra advertencia exactamente a los 10 días restantes', () => {
      const trialEndsAt = new Date('2026-09-04T12:00:00.000Z').toISOString(); // 10 días
      const show = shouldShowTrialWarning('trial', trialEndsAt, BASE_TIME);
      assert.equal(show, true);
    });

    it('SÍ muestra advertencia a los 5 días restantes', () => {
      const trialEndsAt = new Date('2026-08-30T12:00:00.000Z').toISOString(); // 5 días
      const show = shouldShowTrialWarning('trial', trialEndsAt, BASE_TIME);
      assert.equal(show, true);
    });

    it('NO muestra advertencia si el taller ya pagó (active)', () => {
      const trialEndsAt = new Date('2026-08-30T12:00:00.000Z').toISOString();
      const show = shouldShowTrialWarning('active', trialEndsAt, BASE_TIME);
      assert.equal(show, false);
    });
  });

  describe('isWorkshopExpired (bloqueo / paywall)', () => {
    it('NO está expirado si está dentro de los 90 días de prueba', () => {
      const row: WorkshopSubscriptionRow = {
        status: 'trial',
        trial_ends_at: new Date('2026-11-23T12:00:00.000Z').toISOString(),
        subscription_ends_at: null,
      };
      assert.equal(isWorkshopExpired(row, BASE_TIME), false);
    });

    it('SÍ está expirado si pasaron los 90 días de prueba sin pagar', () => {
      const row: WorkshopSubscriptionRow = {
        status: 'trial',
        trial_ends_at: new Date('2026-08-20T12:00:00.000Z').toISOString(), // pasado
        subscription_ends_at: null,
      };
      assert.equal(isWorkshopExpired(row, BASE_TIME), true);
    });

    it('SÍ está expirado si status es "expired" explícito', () => {
      const row: WorkshopSubscriptionRow = {
        status: 'expired',
        trial_ends_at: new Date('2026-11-23T12:00:00.000Z').toISOString(),
        subscription_ends_at: null,
      };
      assert.equal(isWorkshopExpired(row, BASE_TIME), true);
    });

    it('NO está expirado si el trial venció pero tiene suscripción paga activa', () => {
      const row: WorkshopSubscriptionRow = {
        status: 'active',
        trial_ends_at: new Date('2026-08-20T12:00:00.000Z').toISOString(), // trial vencido
        subscription_ends_at: new Date('2026-12-01T12:00:00.000Z').toISOString(), // suscripción activa
      };
      assert.equal(isWorkshopExpired(row, BASE_TIME), false);
    });
  });
});
