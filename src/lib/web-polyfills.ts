/**
 * Polyfills para entornos web antiguos (iOS/Safari < 15.4, WebViews embebidos).
 *
 * IMPORTANTE: importar como PRIMER import en `src/app/_layout.tsx`, antes que
 * cualquier módulo de react-native-reanimated / expo-router, porque Reanimated
 * usa `structuredClone` en su capa web (`createAnimationWithInitialValues`) y
 * en Safari/iOS < 15.4 esa función no existe → crash → pantalla en blanco.
 *
 * Limitación conocida del polyfill (JSON clone): no clona `Date`, `Map`, `Set`,
 * `undefined` en propiedades ni instancias de clase. Es suficiente para los
 * valores de animación de Reanimated (objetos planos de números/strings) y se
 * aplica ÚNICAMENTE cuando el navegador no ofrece el nativo.
 */

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = function structuredClone<T>(value: T): T {
    if (value === undefined) return undefined as T;
    return JSON.parse(JSON.stringify(value)) as T;
  } as typeof structuredClone;
}

export {};