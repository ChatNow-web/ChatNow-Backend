const Room = require('../models/Room');
const logger = require('../utils/logger');

const createGlobalRoom = async () => {
  try {
    const existing = await Room.findOne({ roomCode: 'CHATNOW-ALL' });
    if (!existing) {
      await Room.create({
        roomCode: 'CHATNOW-ALL',
        name: 'ChatNow Global',
        description: 'Welcome to ChatNow! This is the global public room.',
        isPublic: true,
        maxMembers: 1000
      });
      logger.info('Global room "CHATNOW-ALL" created');
    }
  } catch (error) {
    logger.error('Failed to create global room:', error.message);
  }
};

const createAdminChatRoom = async () => {
  try {
    const existing = await Room.findOne({ roomCode: 'ADMIN-CHAT' });
    if (!existing) {
      await Room.create({
        roomCode: 'ADMIN-CHAT',
        name: 'Admin Chat',
        description: 'Private chat for platform administrators.',
        isPublic: false,
        maxMembers: 50
      });
      logger.info('AdminChat room "ADMIN-CHAT" created');
    }
  } catch (error) {
    logger.error('Failed to create AdminChat room:', error.message);
  }
};

module.exports = { createGlobalRoom, createAdminChatRoom };
