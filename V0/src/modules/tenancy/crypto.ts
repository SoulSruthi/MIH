import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error('CREDENTIAL_ENCRYPTION_KEY not set');
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return key;
}

export function encryptCredential(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
  const key = getKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Append auth tag to ciphertext so decryption can verify integrity
  const ciphertext = Buffer.concat([encrypted, tag]);
  return { ciphertext, nonce };
}

export function decryptCredential(ciphertext: Buffer, nonce: Buffer): string {
  const key = getKey();
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
  const encrypted = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
