import { describe, it, expect } from 'vitest';
import { newBackupKey, encryptBackup, decryptBackup, isEncryptedBackup } from '../backupCrypto';

describe('encrypted backups', () => {
  const text = JSON.stringify({ format: 'expensetracker-backup', v: 2, transactions: [{ id: 't1', name: 'Chai ☕', amount: 20 }] });

  it('round-trips, and the file does not contain the data', async () => {
    const key = newBackupKey();
    const sealed = await encryptBackup(key, text);
    expect(isEncryptedBackup(sealed)).toBe(true);
    expect(sealed).not.toContain('Chai');
    expect(sealed).not.toContain('transactions');
    expect(await decryptBackup(key, sealed)).toBe(text);
  });

  it('a different account’s key cannot open it', async () => {
    const sealed = await encryptBackup(newBackupKey(), text);
    await expect(decryptBackup(newBackupKey(), sealed)).rejects.toThrow(/different account/);
  });

  it('a tampered file is refused', async () => {
    const key = newBackupKey();
    const f = JSON.parse(await encryptBackup(key, text));
    f.data = f.data.slice(0, -6) + 'AAAAAA';
    await expect(decryptBackup(key, JSON.stringify(f))).rejects.toThrow();
  });

  it('older unencrypted backups still restore', async () => {
    expect(isEncryptedBackup(text)).toBe(false);
    expect(await decryptBackup(newBackupKey(), text)).toBe(text);
  });

  it('every backup uses a fresh IV', async () => {
    const key = newBackupKey();
    const a = JSON.parse(await encryptBackup(key, text)), b = JSON.parse(await encryptBackup(key, text));
    expect(a.iv).not.toBe(b.iv);
  });
});
