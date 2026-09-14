import test from 'node:test';
import assert from 'node:assert/strict';
import { sendVerificationEmail } from '../utils/adminEmailVerification.js';

test('falls back to development mode when SMTP credentials are not configured', async () => {
  const originalEnv = {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    NODE_ENV: process.env.NODE_ENV,
  };

  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  process.env.NODE_ENV = 'development';

  try {
    const result = await sendVerificationEmail('admin@example.com', 'http://localhost:5173/admin/verify-email?token=test');
    assert.equal(result.success, true);
    assert.equal(result.mode, 'development');
    assert.equal(result.link, 'http://localhost:5173/admin/verify-email?token=test');
  } finally {
    if (originalEnv.EMAIL_USER === undefined) delete process.env.EMAIL_USER; else process.env.EMAIL_USER = originalEnv.EMAIL_USER;
    if (originalEnv.EMAIL_PASS === undefined) delete process.env.EMAIL_PASS; else process.env.EMAIL_PASS = originalEnv.EMAIL_PASS;
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
});
