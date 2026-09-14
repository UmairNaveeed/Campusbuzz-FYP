import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    itemType: {
      type: String,
      enum: ['post', 'message', 'comment'],
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'spam',
        'harassment',
        'hate_speech',
        'inappropriate_content',
        'false_information',
        'copyright_violation',
        'other'
      ],
    },
    description: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for post
reportSchema.index({ post: 1 });
// Index for reportedBy
reportSchema.index({ reportedBy: 1 });
// Index for status
reportSchema.index({ status: 1 });
// Prevent duplicate reports from same user for same post
reportSchema.index({ reportedBy: 1, post: 1 }, { unique: true });

export default mongoose.model('Report', reportSchema);
