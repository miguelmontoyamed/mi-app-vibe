// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ────────────────────────────────────────────────────────────────────────────
// jspdf: forzar la build ESM de navegador
// ────────────────────────────────────────────────────────────────────────────
// El SSR estático de Expo corre en Node, así que Metro resuelve `jspdf` por la
// condición `node` del exports → `dist/jspdf.node.min.js`, que contiene
// `require(["html2canvas"], t)` (require AMD dinámico) que Metro no puede
// transformar y rompe `expo export -p web` ("Invalid call").
// Redirigimos siempre a `dist/jspdf.es.min.js` (build ESM pura, sin el patrón
// AMD). jspdf solo se importa desde `src/utils/receipt-pdf.web.ts` (web), por
// lo que el redirect es inocuo para iOS/Android.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf') {
    return context.resolveRequest(context, 'jspdf/dist/jspdf.es.min.js', platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;