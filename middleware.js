// middleware.js
// Προστατεύει όλα τα routes εκτός από /login και /api/auth/*
// Ελέγχει ύπαρξη ΚΑΙ εγκυρότητα του HMAC-signed session cookie.

import { NextResponse } from 'next/server';

const COOKIE_NAME = 'trackmate_session';
// Πρέπει να ταιριάζει με το COOKIE_SECRET στο lib/auth.js
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-only-insecure-secret-change-me';

// Web Crypto HMAC-SHA256 verification (Edge Runtime compatible)
async function isValidToken(token) {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;

    const payload = token.slice(0, dot);
    const sig     = token.slice(dot + 1);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(COOKIE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // base64url → Uint8Array
    const b64 = sig.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));

    return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Επιτρεπόμενα paths χωρίς auth
  const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
  ];

  // Static files και Next.js internals - τα αφήνουμε να περάσουν
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static')
  ) {
    return NextResponse.next();
  }

  // Επιτρεπόμενα public paths
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Έλεγχος ύπαρξης cookie
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Έλεγχος εγκυρότητας HMAC — απορρίπτουμε παλιά/πλαστά cookies
  const valid = await isValidToken(sessionCookie.value);
  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }
    // Redirect στο login — θα καθαρίσει το παλιό cookie μέσω logout
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('expired', '1');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
