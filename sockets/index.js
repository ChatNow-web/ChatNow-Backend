const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const BlockedWord = require('../models/BlockedWord');
const { sanitizeInput } = require('../utils/helpers');
const logger = require('../utils/logger');

const ADMIN_ROOMS = ['ADMIN-CHAT'];

const onlineUsers = new Map();

const setupSocketHandlers = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, username } = socket.user;
    logger.info(`Socket connected: ${username} (${userId})`);

    onlineUsers.set(userId, {
      socketId: socket.id,
      username,
      joinedRooms: new Set(),
      lastActive: new Date()
    });

    try {
      await User.findByIdAndUpdate(userId, { lastActive: new Date() });
    } catch (err) {
      logger.error('Failed to update user lastActive:', err.message);
    }

    // Auto-join global room on connect
    const GLOBAL_CODE = 'CHATNOW-ALL';
    const ADMIN_CHAT_CODE = 'ADMIN-CHAT';
    socket.join(GLOBAL_CODE);
    const userData = onlineUsers.get(userId);
    if (userData) {
      userData.joinedRooms.add(GLOBAL_CODE);
    }

    // Auto-join AdminChat if admin
    User.findById(userId).then(user => {
      if (user && (user.isAdmin || (user.email && user.email.toLowerCase() === (process.env.ADMIN_EMAIL || 'harinarayanantr.thoovara@gmail.com').toLowerCase()))) {
        socket.join(ADMIN_CHAT_CODE);
        if (userData) {
          userData.joinedRooms.add(ADMIN_CHAT_CODE);
        }
        socket.to(ADMIN_CHAT_CODE).emit('user:joined', {
          userId,
          username,
          roomCode: ADMIN_CHAT_CODE
        });
      }
    }).catch(() => {});
    socket.to(GLOBAL_CODE).emit('user:joined', {
      userId,
      username,
      roomCode: GLOBAL_CODE
    });
    const globalMembers = [];
    for (const [uid, data] of onlineUsers) {
      if (data.joinedRooms.has(GLOBAL_CODE)) {
        globalMembers.push({ userId: uid, username: data.username, isOnline: true });
      }
    }
    io.to(GLOBAL_CODE).emit('room:members', {
      roomCode: GLOBAL_CODE,
      members: globalMembers
    });

    socket.on('room:join', async (roomCode) => {
      try {
        const sanitizedCode = sanitizeInput(roomCode.toUpperCase());
        const user = await User.findById(userId);
        const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });

        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        if (ADMIN_ROOMS.includes(sanitizedCode)) {
          if (!user.isAdmin) {
            return socket.emit('error', { message: 'Admin access required' });
          }
        } else if (!user.joinedRooms.includes(sanitizedCode)) {
          return socket.emit('error', { message: 'Not a member of this room' });
        }

        if (user.bannedStatus?.isBanned) {
          return socket.emit('error', { message: 'You have been banned' });
        }

        socket.join(sanitizedCode);
        const userData = onlineUsers.get(userId);
        if (userData) {
          userData.joinedRooms.add(sanitizedCode);
        }

        socket.to(sanitizedCode).emit('user:joined', {
          userId,
          username,
          roomCode: sanitizedCode
        });

        const roomMembers = [];
        for (const [uid, data] of onlineUsers) {
          if (data.joinedRooms.has(sanitizedCode)) {
            roomMembers.push({ userId: uid, username: data.username, isOnline: true });
          }
        }

        io.to(sanitizedCode).emit('room:members', {
          roomCode: sanitizedCode,
          members: roomMembers
        });
      } catch (err) {
        logger.error('room:join error:', err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('room:leave', async (roomCode) => {
      try {
        const sanitizedCode = sanitizeInput(roomCode.toUpperCase());
        socket.leave(sanitizedCode);

        const userData = onlineUsers.get(userId);
        if (userData) {
          userData.joinedRooms.delete(sanitizedCode);
        }

        socket.to(sanitizedCode).emit('user:left', {
          userId,
          username,
          roomCode: sanitizedCode
        });
      } catch (err) {
        logger.error('room:leave error:', err.message);
      }
    });

    socket.on('message:send', async (data, callback) => {
      try {
        const { roomCode, content, contentType } = data;
        const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

        const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
        if (!room) {
          return callback?.({ error: 'Room not found' });
        }

        const userDoc = await User.findById(userId);
        if (ADMIN_ROOMS.includes(sanitizedCode) && !userDoc.isAdmin) {
          return callback?.({ error: 'Admin access required' });
        }

        const sanitizedContent = sanitizeInput(content);

        const blockedWords = await BlockedWord.find().lean();
        const lowerContent = sanitizedContent.toLowerCase();
        for (const bw of blockedWords) {
          if (lowerContent.includes(bw.word)) {
            return callback?.({ error: 'Message contains a blocked word' });
          }
        }

        const message = await Message.create({
          roomCode: sanitizedCode,
          sender: { userId, username },
          content: sanitizedContent,
          contentType: contentType || 'text'
        });

        io.to(sanitizedCode).emit('message:new', {
          _id: message._id,
          roomCode: sanitizedCode,
          sender: { userId, username },
          content: sanitizedContent,
          contentType: message.contentType,
          createdAt: message.createdAt
        });

        callback?.({ messageId: message._id, timestamp: message.createdAt });
      } catch (err) {
        logger.error('message:send error:', err.message);
        callback?.({ error: 'Failed to send message' });
      }
    });

    socket.on('message:typing', (data) => {
      const { roomCode, isTyping } = data;
      const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

      socket.to(sanitizedCode).emit('user:typing', {
        userId,
        username,
        isTyping,
        roomCode: sanitizedCode
      });
    });

    socket.on('message:delete', async (data, callback) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          return callback?.({ error: 'Message not found' });
        }

        message.deletedAt = new Date();
        await message.save();

        io.to(message.roomCode).emit('message:deleted', {
          messageId: message._id,
          roomCode: message.roomCode
        });

        callback?.({ success: true });
      } catch (err) {
        logger.error('message:delete error:', err.message);
        callback?.({ error: 'Failed to delete message' });
      }
    });

    socket.on('room:members', async (roomCode) => {
      try {
        const sanitizedCode = sanitizeInput(roomCode.toUpperCase());
        const roomMembers = [];

        for (const [uid, data] of onlineUsers) {
          if (data.joinedRooms.has(sanitizedCode)) {
            roomMembers.push({ userId: uid, username: data.username, isOnline: true });
          }
        }

        socket.emit('room:members', {
          roomCode: sanitizedCode,
          members: roomMembers
        });
      } catch (err) {
        logger.error('room:members error:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${username} (${userId})`);
      const userData = onlineUsers.get(userId);
      if (userData) {
        for (const roomCode of userData.joinedRooms) {
          socket.to(roomCode).emit('user:left', {
            userId,
            username,
            roomCode
          });
        }
      }
      onlineUsers.delete(userId);
    });
  });
};

module.exports = { setupSocketHandlers, onlineUsers };
