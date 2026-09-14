import { User } from '../database/index.js';

/**
 * Get user by Firebase UID (for use in controllers).
 * @param {string} firebaseId
 * @returns {Promise<import('mongoose').Document|null>}
 */
export async function getUserByFirebaseId(firebaseId) {
  const user = await User.findOne({ firebaseId });
  return user;
}
