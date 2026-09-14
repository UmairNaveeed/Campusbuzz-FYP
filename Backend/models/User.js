import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows null values but enforces uniqueness for non-null values
  },
  startYear: {
    type: Number, // Batch start
  },
  endYear: {
    type: Number, // Batch end
  },
  department: {
    type: String, // Department name (e.g., "Computer Science", "Software Engineering")
  },
  startSemester: {
    type: String, // "Fall" or "Spring"
  },
  rollNumber: {
    type: String, // Roll number
  },
  bio: {
    type: String,
    maxlength: 160,
  },
  location: {
    type: String,
  },
  program: {
    type: String,
  },
  currentStatus: {
    type: String,
  },
  accountType: {
    type: String,
    enum: ['student', 'alumni'],
    default: 'student',
  },
  profilePhoto: {
    type: String, // URL to profile photo
  },
  coverPhoto: {
    type: String, // URL to cover photo
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
  }],
  media: [{
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  likedPosts: [{
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    postContent: {
      type: String,
      required: true,
    },
    postAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    postAuthorName: String,
    postAuthorUsername: String,
    likedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  commentedPosts: [{
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
    },
    postContent: {
      type: String,
      required: true,
    },
    commentContent: {
      type: String,
      required: true,
    },
    postAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    postAuthorName: String,
    postAuthorUsername: String,
    commentedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  sharedPosts: [{
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    share: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Share',
      required: true,
    },
    postContent: {
      type: String,
      required: true,
    },
    postAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    postAuthorName: String,
    postAuthorUsername: String,
    sharedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sharedWithName: String,
    sharedWithUsername: String,
    message: String,
    sharedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  receivedShares: [{
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    share: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Share',
      required: true,
    },
    postContent: {
      type: String,
      required: true,
    },
    postAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    postAuthorName: String,
    postAuthorUsername: String,
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sharedByName: String,
    sharedByUsername: String,
    message: String,
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// firebaseId and username already have unique/sparse in schema above (no duplicate index())

const User = mongoose.model('User', userSchema);

export default User;
