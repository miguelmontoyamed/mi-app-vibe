import { useCallback, useState } from 'react';
import { AccessTokenRequest, ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Real Google OAuth sign-in (Authorization Code + PKCE) for web and native.
 *
 * Credentials come from the public env vars (public by design in a web SPA):
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID     xxxx.apps.googleusercontent.com
 *   EXPO_PUBLIC_GOOGLE_CLIENT_SECRET GOCSPX-...
 *
 * NOTE (Google quirk, verified 2025): even with PKCE, Google's "Web
 * application" client type REQUIRES `client_secret` at the token endpoint.
 * It ships in the web bundle like the Client ID — no extra risk for a
 * public client; oidc-spa / ktaka tests document the same behavior. If a
 * future backend (Supabase Edge Function) performs the exchange instead,
 * delete; the secret from the client entirely.
 *
 * Redirect URIs that MUST be authorized in Google Cloud Console (exact match,
 * no trailing slash — `makeRedirectUri()` on web returns the origin):
 *   Dev:  http://localhost:8081
 *   Prod: https://mi-app-vibe-ten.vercel.app
 */

// On web this closes the OAuth popup once Google redirects back to the app.
// 🛑 WEB: este módulo NO debe ejecutar NINGUNA lógica de popup/ventana
// secundaria. En web el Google sign-in usa la redirección de ventana completa
// de Supabase (supabaseSignInWithGoogleRedirect); `maybeCompleteAuthSession`
// solo corre en nativo (iOS/Android) donde sí hay un flujo in-app browser.
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET ?? '';

/** True when a Google Client ID has been configured for the build. */
export const isGoogleConfigured = GOOGLE_CLIENT_ID.length > 0;

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
}

/** Resultado del sign-in: el perfil + el id_token para puentear a Supabase. */
export interface GoogleAuthResult {
  profile: GoogleProfile;
  idToken: string;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodifica el payload de un JWT id_token (base64url -> string UTF-8) sin
 * depender de `atob`/`btoa` (ausentes en Hermes). Solo retorna claims; la
 * firma del token no se valida aquí porque el token llega desde el endpoint de
 * intercambio OAuth y nunca desde una fuente no confiable.
 */
function decodeIdToken(idToken: string): {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
} | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return null;
    const bytes = decodeBase64Url(payload);
    const json = JSON.parse(bytesToUtf8(bytes)) as Record<string, unknown>;
    return {
      email: typeof json.email === 'string' ? json.email : undefined,
      name: typeof json.name === 'string' ? json.name : undefined,
      picture: typeof json.picture === 'string' ? json.picture : undefined,
      sub: typeof json.sub === 'string' ? json.sub : undefined,
    };
  } catch {
    return null;
  }
}

/** base64url -> array de bytes (RFC 4648 §5). */
function decodeBase64Url(input: string): number[] {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const char = b64[i];
    if (char === '=') break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

/** bytes -> string con decodificación UTF-8 (1-4 bytes por code point). */
function bytesToUtf8(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if ((b & 0xe0) === 0xc0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else if ((b & 0xf0) === 0xe0 && i + 2 < bytes.length) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f)
      );
    } else if ((b & 0xf8) === 0xf0 && i + 3 < bytes.length) {
      out += String.fromCodePoint(
        ((b & 0x07) << 18) |
          ((bytes[++i] & 0x3f) << 12) |
          ((bytes[++i] & 0x3f) << 6) |
          (bytes[++i] & 0x3f)
      );
    }
  }
  return out;
}

/**
 * Real Google sign-in. `prompt()` abre la pantalla de consentimiento y
 * resuelve con el perfil real + el id_token (o null si se cancela/falla).
 * No usa efectos para el flujo: el canje del code ocurre dentro del handler
 * (seguro con React 19).
 */
export function useGoogleSignIn(): {
  prompt: () => Promise<GoogleAuthResult | null>;
  inProgress: boolean;
  error: string | null;
} {
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID || (Platform.OS === 'web' ? 'disabled' : undefined),
    // Google deprecated the implicit flow: force Code + PKCE on web too.
    responseType: ResponseType.Code,
    scopes: ['openid', 'email', 'profile'],
    usePKCE: true,
    // The code is exchanged manually (below) so we control the full flow
    // inside the event handler and never in an effect.
    shouldAutoExchangeCode: false,
  });

  const prompt = useCallback(async (): Promise<GoogleAuthResult | null> => {
    // 🛑 WEB: barrera absoluta. Este hook es EXCLUSIVO del flujo nativo
    // (expo-auth-session). En web jamás debe abrir popup/ventana secundaria:
    // si algo lo invoca, retorna null sin tocar WebBrowser ni promptAsync.
    if (Platform.OS === 'web') {
      return null;
    }
    if (!request || !GOOGLE_CLIENT_ID) {
      setError('Google no está configurado (falta EXPO_PUBLIC_GOOGLE_CLIENT_ID).');
      return null;
    }
    if (!GOOGLE_CLIENT_SECRET) {
      setError('Falta la clave de Google (EXPO_PUBLIC_GOOGLE_CLIENT_SECRET).');
      return null;
    }
    setInProgress(true);
    setError(null);
    try {
      const result = await promptAsync();
      if (result?.type !== 'success') {
        return null; // cancelado o error: el usuario no cambia de pantalla
      }
      const code = result.params.code;
      if (!code || !request.codeVerifier) {
        setError('Google no devolvió un código de autorización.');
        return null;
      }

      // Canje del código por tokens (Authorization Code + PKCE). Google's Web
      // Application clients need the secret here even with PKCE.
      const exchange = new AccessTokenRequest({
        clientId: request.clientId,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUri: request.redirectUri,
        scopes: ['openid', 'email', 'profile'],
        code,
        extraParams: { code_verifier: request.codeVerifier },
      });
      const token = await exchange.performAsync(Google.discovery);
      const idToken = token?.idToken;
      if (!idToken) {
        setError('No se obtuvo el id_token de Google.');
        return null;
      }

      const claims = decodeIdToken(idToken);
      const profile: GoogleProfile = {
        email: claims?.email ?? result.params.email ?? '',
        name: claims?.name ?? result.params.name ?? '',
        picture: claims?.picture ?? result.params.picture,
        googleId: claims?.sub,
      };
      if (!profile.email) {
        setError('Google no devolvió un correo válido.');
        return null;
      }
      return { profile, idToken };
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo conectar con Google.'
      );
      return null;
    } finally {
      // `finally` se ejecuta como continuación del handler (no es un efecto).
      setInProgress(false);
    }
  }, [request, promptAsync]);

  return { prompt, inProgress, error };
}