// The key BG1's backend uses to encrypt sensor data and the embedded Disney
// public key, so neither appears as plain text in transit or in the bundle.
const APP_KEY_BASE64 = 'hFK/SpnRKEoKKGjDahJBaP70niDSIMZTJM5+xeBtn60';

const IV_LENGTH = 12;

let appKey: Promise<CryptoKey> | undefined;

// Converts bytes to a string with one character per byte, the format btoa and
// node-forge expect.
export function bytesToBinaryString(bytes: ArrayBuffer | Uint8Array): string {
  return String.fromCodePoint(...new Uint8Array(bytes));
}

export function binaryStringToBytes(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(text, character => character.codePointAt(0) ?? 0);
}

function importAppKey(): Promise<CryptoKey> {
  appKey ??= crypto.subtle.importKey(
    'raw',
    binaryStringToBytes(atob(APP_KEY_BASE64)),
    'AES-GCM',
    false,
    ['decrypt']
  );

  return appKey;
}

// Decrypts an AES-GCM payload laid out as a 12-byte IV followed by the
// ciphertext, returning the plaintext as a binary string.
export async function decryptWithAppKey(
  payload: string | Uint8Array<ArrayBuffer>
): Promise<string> {
  const bytes =
    typeof payload === 'string' ? binaryStringToBytes(payload) : payload;
  const iv = bytes.slice(0, IV_LENGTH);
  const ciphertext = bytes.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    await importAppKey(),
    ciphertext
  );

  return bytesToBinaryString(plaintext);
}
