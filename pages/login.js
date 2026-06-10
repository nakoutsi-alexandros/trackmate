import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (router.isReady && router.query.expired) {
      setSessionExpired(true);
    }
    fetch('/api/auth/me')
      .then((res) => { if (res.ok) router.replace('/'); })
      .catch(() => {});
  }, [router.isReady, router.query.expired]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Σφάλμα κατά τη σύνδεση');
        setLoading(false);
        return;
      }
      router.replace('/');
    } catch {
      setError('Σφάλμα δικτύου. Δοκιμάστε ξανά.');
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>TrackMate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon-v2.png" />
        <link rel="apple-touch-icon" href="/icon-192-v2.png" />
      </Head>

      <div className="page">
        <div className="card">

          <div className="brand">
            <img src="/trackmate-tm.png" alt="TM" className="brand-logo" />
            <span className="brand-name">TrackMate</span>
          </div>

          <h1 className="heading">Σύνδεση</h1>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Όνομα χρήστη</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="username"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="password">Κωδικός</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {sessionExpired && !error && (
              <div className="notice warn">Η συνεδρία σου έληξε. Συνδέσου ξανά.</div>
            )}
            {error && <div className="notice error">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-inner">
                  <span className="spinner" />
                  Σύνδεση…
                </span>
              ) : 'Σύνδεση'}
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          background: #0c0c0e;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%),
            #0c0c0e;
        }

        .card {
          width: 100%;
          max-width: 380px;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 36px 32px 32px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .brand-logo {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          object-fit: contain;
        }

        .brand-name {
          font-size: 15px;
          font-weight: 600;
          color: #e4e4e7;
          letter-spacing: -0.01em;
        }

        .heading {
          font-size: 22px;
          font-weight: 600;
          color: #fafafa;
          letter-spacing: -0.02em;
          margin-bottom: 24px;
        }

        .field {
          margin-bottom: 16px;
        }

        .field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #a1a1aa;
          margin-bottom: 6px;
        }

        .field input {
          width: 100%;
          padding: 10px 14px;
          background: #09090b;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          font-size: 15px;
          font-family: inherit;
          color: #fafafa;
          transition: border-color 0.15s;
          outline: none;
        }

        .field input::placeholder { color: #52525b; }

        .field input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }

        .field input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notice {
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          line-height: 1.45;
        }

        .notice.error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
        }

        .notice.warn {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          color: #fcd34d;
        }

        button[type="submit"] {
          width: 100%;
          margin-top: 8px;
          padding: 11px 16px;
          background: #6366f1;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          letter-spacing: -0.01em;
        }

        button[type="submit"]:hover:not(:disabled) { background: #4f52e0; }
        button[type="submit"]:active:not(:disabled) { transform: scale(0.99); }
        button[type="submit"]:disabled { opacity: 0.45; cursor: not-allowed; }

        .btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
