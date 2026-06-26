const mongoose = require('mongoose');

const blockedWordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

blockedWordSchema.index({ word: 1 }, { unique: true });

module.exports = mongoose.model('BlockedWord', blockedWordSchema);
