const { verifyGoogleToken } = require('../config/firebase');

const validateFirebaseToken = async (idToken) => {
  try {
    const decoded = await verifyGoogleToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture
    };
  } catch (error) {
    throw new Error('Invalid Firebase token');
  }
};

module.exports = { validateFirebaseToken };
