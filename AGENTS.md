# AGENTS.md — Reglas Maestras de TechRepair Master

## PROTOCOLO DE MEMORIA (Memory Bank)
1. **ANTES DE COMENZAR:** leer obligatoriamente `memory-bank/activeContext.md`
   y `memory-bank/systemPatterns.md` para situarse en la tarea activa y respetar
   las invariantes del sistema.
2. **REGLA $0 USD:** todo código generado debe ser nativo para
   React Native/Web + Supabase Free Tier. No sugerir librerías ni servicios de pago.
3. **TIPADO ESTRICTO:** cero uso de `any` en TypeScript.
4. **AL FINALIZAR TAREA:** actualizar `memory-bank/activeContext.md` y
   `memory-bank/progress.md` reflejando el nuevo estado antes de hacer commit.

## 1. Contexto y Stack
- **Proyecto:** TechRepair Master (`mi-app-vibe`)
- **Stack:** React Native (Expo SDK 57, `expo-router`), React Native Web, TypeScript (~6.0.3), Supabase (Auth, DB, RLS, Storage), Vercel.
- **Premisa Operativa:** Mantener 100% de compatibilidad cross-platform (iOS, Android, Web) y costo 0 USD.

## 2. Invariantes de Seguridad y Calidad (Reglas Intocables)
1. **Separación Estricta UI / Lógica:** Prohibido modificar lógica de negocio, esquemas de Supabase, llamadas a la API, autenticación o estados globales (`repair-context`, `auth-context`) al realizar tareas de diseño.
2. **Cero Operaciones Destructivas:** Prohibido `git reset --hard`, `git clean -fd`, borrado masivo o `git push` a remoto sin orden explícita.
3. **Respeto a Cambios Locales:** Inspecciona siempre `git status` antes de modificar archivos. No sobrescribas trabajo no commiteado.
4. **Verificación TypeScript:** Todo cambio debe compilar con `npx tsc --noEmit` con 0 errores antes de concluir la tarea.
5. **Uso Eficiente de Agentes:** Emplea agentes/subagentes solo cuando aporten valor real (análisis profundo o tareas complejas multi-archivo). Evita la concurrencia en los mismos ficheros.

## 3. Sistema Visual Híbrido: Material Design 3 + Liquid Glass
- **Material Design 3 (Estructura y Jerarquía):**
  - Define la arquitectura de pantallas, márgenes (`safe-areas`), elevación, jerarquía tipográfica, estados de interacción (hover, pressed, focus), accesibilidad y adaptabilidad responsive (móvil, tablet, desktop).
- **Liquid Glass (Acabados y Profundidad):**
  - Translucidez sutil (`backdrop-filter` / blur ligero), iluminación de bordes, capas suaves de profundidad.
  - **Criterio de moderación:** Uso selectivo en tarjetas clave, cabeceras, barras de navegación o modales flotantes. Prohibido saturar la interfaz completa de glassmorphism.
  - **Regla de conflicto:** Si accesibilidad, contraste o rendimiento chocan con la estética glass, la funcionalidad y legibilidad ganan siempre.

## 4. Protocolo de Trabajo Obligatorio (4 Fases)
- **Fase 1 (Modo Análisis):** Explorar stack, archivos involucrados, dependencias y riesgos. Presentar diagnóstico y plan por fases sin modificar código.
- **Fase 2 (Espera):** Detenerse y esperar confirmación explícita del usuario (`APROBAR REDISEÑO`).
- **Fase 3 (Implementación):** Aplicar cambios visuales de forma modular, incremental y comprobable.
- **Fase 4 (Validación):** Comprobar tipos (`npx tsc --noEmit`) y garantizar rollback seguro mediante Git.