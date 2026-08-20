# Project Brief — TechRepair Master

> Documento raíz del Memory Bank. Todo el contexto del proyecto deriva de este archivo.

## Nombre
**TechRepair Master** — Directorio local: `mi-app-vibe`

## Propósito
SaaS multi-inquilino para la gestión integral de talleres de reparación tecnológica
(celulares, computadores) en Colombia, con mercado inicial en Medellín.

Sustituye por completo las hojas de cálculo y los AppSheet obsoletos con una
plataforma web/móvil que cubre el ciclo de vida completo de una orden de reparación:
registro con diagnóstico preliminar, asignación a técnico, seguimiento de repuestos
y comisiones, y facturación/entrega al cliente.

## Modelo de Negocio
- **Prueba gratuita:** 3 meses (90 días) desde la creación del taller.
- **Tarifa mensual:** 20.000 COP/mes mediante **Bre-B** (Llave: `3002011801`).
- **Alerta visual:** aviso al usuario en los **10 días previos** al vencimiento.
- **Acumulación de tiempo:** el tiempo de suscripción se acumula matemáticamente
  de forma automática (los pagos suman días al vencimiento actual).

## Regla de Infraestructura
- **Presupuesto estricto: $0 USD.**
- Stack gratuito obligatorio:
  - **Supabase** (Free Tier): Auth, Postgres, RLS, Storage, Realtime.
  - **Vercel** (Hobby): despliegue web conectado al branch `main`.
  - **Expo** (SDK 57): desarrollo React Native / React Native Web.
  - **OpenCode CLI**: endpoints `:free` para los agentes de consola.

## Decisiones Raíz
1. Compatibilidad 100% cross-platform (iOS, Android, Web) con una sola base de código.
2. Multi-tenancy forzado por `workshop_id` con Row Level Security (RLS).
3. Costo operativo cero: sin servicios de pago, sin librerías premium.