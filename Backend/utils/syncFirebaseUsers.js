import { User } from "../database/index.js";

/**
 * Sync MongoDB users with Firebase Auth: remove Mongo users whose Firebase UID
 * no longer exists in Firebase (e.g. account deleted in Firebase).
 * @param {import("firebase-admin").auth.Auth} auth - Firebase Admin auth instance
 * @returns {{ deleted: number, checked: number, orphaned?: number }}
 */
export async function syncMongoUsersWithFirebase(auth) {
  let deleted = 0;
  let checked = 0;
  const firebaseUids = new Set();

  try {
    let nextPageToken;
    do {
      const listResult = await auth.listUsers(1000, nextPageToken);
      listResult.users.forEach((u) => firebaseUids.add(u.uid));
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    const mongoUsers = await User.find({}, { firebaseId: 1 }).lean();
    checked = mongoUsers.length;

    for (const mu of mongoUsers) {
      if (!firebaseUids.has(mu.firebaseId)) {
        await User.deleteOne({ _id: mu._id });
        deleted += 1;
      }
    }

    return { deleted, checked, orphaned: deleted };
  } catch (err) {
    console.error("[syncFirebase] Error:", err.message);
    throw err;
  }
}
