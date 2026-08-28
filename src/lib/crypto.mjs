/**
 * crypto.mjs | AES-256-GCM for the GitHub token at rest.
 *
 * The token is write only from the client's point of view. It is never returned
 * by any API response, not even masked. The stored blob is
 * iv (12 bytes) || authTag (16 bytes) || ciphertext.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.mjs';

const IV_LEN = 12;
const TAG_LEN = 16;

function key() {
  if (!config.tokenEncKey) {
    throw new Error(
      'TOKEN_ENC_KEY is not set to 64 hex characters, so a GitHub token cannot be stored. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return config.tokenEncKey;
}

export function canEncrypt() {
  return Boolean(config.tokenEncKey);
}

export function encryptToken(plain) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptToken(blob) {
  if (!blob || blob.length <= IV_LEN + TAG_LEN) return null;
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const body = buf.subarray(IV_LEN + TAG_LEN);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    // A wrong key or a tampered blob. Treat as absent rather than crashing.
    return null;
  }
}

export function randomSlug(bytes = 12) {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
