function slugifyName(displayName, email) {
  const raw = String(displayName || email || 'alumni')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);

  return raw || 'alumni';
}

export async function buildUniqueUsername(displayName, email, firebaseUid, isUsernameTaken = async () => false) {
  const baseName = slugifyName(displayName, email);
  const suffix = String(firebaseUid || '').slice(-6);
  const candidates = [
    `${baseName}${suffix}`,
    `${baseName}${suffix}-2`,
    `${baseName}${suffix}-3`,
    `${baseName}${suffix}-4`,
    `${baseName}${suffix}-5`,
  ];

  for (const candidate of candidates) {
    const taken = await isUsernameTaken(candidate);
    if (!taken) return candidate;
  }

  return `${baseName}${suffix}-${Date.now().toString(36)}`;
}
