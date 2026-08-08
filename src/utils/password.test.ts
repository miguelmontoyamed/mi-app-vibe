import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword, generateSalt } from './password.ts';

describe('password utils', () => {
  it('should hash and verify passwords correctly (RED -> GREEN)', async () => {
    const password = 'my-secret-password';
    const salt = await generateSalt();
    const hash = await hashPassword(password, salt);
    
    // RED (this would fail if verifyPassword was wrong)
    assert.notStrictEqual(hash, password);
    assert.notStrictEqual(hash, '');
    
    // GREEN
    const isValid = await verifyPassword(password, hash, salt);
    assert.strictEqual(isValid, true);
  });

  it('should fail verification for wrong password', async () => {
    const salt = await generateSalt();
    const hash = await hashPassword('correct', salt);
    const isValid = await verifyPassword('wrong', hash, salt);
    assert.strictEqual(isValid, false);
  });
});
