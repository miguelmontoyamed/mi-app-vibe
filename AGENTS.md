# TechRepair Master — Guía de Proyecto y Organización de Agentes

## Proyecto

- **Stack**: Expo SDK 57 / React Native 0.86 / React 19, TypeScript ~6.0, expo-router (file-based), Supabase (cliente configurado), despliegue web en Vercel.
- **Docs Reference**: Consulta siempre la [documentación de Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) antes de usar APIs de Expo.
- **Path Aliases**: `@/*` -> `./src/*`, `@/assets/*` -> `./assets/*`.
- **Routing**: Router basado en archivos bajo `src/app/`. Experimentos activos: `typedRoutes: true`, `reactCompiler: true`.
- **Comandos**:
  - Dev server: `npm start` (`expo start`)
  - Web: `npm run web` | Android: `npm run android`
  - Lint: `npm run lint` (`expo lint`) — aplica reglas de hooks de React 19 (p. ej. detecta `react-hooks/set-state-in-effect`).
  - Typecheck: `npx tsc --noEmit` — Nota: los CSS modules (`*.module.css`) y el CSS global (`@/global.css`) no tienen declaraciones de tipos.
  - Tests unitarios: `npm test` (`node --test "src/**/*.test.ts"`).
- **React 19 / RN 0.86 Gotchas**: Reglas estrictas de efectos concurrentes (p. ej. evitar `setState` dentro de `useEffect`).

## Arquitectura (resumen)

- **Persistencia actual**: `AsyncStorage` (localStorage en web) vía `auth-context.tsx` y `repair-context.tsx` (claves `techrepair.*.v1`). Es una simulación local completa.
- **Supabase**: cliente configurado (`src/lib/supabase.ts` con `EXPO_PUBLIC_SUPABASE_*`) y esquema listo (`supabase/schema.sql` con RLS por taller), **pero el frontend todavía no consume la API** — es la migración clave de la Fase 2.
- **Lógica de dominio pura**: `src/utils/repair-logic.ts` (métodos de pago, cancelaciones con motivo, comisiones, visibilidad por rol) con tests en `repair-logic.test.ts` (17 tests verdes).
- **Rutas** (`src/app/`): `login`, `signup`, `(tabs)/` → `index` (dashboard), `receive` (recepción), `jobs` (trabajos + pagos), `customers`, `inventory`, `admin`; `receipt/[id]` (recibo imprimible).

---

## Equipos de Agentes (129 agentes instalados en `.opencode/agents/`)

Organización por especialidad para la coordinación. Se invocan por su nombre (`@nombre-del-agente`) como subagentes. Los marcados **[★ activos para TechRepair]** son los que se recomiendan para el ciclo actual del proyecto.

### 🏗️ Desarrollo (60)
Frontend, backend, móvil, arquitectura y datos.

`ai-engineer`, `angular-architect`, `api-designer`, `architect-reviewer`, `backend-developer`, `blockchain-developer`, `cli-developer`, `cpp-pro`, `csharp-developer`, `data-analyst`, `data-scientist`, `data-engineer`, `database-administrator`, `database-optimizer`, `django-developer`, `dotnet-core-expert`, `dotnet-framework-4.8-expert`, `electron-pro`, `elixir-expert`, `embedded-systems`, `fintech-engineer`, `flutter-expert`, **`frontend-developer`** ★, **`fullstack-developer`** ★, `game-developer`, `golang-pro`, `graphql-architect`, `iot-engineer`, `java-architect`, `javascript-pro`, `kotlin-specialist`, `laravel-specialist`, `legacy-modernizer`, `llm-architect`, `machine-learning-engineer`, `mcp-developer`, `microservices-architect`, `ml-engineer`, **`mobile-app-developer`** ★, `mobile-developer`, `nextjs-developer`, `nlp-engineer`, `payment-integration`, `php-pro`, `postgres-pro`, `powershell-ui-architect`, `prompt-engineer`, `python-pro`, `rails-expert`, `react-specialist`, `refactoring-specialist`, `rust-engineer`, `slack-expert`, `spring-boot-engineer`, `sql-pro`, `swift-expert`, `typescript-pro`, `vue-expert`, `websocket-engineer`, `wordpress-master`

*Destacados para TechRepair: pantallas React Native/Expo (`frontend-developer`, `mobile-app-developer`, `fullstack-developer`) y base de datos (`postgres-pro`, `database-optimizer`).*

### 🎨 UI/UX (3)
**`ui-designer`** ★, **`ux-researcher`** ★, `accessibility-tester`

*Ambient: diseño de temas, paleta (`src/constants/theme.ts`), componentes del design system (`src/components/ui/`) y accesibilidad WCAG.*

### 🛡️ Seguridad (8)
`ad-security-reviewer`, `compliance-auditor`, `legal-advisor`, **`penetration-tester`** ★, `powershell-security-hardening`, `risk-manager`, **`security-auditor`** ★, `security-engineer`

*Nota técnica: el auth actual es una simulación local con contraseñas seed en claro (`auth-context.tsx`) — auditada para la Fase 2 (auth real con Supabase + RLS).*

### ✅ QA / Testing (8)
`chaos-engineer`, **`code-reviewer`** ★, `debugger`, `error-coordinator`, `error-detective`, **`performance-engineer`** ★, **`qa-expert`** ★, **`test-automator`** ★

*Base existente: 17 tests `node --test` en `src/utils/repair-logic.test.ts`; lint y typecheck limpios.*

### 🚀 DevOps (23)
`agent-installer`, `azure-infra-engineer`, `build-engineer`, `cloud-architect`, `dependency-manager`, **`deployment-engineer`** ★, **`devops-engineer`** ★, `devops-incident-responder`, `git-workflow-manager`, **`incident-responder`** ★, `it-ops-orchestrator`, `kubernetes-specialist`, `m365-admin`, `mlops-engineer`, `network-engineer`, `performance-monitor`, `platform-engineer`, `powershell-5.1-expert`, `powershell-7-expert`, `powershell-module-architect`, `sre-engineer`, `terraform-engineer`, `windows-infra-admin`

*Ambiente: despliegue Vercel (`vercel.json` → `expo export -p web`), CI/CD y monitorización de `mi-app-vibe-ten.vercel.app`.*

### 🗂️ Gestión / Producto (27)
`agent-organizer`, `api-documenter`, `business-analyst`, `competitive-analyst`, `content-marketer`, `context-manager`, `customer-success-manager`, **`documentation-engineer`** ★, `dx-optimizer`, `knowledge-synthesizer`, `market-researcher`, **`master-manager`** ★, **`multi-agent-coordinator`** ★, `product-manager`, **`project-manager`** ★, `quant-analyst`, `data-researcher`, `research-analyst`, `sales-engineer`, `scrum-master`, `search-specialist`, `seo-specialist`, **`task-distributor`** ★, `technical-writer`, `tooling-engineer`, `trend-analyst`, `workflow-orchestrator`

*Ambientación: hojas de ruta, entregables, priorización de la Fase 2 (comprobantes PDF, WhatsApp, reportes de caja) y documentación.*

---

## Recomendación de coordinación para la siguiente fase

| Fase / Tarea | Agentes principales | Apoyo |
|---|---|---|
| Correcciones críticas (auth real) | `security-auditor`, `backend-developer`, `fullstack-developer` | `postgres-pro`, `qa-expert` |
| Comprobantes PDF imprimibles | `frontend-developer`, `ui-designer` | `technical-writer` |
| Notificaciones WhatsApp | `fullstack-developer`, `payment-integration` | `qa-expert` |
| Reportes de caja por fecha | `data-analyst`, `sql-pro`, `backend-developer` | `ui-designer` |
| QA de cierre de fase | `test-automator`, `code-reviewer`, `performance-engineer` | `master-manager` |

> Cómo usar: `@master-manager` orquesta; `@task-distributor` reparte; cada agente ejecuta su tarea y reporta hallazgos.