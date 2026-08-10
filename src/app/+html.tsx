import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML document for the web build (Expo Router static export).
 *
 * `viewport-fit=cover` lets the layout extend under the browser/status chrome
 * on iOS Safari (notched iPhones / Dynamic Island), so the CSS custom
 * properties `env(safe-area-inset-*)` defined in `src/global.css` actually
 * resolve to real inset pixels instead of `0px`.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}