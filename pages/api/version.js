// pages/api/version.js
// Ποια έκδοση του TrackMate τρέχει. Η σελίδα το ελέγχει περιοδικά και, αν
// ανέβηκε νέα έκδοση, ξαναφορτώνει μόνη της (χρήσιμο για οθόνες/τηλεοράσεις).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev',
  });
}
