// Hash de contraseñas SHA-256 + salt, agnóstico del runtime:
// usa Web Crypto (Node y web) y recurre a `expo-crypto` solo en nativo,
// donde `crypto.subtle` no existe. Así el módulo es testeable con `node --test`.

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateSalt(): Promise<string> {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.getRandomValues === 'function') {
    return toHex(webCrypto.getRandomValues(new Uint8Array(16)));
  }

  const Crypto = await import('expo-crypto');
  return toHex(Crypto.getRandomBytes(16));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(password + salt));
    return toHex(new Uint8Array(digest));
  }

  const Crypto = await import('expo-crypto');
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password + salt);
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const newHash = await hashPassword(password, salt);
  return newHash === hash;
}
