import { webcrypto } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run password:hash -- <password>');
  process.exit(1);
}

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const iterations = 210000;
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
console.log(`pbkdf2:${iterations}:${b64url(salt)}:${b64url(new Uint8Array(bits))}`);
