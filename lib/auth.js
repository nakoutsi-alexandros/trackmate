// lib/auth.js
// Helper functions για authentication μέσω cookies
// Cookie is HMAC-SHA256 signed to prevent forgery.

import { serialize, parse } from 'cookie';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'trackmate_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 μέρες

// Secret used to sign the session cookie. Must be set in env for production.
// Falls back to a dev-only placeholder so `next dev` still works.
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-only-insecure-secret-change-me';

function sign(payload) {
  const sig = createHmac('sha256', COOKIE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token) {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', COOKIE_SECRET).update(payload).digest('base64url');
  // Timing-safe comparison prevents timing attacks on the signature
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return payload;
}

// Δημιουργία cookie μετά από επιτυχές login
export function setAuthCookie(res, username, fullName, role = 'admin') {
  const payload = Buffer.from(JSON.stringify({ username, fullName, role })).toString('base64url');
  const token = sign(payload);

  const cookie = serialize(COOKIE_NAME, token, {
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
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    const payload = verify(token);
    if (!payload) return null;

    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}
