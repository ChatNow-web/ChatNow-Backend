const mongoose = require('mongoose');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'harinarayanantr.thoovara@gmail.com').toLowerCase();

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  firebaseUID: {
    type: String,
    unique: true,
    sparse: true
  },
  joinedRooms: [{
    type: String
  }],
  lastActive: {
    type: Date
  },
  bannedStatus: {
    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String }
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ firebaseUID: 1 }, { unique: true, sparse: true });
userSchema.index({ lastActive: -1 });

userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    joinedRooms: this.joinedRooms,
    isAdmin: this.isAdmin || (this.email && this.email.toLowerCase() === ADMIN_EMAIL),
    isBanned: this.bannedStatus?.isBanned || false,
    createdAt: this.createdAt,
    lastActive: this.lastActive
  };
};

module.exports = mongoose.model('User', userSchema);
