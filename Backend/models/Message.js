import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: function() {
        return !this.media && !this.link;
      },
    },
    media: {
      type: {
        type: String, // 'image', 'video'
        enum: ['image', 'video'],
      },
      url: String,
    },
    link: {
      url: String,
      title: String,
      description: String,
      thumbnail: String,
    },
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      emoji: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    deliveryStatus: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    starredBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    reports: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    }],
    // End-to-end encryption metadata
    encrypted: {
      type: Boolean,
      default: false,
    },
    encryptionKey: String, // Reference to encryption key (not the actual key)
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'starredBy': 1 });
messageSchema.index({ content: 'text' }); // Text search index

const Message = mongoose.model('Message', messageSchema, 'messages');

export default Message;
