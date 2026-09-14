import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    blockedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // Message request status (like Instagram)
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'accepted',
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acceptedAt: {
      type: Date,
    },
    // Mute functionality - users who have muted this conversation
    mutedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // Track which users have deleted/hidden this conversation (so it's hidden from their view only)
    deletedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // For group chats (future enhancement)
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: String,
    groupPhoto: String,
    groupDescription: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure unique conversations between two users
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Compound index for finding conversations by participants
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Index for status queries
conversationSchema.index({ status: 1, lastMessageAt: -1 });

// Index for requestedBy queries
conversationSchema.index({ requestedBy: 1, status: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema, 'conversations');

export default Conversation;
