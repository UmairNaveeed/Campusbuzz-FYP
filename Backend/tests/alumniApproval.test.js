import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniqueUsername } from '../utils/alumniApproval.js';

test('buildUniqueUsername retries when the generated username is already taken', async () => {
  let attempts = 0;

  const username = await buildUniqueUsername('Jane Doe', 'jane@example.com', 'abc1234567890', async (value) => {
    attempts += 1;
    return value === 'janedoe567890' || value === 'janedoe567890-2';
  });

  assert.equal(username, 'janedoe567890-3');
  assert.equal(attempts, 3);
});
