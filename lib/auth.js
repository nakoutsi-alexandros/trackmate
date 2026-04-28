// lib/auth.js
// Helper functions για authentication μέσω cookies

import { serialize, parse } from 'cookie';

const COOKIE_NAME = 'trackmate_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 μέρες

// Δημιουργία cookie μετά από επιτυχές login
export function setAuthCookie(res, username, fullName) {
  const sessionData = JSON.stringify({ username, fullName });
  // Base64 encode για να είναι safe σε cookie
  const encoded = Buffer.from(sessionData).toString('base64');

  const cookie = serialize(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
}

// Διαγραφή cookie στο logout
export function clearAuthCookie(res) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
}

// Διάβασμα του τρέχοντα χρήστη από το request
export function getUserFromRequest(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const encoded = cookies[COOKIE_NAME];

    if (!encoded) return null;

    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const session = JSON.parse(decoded);

    return session;
  } catch (err) {
    return null;
  }
}
