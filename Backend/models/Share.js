import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'viewed', 'accepted'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Index for sharedBy
shareSchema.index({ sharedBy: 1, createdAt: -1 });
// Index for sharedWith
shareSchema.index({ sharedWith: 1, createdAt: -1 });
// Index for post
shareSchema.index({ post: 1 });
// Prevent duplicate shares (same user sharing same post to same user)
shareSchema.index({ post: 1, sharedBy: 1, sharedWith: 1 }, { unique: true });

export default mongoose.model('Share', shareSchema);
