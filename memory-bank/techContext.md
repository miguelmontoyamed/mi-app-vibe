# Tech Context — TechRepair Master

## Stack Técnico
- **Frontend:** React Native + Expo SDK 57 + `expo-router`, TypeScript estricto.
- **Web:** React Native Web (despliegue Vercel).
- **Backend:** Supabase Free Tier — Auth (PKCE), Postgres, RLS, Storage, Realtime.
- **CLI de desarrollo:** OpenCode con endpoints `:free`.

## Convenciones de Código
- **Tipado estricto:** cero `any` en TypeScript. Tipos explícitos en contratos
  de datos; prohibido `as any`, `@ts-ignore`, `@ts-expect-error`.
- **Verificación:** `npx tsc --noEmit` con 0 errores antes de concluir cualquier
  cambio.
- **Testing:** `node --test` para módulos puros (`src/utils/*.test.ts`) y suite
  de integración RLS en `tests/integration/rls.test.ts`.

## Localización Colombia
- **NIT numérico de 9 dígitos** con **cálculo automático del dígito de
  verificación DIAN** mediante **Módulo 11** en `src/utils/nit.ts`
  (pesos `[3, 7, 13, 17, 19, 23, 29, 37, 41, ...]` de derecha a izquierda;
  DV = `11 - (suma % 11)`, con `11 → 0` y `10 → 1`).
- **Impresión:** tickets térmicos/PDF con membrete del taller vía `expo-print`.
- Moneda: COP; pagos por **Bre-B** (llave `3002011801`).

## Persistencia y Sincronización
- **Supabase Realtime** alimenta los datos de la app (órdenes, inventario, caja).
- **Prohibido** depender de caché obsoleta de `AsyncStorage`: Realtime es la
  fuente de verdad; los estados globales (`repair-context`, `auth-context`,
  `workshop-context`) se sincronizan desde Supabase.

## Despliegue
- **Vercel** conectado al branch `main` de GitHub.
- Producción: `https://mi-app-vibe-ten.vercel.app` (scope `team_OasIoaa3lOqq8RlUwnrK2Tit`).
- Repositorio: `https://github.com/miguelmontoyamed/mi-app-vibe.git`.

## Variables de Entorno
- Públicas (embebidas en bundle web por diseño):
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET`.
- Privadas (solo servidor/CI): `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`.