const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  maxMembers: {
    type: Number,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

roomSchema.index({ roomCode: 1 }, { unique: true });
roomSchema.index({ isPublic: 1 });
roomSchema.index({ createdAt: -1 });

roomSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    roomCode: this.roomCode,
    name: this.name,
    description: this.description,
    memberCount: this.members.length,
    maxMembers: this.maxMembers,
    isPublic: this.isPublic,
    hasPassword: !!this.passwordHash,
    createdBy: this.createdBy?.toString(),
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Room', roomSchema);
