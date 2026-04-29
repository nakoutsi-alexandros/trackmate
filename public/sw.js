// public/sw.js
// Service Worker — αυτόματο update κάθε φορά που ανοίγει το app

const CACHE_NAME = 'trackmate-v1';

// Κατά την εγκατάσταση — cache τα βασικά αρχεία
self.addEventListener('install', (event) => {
  // Άμεση ενεργοποίηση χωρίς αναμονή
  self.skipWaiting();
});

// Κατά την ενεργοποίηση — σβήσε παλιά caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Πάρε αμέσως τον έλεγχο όλων των tabs
      return self.clients.claim();
    })
  );
});

// Για κάθε request — network first, cache fallback
// Έτσι βλέπεις πάντα την τελευταία έκδοση αν έχεις σύνδεση
self.addEventListener('fetch', (event) => {
  // Μόνο GET requests
  if (event.request.method !== 'GET') return;

  // API calls — πάντα από network, ποτέ από cache
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Υπόλοιπα (pages, assets) — network first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Αποθήκευσε στο cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Αν δεν υπάρχει δίκτυο, χρησιμοποίησε cache
        return caches.match(event.request);
      })
  );
});
