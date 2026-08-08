# Expo SDK 57 / mi-app-vibe

- **Docs Reference**: Always consult [Expo SDK 57 Docs](https://docs.expo.dev/versions/v57.0.0/) before using Expo APIs.
- **Path Aliases**: `@/*` -> `./src/*`, `@/assets/*` -> `./assets/*`.
- **Routing**: File-based router under `src/app/`. Experiments: `typedRoutes: true`, `reactCompiler: true`.
- **Commands**:
  - Dev server: `npm start` (`expo start`)
  - Lint: `npm run lint` (`expo lint`) — enforces React 19 hooks rules (e.g., catches `react-hooks/set-state-in-effect`).
  - Typecheck: `npx tsc --noEmit` — Note: CSS modules (`*.module.css`) and global CSS (`@/global.css`) lack type declarations.
- **React 19 / RN 0.86 Gotchas**: Strict concurrent/effect rules apply (e.g., avoiding `setState` inside `useEffect`).
