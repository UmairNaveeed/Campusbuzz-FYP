const CACHE_KEY = 'campusbuzz_profile_cache';

export function readProfileCache(firebaseUid) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.firebaseId !== firebaseUid) return null;
    return parsed.profile || null;
  } catch {
    return null;
  }
}

export function writeProfileCache(firebaseUid, profile) {
  try {
    if (!firebaseUid || !profile?.username) return;
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ firebaseId: firebaseUid, profile })
    );
  } catch {
    // ignore quota errors
  }
}

export function clearProfileCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Map Mongo user document to profile shape used by PrivateRoute */
export function mapDbUserToProfile(user) {
  if (!user) return null;
  return {
    firebaseId: user.firebaseId,
    name: user.name,
    username: user.username,
    rollNumber: user.rollNumber,
    startYear: user.startYear,
    endYear: user.endYear,
    department: user.department,
    startSemester: user.startSemester,
    bio: user.bio || null,
    location: user.location || null,
    program: user.program || null,
    currentStatus: user.currentStatus || null,
    profilePhoto: user.profilePhoto || null,
    coverPhoto: user.coverPhoto || null,
  };
}
