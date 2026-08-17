/**
 * Declaraciones de tipos para assets de estilo (CSS Modules y CSS global).
 * El CSS Modules de `animated-icon.web.tsx` y el import de `@/global.css` en
 * `src/constants/theme.ts` no tienen tipos nativos; estas declaraciones
 * ambientales hacen que `tsc --noEmit` pase limpio.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
