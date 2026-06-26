const jwt = require('jsonwebtoken');

const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '15m' }
  );
};

const generateRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

const generateAdminToken = (payload) => {
  return jwt.sign(
    { ...payload, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const generateRoomAccessToken = (roomCode, userId) => {
  return jwt.sign(
    { roomCode, userId, type: 'room_access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ROOM_ACCESS_TOKEN_EXPIRY || '1h' }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateAdminToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateRoomAccessToken
};
