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

## Reglas Sagradas e Inviolables del Sistema
> Blindaje permanente de la memoria arquitectónica (2026-09-10). Ninguna tarea,
> plan o decisión puede contradecir estas tres invariantes.

- **Invariante 1 — Regla Absoluta de Costo $0 USD:**
  Prohibido el uso de APIs, servicios, extensiones, bases de datos o
  dependencias de pago. En OpenCode se opera exclusivamente con modelos
  gratuitos terminados en `:free` (ej. deepseek, gemini-flash, llama-3.3 vía
  endpoints gratuitos/OpenRouter). El backend vive estrictamente en la capa
  gratuita de Supabase (PostgreSQL, Auth, RLS, Storage) y el hosting en
  Vercel Hobby.
- **Invariante 2 — Metodología Vibecoding Puro:**
  Todo el flujo de trabajo se desarrolla mediante prompts modulares,
  iterativos y ejecutados por agentes de IA. El agente es responsable de
  analizar el contexto, planificar (/plan), codificar (/build), probar (/test)
  y validar antes de entregar.
- **Invariante 3 — Perfil del Director del Proyecto (0 Conocimiento en Programación):**
  El usuario es el Director del Taller y Dueño del Producto; su conocimiento
  de programación, sintaxis, frameworks o comandos complejos es CERO (0).
  El agente NUNCA debe pedirle que edite líneas de código, resuelva conflictos
  de merge manualmente, configure dependencias a mano o depure archivos. Toda
  solución debe ser autónoma, auto-contenida y entregada lista para ejecutar o
  ya aplicada por el agente, explicando el "qué" y el "por qué" en lenguaje de
  negocio claro y sin tecnicismos innecesarios.

## Decisiones Raíz
1. Compatibilidad 100% cross-platform (iOS, Android, Web) con una sola base de código.
2. Multi-tenancy forzado por `workshop_id` con Row Level Security (RLS).
3. Costo operativo cero: sin servicios de pago, sin librerías premium.