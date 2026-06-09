// pages/login.js
// Σελίδα εισόδου χρήστη

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

  // Αν είναι ήδη συνδεδεμένος, redirect στην αρχική
  useEffect(() => {
    // Έλεγχος αν το middleware έστειλε ?expired=1
    if (router.isReady && router.query.expired) {
      setSessionExpired(true);
    }
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) router.replace('/');
      })
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

      // Επιτυχής σύνδεση - πάμε στην αρχική
      router.replace('/');
    } catch (err) {
      setError('Σφάλμα δικτύου. Δοκιμάστε ξανά.');
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>TrackMate - Σύνδεση</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon-v2.png" />
        <link rel="apple-touch-icon" href="/icon-192-v2.png" />
      </Head>

      <div className="login-container">
        <div className="login-box">
          <div className="logo">
            <img src="/trackmate-tm.png" alt="" />
            <h1>TrackMate</h1>
            <p>Σύστημα παρακολούθησης μηχανημάτων</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Όνομα χρήστη</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
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
                required
                disabled={loading}
              />
            </div>

            {sessionExpired && !error && (
              <div className="error" style={{background:'#fef3c7', color:'#92400e', borderLeft:'3px solid #f59e0b'}}>
                Η συνεδρία σου έληξε. Συνδέσου ξανά.
              </div>
            )}
            {error && <div className="error">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? 'Σύνδεση...' : 'Σύνδεση'}
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f7fa;
          min-height: 100vh;
        }

        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .login-box {
          background: white;
          padding: 40px 32px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 400px;
        }

        .logo {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo img {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: block;
          margin: 0 auto 12px;
          box-shadow: 0 12px 28px rgba(124, 58, 237, 0.25);
        }

        .logo h1 {
          font-size: 32px;
          color: #2d3748;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .logo p {
          color: #718096;
          font-size: 14px;
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #4a5568;
          font-size: 14px;
          font-weight: 500;
        }

        .field input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .field input:focus {
          outline: none;
          border-color: #667eea;
        }

        .field input:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }

        .error {
          background: #fed7d7;
          color: #c53030;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          text-align: center;
        }

        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          font-family: inherit;
        }

        button:hover:not(:disabled) {
          opacity: 0.95;
        }

        button:active:not(:disabled) {
          transform: scale(0.99);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
