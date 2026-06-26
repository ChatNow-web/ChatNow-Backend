const User = require('../models/User');
const { comparePassword, hashPassword } = require('../services/bcrypt');
const { sanitizeInput } = require('../utils/helpers');

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toPublicJSON());
  } catch (error) {
    next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const { email } = req.body;
    const updates = {};

    if (email) {
      const sanitizedEmail = sanitizeInput(email).toLowerCase();
      const existing = await User.findOne({ email: sanitizedEmail });
      if (existing && existing._id.toString() !== req.user.userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = sanitizedEmail;
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(user.toPublicJSON());
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validated;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMe, updateMe, changePassword };
