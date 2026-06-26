const jwt = require('jsonwebtoken');

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

let cachedCerts = null;
let certsExpiry = 0;

const fetchGoogleCerts = async () => {
  if (cachedCerts && Date.now() < certsExpiry) {
    return cachedCerts;
  }

  try {
    const https = require('https');
    const response = await new Promise((resolve, reject) => {
      https.get(GOOGLE_CERTS_URL, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const cacheControl = res.headers['cache-control'] || '';
          const maxAge = parseInt(cacheControl.match(/max-age=(\d+)/)?.[1] || '3600');
          certsExpiry = Date.now() + (maxAge * 1000);
          resolve(JSON.parse(data));
        });
      }).on('error', reject);
    });
    cachedCerts = response;
    return response;
  } catch (error) {
    if (cachedCerts) return cachedCerts;
    throw error;
  }
};

const verifyGoogleToken = async (idToken) => {
  if (!PROJECT_ID) {
    throw new Error('Firebase not configured (missing FIREBASE_PROJECT_ID)');
  }

  const certs = await fetchGoogleCerts();
  const header = JSON.parse(Buffer.from(idToken.split('.')[0], 'base64').toString());

  if (!header.kid) {
    throw new Error('Invalid token header');
  }

  const publicKey = certs[header.kid];
  if (!publicKey) {
    throw new Error('Invalid token signature key');
  }

  const decoded = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: PROJECT_ID,
    issuer: `https://securetoken.google.com/${PROJECT_ID}`
  });

  return {
    uid: decoded.user_id,
    email: decoded.email || null,
    name: decoded.name || null,
    picture: decoded.picture || null
  };
};

const initializeFirebase = () => {
  if (!PROJECT_ID) {
    console.log('Firebase not configured (missing FIREBASE_PROJECT_ID), Google auth disabled');
    return;
  }
  console.log(`Firebase configured: project=${PROJECT_ID}`);
};

const getFirebaseApp = () => null;

module.exports = { initializeFirebase, verifyGoogleToken, getFirebaseApp };
