// middleware.js
// Προστατεύει όλα τα routes εκτός από /login και /api/auth/*
// Αν δεν υπάρχει cookie, redirect στο /login

import { NextResponse } from 'next/server';

export function middleware(request) {
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

  // Έλεγχος cookie
  const sessionCookie = request.cookies.get('trackmate_session');

  if (!sessionCookie) {
    // Δεν είναι συνδεδεμένος
    if (pathname.startsWith('/api/')) {
      // Για API calls, επιστροφή 401 JSON
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    // Για pages, redirect στο login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
