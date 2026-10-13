// pages/_document.js
// Δηλώνει ότι η σελίδα είναι στα ελληνικά (lang="el").
// Έτσι ο browser βγάζει σωστά τους τόνους όταν το κείμενο γίνεται κεφαλαία
// (π.χ. "Σύνολο αποθήκης" → "ΣΥΝΟΛΟ ΑΠΟΘΗΚΗΣ") και διαβάζει σωστά τη σελίδα.

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="el">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
