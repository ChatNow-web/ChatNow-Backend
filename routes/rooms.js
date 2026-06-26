const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const verifyJWT = require('../middleware/auth');
const { createRoom, joinRoom, getUserRooms, getRoomInfo, deleteRoom, changeRoomPassword } = require('../controllers/roomController');
const { validateInput, schemas } = require('../middleware/validation');

const roomCreateLimiter = rateLimit({
  windowMs: 3600000,
  max: 5,
  message: 'Too many rooms created, try again later',
  keyGenerator: (req) => req.user?.userId || req.ip
});

router.post('/create', verifyJWT, roomCreateLimiter, validateInput(schemas.createRoom), createRoom);
router.post('/join', verifyJWT, validateInput(schemas.joinRoom), joinRoom);
router.get('/user-rooms', verifyJWT, getUserRooms);
router.get('/:roomCode/info', verifyJWT, getRoomInfo);
router.delete('/:roomCode', verifyJWT, deleteRoom);
router.put('/:roomCode/password', verifyJWT, changeRoomPassword);

module.exports = router;
