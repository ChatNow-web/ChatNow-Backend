const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const BlockedWord = require('../models/BlockedWord');
const { sanitizeInput } = require('../utils/helpers');
const logger = require('../utils/logger');

const ADMIN_ROOMS = ['ADMIN-CHAT'];

const getMessages = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const { limit = 50, skip = 0, before } = req.query;
    const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

    const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const user = await User.findById(req.user.userId);
    if (ADMIN_ROOMS.includes(sanitizedCode)) {
      if (!user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } else if (!user.joinedRooms.includes(sanitizedCode) && !room.isPublic) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const query = { roomCode: sanitizedCode };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(Math.min(parseInt(limit), 100))
      .lean();

    res.json(messages.reverse().map(msg => ({
      _id: msg._id,
      sender: msg.sender,
      content: msg.deletedAt ? null : msg.content,
      contentType: msg.contentType,
      attachmentURL: msg.attachmentURL,
      isEdited: msg.isEdited,
      isDeleted: !!msg.deletedAt,
      reactions: msg.reactions,
      createdAt: msg.createdAt
    })));
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const { content, contentType, attachmentURL } = req.validated;
    const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

    const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const user = await User.findById(req.user.userId);
    if (!user.joinedRooms.includes(sanitizedCode)) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    if (user.bannedStatus?.isBanned) {
      return res.status(403).json({ error: 'You have been banned from sending messages' });
    }

    if (ADMIN_ROOMS.includes(sanitizedCode) && !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const sanitizedContent = sanitizeInput(content);

    const blockedWords = await BlockedWord.find().lean();
    const lowerContent = sanitizedContent.toLowerCase();
    for (const bw of blockedWords) {
      if (lowerContent.includes(bw.word)) {
        return res.status(403).json({ error: 'Message contains a blocked word' });
      }
    }

    const message = await Message.create({
      roomCode: sanitizedCode,
      sender: {
        userId: req.user.userId,
        username: req.user.username
      },
      content: sanitizedContent,
      contentType: contentType || 'text',
      attachmentURL: attachmentURL || null
    });

    req.app.get('io')?.to(sanitizedCode).emit('message:new', {
      _id: message._id,
      roomCode: sanitizedCode,
      sender: message.sender,
      content: message.content,
      contentType: message.contentType,
      createdAt: message.createdAt
    });

    res.status(201).json({
      messageId: message._id,
      timestamp: message.createdAt
    });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.deletedAt = new Date();
    message.deletedBy = req.user.userId;
    await message.save();

    req.app.get('io')?.emit('message:deleted', {
      messageId: message._id,
      roomCode: message.roomCode
    });

    logger.info(`Message ${messageId} deleted by user ${req.user.username}`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const reactToMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji, action } = req.validated;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

    if (action === 'add') {
      if (reactionIndex >= 0) {
        if (!message.reactions[reactionIndex].users.includes(req.user.userId)) {
          message.reactions[reactionIndex].users.push(req.user.userId);
        }
      } else {
        message.reactions.push({
          emoji,
          users: [req.user.userId]
        });
      }
    } else if (action === 'remove') {
      if (reactionIndex >= 0) {
        message.reactions[reactionIndex].users = message.reactions[reactionIndex].users
          .filter(id => id.toString() !== req.user.userId);
        if (message.reactions[reactionIndex].users.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      }
    }

    await message.save();

    res.json({ reactions: message.reactions });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMessages, sendMessage, deleteMessage, reactToMessage };
