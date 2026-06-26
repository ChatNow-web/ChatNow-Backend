const crypto = require('crypto');

const generateRoomCode = (length = 8) => {
  return crypto.randomBytes(length)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, length)
    .toUpperCase();
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  const DOMPurify = require('isomorphic-dompurify');
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = { generateRoomCode, sanitizeInput, generateCSRFToken };
