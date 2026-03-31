const COOKIE_NAME = 'spa_session_token';

const buildCookieAttributes = (expiresAt?: number | null) => {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'SameSite=Lax'];
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    parts.push('Secure');
  }
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    parts.push(`Expires=${new Date(expiresAt * 1000).toUTCString()}`);
  }
  return parts;
};

export const setSessionTokenCookie = (token: string, expiresAt?: number | null) => {
  if (typeof document === 'undefined') return;
  const parts = buildCookieAttributes(expiresAt);
  parts[0] = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  document.cookie = parts.join('; ');
};

export const clearSessionTokenCookie = () => {
  if (typeof document === 'undefined') return;
  const parts = buildCookieAttributes(0);
  document.cookie = parts.join('; ');
};
