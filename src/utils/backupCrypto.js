// ─── Encrypted backups ───────────────────────────────────────────
// Drive backups are sealed with AES-256-GCM. The key is random, made once
// per account and kept in the account itself (users/{uid}/backup_key), so a
// backup file on its own — downloaded, shared, copied off a laptop — is
// unreadable; restoring needs you signed in to the same account.
//
// File: { format: 'expensetracker-encrypted', v: 1, alg: 'AES-GCM', iv, data }
// (iv and data base64). Pure functions on WebCrypto (browser and Node).

export const ENCRYPTED_FORMAT = 'expensetracker-encrypted';

const subtle = () => globalThis.crypto.subtle;
const toB64 = (bytes) => {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** A new random key, as base64 (what the account stores). */
export function newBackupKey() {
  return toB64(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

const importKey = (b64) => subtle().importKey('raw', fromB64(b64), 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function encryptBackup(keyB64, text) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await subtle().encrypt({ name: 'AES-GCM', iv }, await importKey(keyB64), new TextEncoder().encode(text));
  return JSON.stringify({ format: ENCRYPTED_FORMAT, v: 1, alg: 'AES-GCM', iv: toB64(iv), data: toB64(data) });
}

export function isEncryptedBackup(text) {
  try { return JSON.parse(text)?.format === ENCRYPTED_FORMAT; } catch { return false; }
}

/** The backup's JSON text. Throws a readable error for a wrong key or a damaged file. */
export async function decryptBackup(keyB64, text) {
  const f = JSON.parse(text);
  if (f?.format !== ENCRYPTED_FORMAT) return text;          // an older, unencrypted backup
  try {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(f.iv) }, await importKey(keyB64), fromB64(f.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('This backup can’t be opened with this account — it was made by a different account, or the file is damaged.');
  }
}
