const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const { getMe, updateMe, changePassword } = require('../controllers/userController');
const { validateInput, schemas } = require('../middleware/validation');

router.get('/me', verifyJWT, getMe);
router.put('/me', verifyJWT, updateMe);
router.put('/me/password', verifyJWT, validateInput(schemas.changePassword), changePassword);

module.exports = router;
