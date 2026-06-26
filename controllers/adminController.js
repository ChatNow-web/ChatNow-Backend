const User = require('../models/User');
const Message = require('../models/Message');
const BlockedWord = require('../models/BlockedWord');
const Room = require('../models/Room');
const { ADMIN_EMAIL } = require('../middleware/adminAuth');
const logger = require('../utils/logger');

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json(users.map(u => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      isAdmin: u.isAdmin || (u.email && u.email.toLowerCase() === ADMIN_EMAIL),
      isBanned: u.bannedStatus?.isBanned || false,
      bannedReason: u.bannedStatus?.reason,
      joinedRooms: u.joinedRooms,
      lastActive: u.lastActive,
      createdAt: u.createdAt
    })));
  } catch (error) {
    next(error);
  }
};

const getActiveUsers = async (req, res, next) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await User.find({
      lastActive: { $gte: fiveMinAgo }
    }).lean();

    const activeUserIds = new Set();
    const io = req.app.get('io');
    if (io) {
      const sockets = await io.fetchSockets();
      sockets.forEach(s => {
        if (s.data?.userId) activeUserIds.add(s.data.userId.toString());
      });
    }

    res.json(users.map(u => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      isOnline: activeUserIds.has(u._id.toString()),
      lastActive: u.lastActive
    })));
  } catch (error) {
    next(error);
  }
};

const banUser = async (req, res, next) => {
  try {
    const { userId, reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ error: 'userId and reason required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot ban the main admin' });
    }

    user.bannedStatus = {
      isBanned: true,
      bannedAt: new Date(),
      bannedBy: req.adminUser._id,
      reason
    };
    await user.save();

    logger.info(`Admin ${req.adminUser.username} banned user ${user.username}`);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('account:banned', { reason });
    }

    res.json({ success: true, message: `User ${user.username} banned` });
  } catch (error) {
    next(error);
  }
};

const unbanUser = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.bannedStatus = { isBanned: false };
    await user.save();

    logger.info(`Admin ${req.adminUser.username} unbanned user ${user.username}`);

    res.json({ success: true, message: `User ${user.username} unbanned` });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot delete the main admin' });
    }

    await User.findByIdAndDelete(userId);

    await Message.updateMany(
      { 'sender.userId': userId },
      { deletedAt: new Date(), deletedBy: req.adminUser._id }
    );

    await Room.updateMany(
      { createdBy: userId },
      { $pull: { members: userId } }
    );

    logger.info(`Admin ${req.adminUser.username} deleted user ${user.username}`);

    res.json({ success: true, message: `User ${user.username} deleted` });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { reason } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.deletedAt = new Date();
    message.deletedBy = req.adminUser._id;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('message:deleted', {
        messageId,
        roomCode: message.roomCode,
        deletedByAdmin: true
      });
    }

    logger.info(`Admin ${req.adminUser.username} deleted message ${messageId} in ${message.roomCode}`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const clearRoomMessages = async (req, res, next) => {
  try {
    const { roomCode } = req.params;

    const room = await Room.findOne({ roomCode: roomCode.toUpperCase(), isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = await Message.updateMany(
      { roomCode: roomCode.toUpperCase(), deletedAt: null },
      { deletedAt: new Date(), deletedBy: req.adminUser._id }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(roomCode.toUpperCase()).emit('room:messages-cleared', {
        roomCode: roomCode.toUpperCase(),
        clearedBy: req.adminUser.username
      });
    }

    logger.info(`Admin ${req.adminUser.username} cleared all messages in ${roomCode}`);

    res.json({
      success: true,
      message: `Cleared ${result.modifiedCount} messages in ${roomCode}`
    });
  } catch (error) {
    next(error);
  }
};

const resetPlatform = async (req, res, next) => {
  try {
    if (!req.isMainAdmin) {
      return res.status(403).json({ error: 'Only the main admin can reset the platform' });
    }

    const result = await Message.deleteMany({});

    await BlockedWord.deleteMany({});

    logger.info(`Admin ${req.adminUser.username} reset the entire platform (${result.deletedCount} messages deleted)`);

    const io = req.app.get('io');
    if (io) {
      io.emit('platform:reset', {
        resetBy: req.adminUser.username
      });
    }

    res.json({
      success: true,
      message: `Platform reset complete. ${result.deletedCount} messages deleted.`
    });
  } catch (error) {
    next(error);
  }
};

const addBlockedWord = async (req, res, next) => {
  try {
    const { word } = req.body;
    if (!word || word.trim().length < 1) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const cleanWord = word.trim().toLowerCase();
    const existing = await BlockedWord.findOne({ word: cleanWord });
    if (existing) {
      return res.status(409).json({ error: 'Word already blocked' });
    }

    await BlockedWord.create({
      word: cleanWord,
      addedBy: req.adminUser._id
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('blocked-words:updated');
    }

    logger.info(`Admin ${req.adminUser.username} blocked word: "${cleanWord}"`);

    res.status(201).json({ success: true, word: cleanWord });
  } catch (error) {
    next(error);
  }
};

const getBlockedWords = async (req, res, next) => {
  try {
    const words = await BlockedWord.find().sort({ createdAt: -1 }).lean();
    res.json(words.map(w => ({ _id: w._id, word: w.word, addedAt: w.createdAt })));
  } catch (error) {
    next(error);
  }
};

const removeBlockedWord = async (req, res, next) => {
  try {
    const { wordId } = req.params;
    await BlockedWord.findByIdAndDelete(wordId);

    const io = req.app.get('io');
    if (io) {
      io.emit('blocked-words:updated');
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const addAdmin = async (req, res, next) => {
  try {
    if (!req.isMainAdmin) {
      return res.status(403).json({ error: 'Only the main admin can add new admins' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Only Gmail addresses can be admins' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      const existingAdmin = await User.findOne({ email: cleanEmail, isAdmin: true });
      if (existingAdmin) {
        return res.status(409).json({ error: 'Email is already an admin' });
      }
      return res.status(400).json({
        error: 'User with this email must exist on the platform first. They need to login before being invited.'
      });
    }

    if (user.isAdmin) {
      return res.status(409).json({ error: 'User is already an admin' });
    }

    user.isAdmin = true;
    await user.save();

    if (!user.joinedRooms.includes('ADMIN-CHAT')) {
      user.joinedRooms.push('ADMIN-CHAT');
      await user.save();
    }

    logger.info(`Admin ${req.adminUser.username} added admin: ${cleanEmail}`);

    const roomsPromise = Room.findOneAndUpdate(
      { roomCode: 'ADMIN-CHAT' },
      { $addToSet: { members: user._id } }
    );

    res.json({
      success: true,
      message: `${cleanEmail} is now an admin`
    });
  } catch (error) {
    next(error);
  }
};

const removeAdmin = async (req, res, next) => {
  try {
    if (!req.isMainAdmin) {
      return res.status(403).json({ error: 'Only the main admin can remove admins' });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot remove the main admin' });
    }

    if (!user.isAdmin) {
      return res.status(400).json({ error: 'User is not an admin' });
    }

    user.isAdmin = false;
    await user.save();

    res.json({ success: true, message: `${user.username} is no longer an admin` });
  } catch (error) {
    next(error);
  }
};

const flagUser = async (req, res, next) => {
  try {
    const { userId, reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ error: 'userId and reason required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.bannedStatus = {
      isBanned: true,
      bannedAt: new Date(),
      bannedBy: req.adminUser._id,
      reason: `[FLAGGED] ${reason}`
    };
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('account:flagged', { reason, flaggedBy: req.adminUser.username });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers, getActiveUsers, banUser, unbanUser, deleteUser,
  deleteMessage, clearRoomMessages, resetPlatform,
  addBlockedWord, getBlockedWords, removeBlockedWord,
  addAdmin, removeAdmin, flagUser
};
