const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { signup, login, googleAuth, firebaseEmailAuth, anonymousAuth, refresh, logout } = require('../controllers/authController');
const { validateInput, schemas } = require('../middleware/validation');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

router.post('/signup', validateInput(schemas.signup), signup);
router.post('/login', loginLimiter, validateInput(schemas.login), login);
router.post('/google', validateInput(schemas.googleAuth), googleAuth);
router.post('/firebase-email', validateInput(schemas.googleAuth), firebaseEmailAuth);
router.post('/anonymous', validateInput(schemas.googleAuth), anonymousAuth);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
