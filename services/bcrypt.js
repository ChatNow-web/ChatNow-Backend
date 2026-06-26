const bcrypt = require('bcryptjs');
const { BCRYPT_SALT_ROUNDS } = require('../config/constants');

const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, comparePassword };
