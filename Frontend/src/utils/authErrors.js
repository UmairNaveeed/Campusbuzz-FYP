export const SUSPENDED_MESSAGE =
  'Your account has been suspended.';

const CREDENTIAL_ERROR_CODES = new Set([
  'auth/user-not-found',
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-disabled',
]);

/**
 * Map Firebase / API auth errors to user-friendly copy for login forms.
 * @returns {{ emailOrUsername?: string, password?: string, general?: string }}
 */
export function mapLoginAuthError(err) {
  const code = err?.code || '';

  if (code === 'auth/user-disabled') {
    return { emailOrUsername: SUSPENDED_MESSAGE };
  }
  if (code === 'auth/invalid-email') {
    return { emailOrUsername: 'Invalid email address.' };
  }
  if (code === 'auth/too-many-requests') {
    return {
      emailOrUsername: 'Too many attempts. Please try again later or reset your password.',
    };
  }

  if (err?.response?.status === 403 && err?.response?.data?.suspended) {
    return { emailOrUsername: SUSPENDED_MESSAGE };
  }

  const apiError = err?.response?.data?.error;
  if (typeof apiError === 'string' && /suspend/i.test(apiError)) {
    return { emailOrUsername: SUSPENDED_MESSAGE };
  }

  if (CREDENTIAL_ERROR_CODES.has(code)) {
    return { emailOrUsername: 'Invalid username or password. Please try again.' };
  }

  const isResolveError = err?.response?.status === 404 || err?.response?.data?.error;
  if (isResolveError) {
    return { emailOrUsername: 'Invalid username or password. Please try again.' };
  }

  return {
    emailOrUsername: apiError || err?.message || 'Login failed. Please try again.',
  };
}

export function isCredentialFailure(err) {
  return CREDENTIAL_ERROR_CODES.has(err?.code || '');
}
