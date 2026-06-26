const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../services/bcrypt');
const { generateRoomAccessToken } = require('../services/jwt');
const { generateRoomCode, sanitizeInput } = require('../utils/helpers');
const logger = require('../utils/logger');

const ADMIN_ROOMS = ['ADMIN-CHAT'];

const createRoom = async (req, res, next) => {
  try {
    const { name, password, maxMembers } = req.validated;
    const sanitizedName = sanitizeInput(name);

    const userRoomCount = await Room.countDocuments({
      createdBy: req.user.userId,
      isDeleted: false,
      createdAt: { $gte: new Date(Date.now() - 3600000) }
    });

    if (userRoomCount >= 5) {
      return res.status(429).json({ error: 'Room creation limit reached (5/hour)' });
    }

    let roomCode = generateRoomCode();
    let codeExists = await Room.findOne({ roomCode });
    while (codeExists) {
      roomCode = generateRoomCode();
      codeExists = await Room.findOne({ roomCode });
    }

    const roomData = {
      roomCode,
      name: sanitizedName,
      createdBy: req.user.userId,
      members: [req.user.userId],
      isPublic: !password,
      maxMembers: maxMembers || null
    };

    if (password) {
      roomData.passwordHash = await hashPassword(password);
    }

    const room = await Room.create(roomData);

    await User.findByIdAndUpdate(req.user.userId, {
      $addToSet: { joinedRooms: roomCode }
    });

    logger.info(`Room ${roomCode} created by user ${req.user.username}`);

    res.status(201).json({
      roomCode: room.roomCode,
      roomId: room._id,
      name: room.name
    });
  } catch (error) {
    next(error);
  }
};

const joinRoom = async (req, res, next) => {
  try {
    const { roomCode, password } = req.validated;
    const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

    const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (ADMIN_ROOMS.includes(sanitizedCode)) {
      return res.status(403).json({ error: 'Cannot join this room directly' });
    }

    if (room.passwordHash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required' });
      }
      const isValid = await comparePassword(password, room.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid room password' });
      }
    }

    const user = await User.findById(req.user.userId);
    if (user.bannedStatus?.isBanned) {
      return res.status(403).json({ error: 'You have been banned' });
    }

    if (!room.members.includes(req.user.userId)) {
      room.members.push(req.user.userId);
      await room.save();
    }

    await User.findByIdAndUpdate(req.user.userId, {
      $addToSet: { joinedRooms: sanitizedCode }
    });

    const roomAccessToken = generateRoomAccessToken(sanitizedCode, req.user.userId);

    res.json({
      roomAccessToken,
      room: room.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const getUserRooms = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    let rooms = await Room.find({
      roomCode: { $in: user.joinedRooms },
      isDeleted: false
    }).sort({ createdAt: -1 });

    rooms = rooms.filter(r => {
      if (ADMIN_ROOMS.includes(r.roomCode)) {
        return user.isAdmin;
      }
      return true;
    });

    res.json(rooms.map(room => room.toPublicJSON()));
  } catch (error) {
    next(error);
  }
};

const getRoomInfo = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

    const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (ADMIN_ROOMS.includes(sanitizedCode)) {
      const user = await User.findById(req.user.userId);
      if (!user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      return res.json(room.toPublicJSON());
    }

    const user = await User.findById(req.user.userId);
    if (!user.joinedRooms.includes(sanitizedCode) && !room.isPublic) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    res.json(room.toPublicJSON());
  } catch (error) {
    next(error);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

    const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the room creator can delete this room' });
    }

    if (sanitizedCode === 'CHATNOW-ALL' || ADMIN_ROOMS.includes(sanitizedCode)) {
      return res.status(403).json({ error: 'Cannot delete a system room' });
    }

    room.isDeleted = true;
    await room.save();

    await Message.updateMany(
      { roomCode: sanitizedCode },
      { deletedAt: new Date(), deletedBy: req.user.userId }
    );

    logger.info(`Room ${sanitizedCode} deleted by user ${req.user.username}`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const changeRoomPassword = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const { currentPassword, newPassword } = req.body;
    const sanitizedCode = sanitizeInput(roomCode.toUpperCase());

    const room = await Room.findOne({ roomCode: sanitizedCode, isDeleted: false });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the room creator can change the password' });
    }

    if (room.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const isValid = await comparePassword(currentPassword, room.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    room.passwordHash = await hashPassword(newPassword);
    await room.save();

    logger.info(`Room ${sanitizedCode} password changed by user ${req.user.username}`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { createRoom, joinRoom, getUserRooms, getRoomInfo, deleteRoom, changeRoomPassword };
