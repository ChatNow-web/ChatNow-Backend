const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');
const {
  getUsers, getActiveUsers, banUser, unbanUser, deleteUser,
  deleteMessage, clearRoomMessages, resetPlatform,
  addBlockedWord, getBlockedWords, removeBlockedWord,
  addAdmin, removeAdmin, flagUser
} = require('../controllers/adminController');

router.use(verifyJWT);
router.use(verifyAdmin);

router.get('/users', getUsers);
router.get('/users/active', getActiveUsers);
router.post('/users/ban', banUser);
router.post('/users/unban', unbanUser);
router.delete('/users/:userId', deleteUser);
router.post('/users/flag', flagUser);

router.delete('/messages/:messageId', deleteMessage);
router.delete('/messages/clear/:roomCode', clearRoomMessages);

router.post('/blocked-words', addBlockedWord);
router.get('/blocked-words', getBlockedWords);
router.delete('/blocked-words/:wordId', removeBlockedWord);

router.post('/add-admin', addAdmin);
router.delete('/remove-admin/:userId', removeAdmin);

router.post('/reset', resetPlatform);

module.exports = router;
