const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const verifyJWT = require('../middleware/auth');
const { getMessages, sendMessage, deleteMessage, reactToMessage } = require('../controllers/messageController');
const { validateInput, schemas } = require('../middleware/validation');

const messageLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  message: 'Too many messages, slow down',
  keyGenerator: (req) => req.user?.userId || req.ip
});

router.get('/:roomCode', verifyJWT, getMessages);
router.post('/:roomCode', verifyJWT, messageLimiter, validateInput(schemas.sendMessage), sendMessage);
router.delete('/:messageId', verifyJWT, validateInput(schemas.deleteMessage), deleteMessage);
router.put('/:messageId/react', verifyJWT, validateInput(schemas.reactToMessage), reactToMessage);

module.exports = router;
