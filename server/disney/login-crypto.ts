import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../config/env';
import { type DisneyLogin, disneyLoginSchema } from './credentials';

const ALGORITHM = 'aes-256-gcm';

// The sizes AES-GCM recommends for its nonce and produces for its tag.
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

// Encrypts a login for storage. The result is the nonce, the authentication
// tag, and the ciphertext, joined and base64 encoded.
export function encryptLogin(login: DisneyLogin): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, env.LOGIN_ENCRYPTION_KEY, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(login), 'utf8'),
    cipher.final(),
  ]);

  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString(
    'base64'
  );
}

// Decrypts a stored login. Throws when it was encrypted with another key or
// has been altered.
export function decryptLogin(encryptedLogin: string): DisneyLogin {
  const bytes = Buffer.from(encryptedLogin, 'base64');
  const nonce = bytes.subarray(0, NONCE_BYTES);
  const tag = bytes.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
  const ciphertext = bytes.subarray(NONCE_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, env.LOGIN_ENCRYPTION_KEY, nonce);
  decipher.setAuthTag(tag);

  const json = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');

  return disneyLoginSchema.parse(JSON.parse(json));
}
