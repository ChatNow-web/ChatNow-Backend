const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    index: true
  },
  sender: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    }
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  contentType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  attachmentURL: {
    type: String,
    default: null
  },
  attachmentMetadata: {
    filename: String,
    size: Number,
    mimeType: String
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  reactions: [{
    emoji: String,
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }]
}, {
  timestamps: true
});

messageSchema.index({ roomCode: 1, createdAt: -1 });
messageSchema.index({ 'sender.userId': 1 });
messageSchema.index({ createdAt: -1 });

messageSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    roomCode: this.roomCode,
    sender: this.sender,
    content: this.deletedAt ? null : this.content,
    contentType: this.contentType,
    attachmentURL: this.attachmentURL,
    attachmentMetadata: this.attachmentMetadata,
    isEdited: this.isEdited,
    editedAt: this.editedAt,
    isDeleted: !!this.deletedAt,
    reactions: this.reactions,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Message', messageSchema);
