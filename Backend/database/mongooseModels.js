import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

function toJSONOptions() {
  return {
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
    },
    virtuals: true,
  };
}

function addIdVirtual(schema) {
  schema.virtual('id').get(function () { return this._id; });
}

// ----- User -----
const userSchema = new mongoose.Schema({
  firebaseId: { type: String, required: true, unique: true },
  email: { type: String, default: null, unique: true, sparse: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  username: { type: String, default: null, unique: true, sparse: true },
  startYear: Number,
  endYear: Number,
  department: String,
  startSemester: String,
  rollNumber: String,
  bio: String,
  location: String,
  program: String,
  currentStatus: String,
  profilePhoto: String,
  coverPhoto: String,
  accountType: {
    type: String,
    enum: ['student', 'alumni'],
    default: 'student',
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
  },
}, { timestamps: true, toJSON: toJSONOptions() });
addIdVirtual(userSchema);
export const User = mongoose.model('User', userSchema);

// ----- Post -----
const postSchema = new mongoose.Schema({
  authorId: { type: ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 280 },
  image: String,
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  reportsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  repostsCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  moderationFlagged: { type: Boolean, default: false },
  visibility: { type: String, default: 'public' },
  SentimentLabel: { type: String, default: 'neutral' },
  Confidence: { type: Number, default: 0 },
  Model: { type: String, default: 'twitter-xlm-roberta-base-sentiment' },
  ModelVersion: { type: String, default: '1.0' },
  hateSpeech: {
    isHateSpeech: { type: Boolean, default: false },
    label: { type: String, enum: ['normal', 'hate'], default: 'normal' },
    confidence: { type: Number, default: 0 },
    probabilities: {
      normal: { type: Number, default: 0 },
      hate: { type: Number, default: 0 },
    },
    model: {
      name: { type: String, default: 'Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned' },
      version: { type: String, default: '1.0.0' },
      accuracy: { type: String, default: '86.40%' },
      hateF1: { type: String, default: '67.34%' },
    },
    analyzedAt: { type: Date, default: null },
    adminReviewed: { type: Boolean, default: false },
  },
  analysisStatus: {
    sentimentCompleted: { type: Boolean, default: false },
    hateSpeechCompleted: { type: Boolean, default: false },
    lastAnalyzedAt: { type: Date, default: null },
  },
}, { timestamps: true, toJSON: toJSONOptions() });
addIdVirtual(postSchema);
export const Post = mongoose.model('Post', postSchema);

// ----- Comment -----
const commentSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  authorId: { type: ObjectId, ref: 'User', required: true },
  parentCommentId: { type: ObjectId, ref: 'Comment', default: null },
  content: { type: String, required: true, maxlength: 280 },
  likesCount: { type: Number, default: 0 },
  repliesCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true, toJSON: toJSONOptions() });
export const Comment = mongoose.model('Comment', commentSchema);

// ----- Hashtag -----
const hashtagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  postsCount: { type: Number, default: 0 },
  lastUsed: Date,
}, { timestamps: true, toJSON: toJSONOptions() });
export const Hashtag = mongoose.model('Hashtag', hashtagSchema);

// ----- Report -----
const reportSchema = new mongoose.Schema({
  reportedById: { type: ObjectId, ref: 'User', required: true },
  reportedItemId: { type: ObjectId, required: true },
  itemType: { type: String, enum: ['post', 'message', 'comment'], required: true },
  postId: { type: ObjectId, ref: 'Post', default: null },
  reason: { type: String, enum: ['spam', 'harassment', 'hate_speech', 'inappropriate_content', 'false_information', 'copyright_violation', 'other'], required: true },
  description: String,
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
  reviewedById: { type: ObjectId, ref: 'User', default: null },
  reviewedAt: Date,
}, { timestamps: true, toJSON: toJSONOptions() });
export const Report = mongoose.model('Report', reportSchema);

// ----- Share -----
const shareSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  sharedById: { type: ObjectId, ref: 'User', required: true },
  sharedWithId: { type: ObjectId, ref: 'User', required: true },
  message: String,
  status: { type: String, enum: ['pending', 'viewed', 'accepted'], default: 'pending' },
}, { timestamps: true, toJSON: toJSONOptions() });
shareSchema.index({ postId: 1, sharedById: 1, sharedWithId: 1 }, { unique: true });
shareSchema.index({ sharedWithId: 1, createdAt: -1 });
shareSchema.index({ sharedById: 1, createdAt: -1 });
addIdVirtual(shareSchema);
export const Share = mongoose.model('Share', shareSchema);

// ----- Repost -----
const repostSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: true, toJSON: toJSONOptions() });
repostSchema.index({ userId: 1, postId: 1 }, { unique: true });
repostSchema.index({ userId: 1, createdAt: -1 });
repostSchema.index({ postId: 1 });
addIdVirtual(repostSchema);
export const Repost = mongoose.model('Repost', repostSchema);

// ----- Conversation -----
// Used for: (1) Chats/DMs when isGroup=false, (2) Discussion forum groups when isGroup=true.
// Messaging module (/api/messaging) only uses isGroup=false. Discussion module (/api/discussion) only uses isGroup=true.
const conversationSchema = new mongoose.Schema({
  lastMessageId: { type: ObjectId, ref: 'Message', default: null },
  lastMessageAt: Date,
  status: { type: String, enum: ['pending', 'accepted'], default: 'accepted' },
  requestedById: { type: ObjectId, ref: 'User', default: null },
  acceptedAt: Date,
  isGroup: { type: Boolean, default: false },
  groupName: String,
  groupDescription: String,
  groupPhoto: String,
}, { timestamps: true, toJSON: toJSONOptions() });
addIdVirtual(conversationSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);

// ----- Message -----
// Every message is stored with conversationId = the specific chat (DM) or group (forum) it belongs to.
// Messaging module: only messages in conversations where isGroup=false. Discussion module: only isGroup=true.
const messageSchema = new mongoose.Schema({
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  senderId: { type: ObjectId, ref: 'User', required: true },
  content: String,
  mediaType: { type: String, enum: ['image', 'video'], default: null },
  mediaUrl: String,
  linkUrl: String,
  linkTitle: String,
  linkDescription: String,
  linkThumbnail: String,
  postId: { type: ObjectId, ref: 'Post', default: null }, // For shared posts
  deliveryStatus: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  isStarred: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  encrypted: { type: Boolean, default: false },
  encryptionKey: String,
  SentimentLabel: { type: String, default: null },
  Confidence: { type: Number, default: null },
}, { timestamps: true, toJSON: toJSONOptions() });
messageSchema.index({ conversationId: 1, createdAt: -1 }); // all messages scoped to their chat/group
addIdVirtual(messageSchema);
export const Message = mongoose.model('Message', messageSchema);

// ----- UserFollow -----
const userFollowSchema = new mongoose.Schema({
  followerId: { type: ObjectId, ref: 'User', required: true },
  followingId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
userFollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
export const UserFollow = mongoose.model('UserFollow', userFollowSchema);

// ----- PostLike -----
const postLikeSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
export const PostLike = mongoose.model('PostLike', postLikeSchema);

// ----- PostHashtag -----
const postHashtagSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  hashtagId: { type: ObjectId, ref: 'Hashtag', required: true },
}, { timestamps: false });
postHashtagSchema.index({ postId: 1, hashtagId: 1 }, { unique: true });
export const PostHashtag = mongoose.model('PostHashtag', postHashtagSchema);

// ----- PostMention -----
const postMentionSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
postMentionSchema.index({ postId: 1, userId: 1 }, { unique: true });
export const PostMention = mongoose.model('PostMention', postMentionSchema);

// ----- CommentLike -----
const commentLikeSchema = new mongoose.Schema({
  commentId: { type: ObjectId, ref: 'Comment', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });
export const CommentLike = mongoose.model('CommentLike', commentLikeSchema);

// ----- ConversationParticipant -----
const conversationParticipantSchema = new mongoose.Schema({
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
conversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
export const ConversationParticipant = mongoose.model('ConversationParticipant', conversationParticipantSchema);

// ----- ConversationBlockedBy -----
const conversationBlockedBySchema = new mongoose.Schema({
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  blockedAt: { type: Date, default: Date.now },
}, { timestamps: false });
export const ConversationBlockedBy = mongoose.model('ConversationBlockedBy', conversationBlockedBySchema);

// ----- ConversationDeletedBy -----
const conversationDeletedBySchema = new mongoose.Schema({
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
export const ConversationDeletedBy = mongoose.model('ConversationDeletedBy', conversationDeletedBySchema);

// ----- MessageReadBy -----
const messageReadBySchema = new mongoose.Schema({
  messageId: { type: ObjectId, ref: 'Message', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  readAt: { type: Date, default: Date.now },
}, { timestamps: false });
export const MessageReadBy = mongoose.model('MessageReadBy', messageReadBySchema);

// ----- MessageReaction -----
const messageReactionSchema = new mongoose.Schema({
  messageId: { type: ObjectId, ref: 'Message', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
}, { timestamps: true, updatedAt: false, toJSON: toJSONOptions() });
export const MessageReaction = mongoose.model('MessageReaction', messageReactionSchema);

// ----- MessageStarredBy -----
const messageStarredBySchema = new mongoose.Schema({
  messageId: { type: ObjectId, ref: 'Message', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
export const MessageStarredBy = mongoose.model('MessageStarredBy', messageStarredBySchema);

// ----- MessageDeletedBy -----
const messageDeletedBySchema = new mongoose.Schema({
  messageId: { type: ObjectId, ref: 'Message', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: false });
export const MessageDeletedBy = mongoose.model('MessageDeletedBy', messageDeletedBySchema);

// ----- PostReport (junction) -----
const postReportSchema = new mongoose.Schema({
  postId: { type: ObjectId, ref: 'Post', required: true },
  reportId: { type: ObjectId, ref: 'Report', required: true },
}, { timestamps: false });
export const PostReport = mongoose.model('PostReport', postReportSchema);

// ----- MessageReport (junction) -----
const messageReportSchema = new mongoose.Schema({
  messageId: { type: ObjectId, ref: 'Message', required: true },
  reportId: { type: ObjectId, ref: 'Report', required: true },
}, { timestamps: false });
export const MessageReport = mongoose.model('MessageReport', messageReportSchema);

// ----- GroupInvite -----
const groupInviteSchema = new mongoose.Schema({
  groupId: { type: ObjectId, ref: 'Conversation', required: true },
  invitedUserId: { type: ObjectId, ref: 'User', required: true },
  invitedById: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  respondedAt: Date,
}, { timestamps: true, toJSON: toJSONOptions() });
export const GroupInvite = mongoose.model('GroupInvite', groupInviteSchema);

// ----- GroupJoinRequest (user requests to join private group; admin accepts/rejects) -----
const groupJoinRequestSchema = new mongoose.Schema({
  groupId: { type: ObjectId, ref: 'Conversation', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  respondedAt: Date,
  respondedById: { type: ObjectId, ref: 'User' },
}, { timestamps: true, toJSON: toJSONOptions() });
groupJoinRequestSchema.index({ groupId: 1, userId: 1 }, { unique: true });
export const GroupJoinRequest = mongoose.model('GroupJoinRequest', groupJoinRequestSchema);

// ----- Notification -----
const notificationSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  actorId: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  readAt: Date,
  postId: { type: ObjectId, ref: 'Post', default: null },
  commentId: { type: ObjectId, ref: 'Comment', default: null },
  extra: String,
}, { timestamps: true, updatedAt: false, toJSON: toJSONOptions() });
export const Notification = mongoose.model('Notification', notificationSchema);

// ----- UserMedia -----
const userMediaSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  postId: { type: ObjectId, ref: 'Post', required: true },
  imageUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: false });
export const UserMedia = mongoose.model('UserMedia', userMediaSchema);

// ----- UserLikedPost -----
const userLikedPostSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  postId: { type: ObjectId, ref: 'Post', required: true },
  postContent: { type: String, required: true },
  postAuthorId: { type: ObjectId, ref: 'User', required: true },
  postAuthorName: String,
  postAuthorUsername: String,
  likedAt: { type: Date, default: Date.now },
}, { timestamps: false });
export const UserLikedPost = mongoose.model('UserLikedPost', userLikedPostSchema);

// ----- UserCommentedPost -----
const userCommentedPostSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  postId: { type: ObjectId, ref: 'Post', required: true },
  commentId: { type: ObjectId, ref: 'Comment', required: true },
  postContent: { type: String, required: true },
  commentContent: { type: String, required: true },
  postAuthorId: { type: ObjectId, ref: 'User', required: true },
  postAuthorName: String,
  postAuthorUsername: String,
  commentedAt: { type: Date, default: Date.now },
}, { timestamps: false });
export const UserCommentedPost = mongoose.model('UserCommentedPost', userCommentedPostSchema);

// ----- CustomList (personalized feed filters) -----
const customListSchema = new mongoose.Schema({
  ownerId: { type: ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 80, trim: true },
  description: { type: String, default: '', maxlength: 200, trim: true },
  memberIds: [{ type: ObjectId, ref: 'User' }],
}, { timestamps: true, toJSON: toJSONOptions() });
customListSchema.index({ ownerId: 1, createdAt: -1 });
customListSchema.index({ ownerId: 1, name: 1 });
addIdVirtual(customListSchema);
export const CustomList = mongoose.model('CustomList', customListSchema);

// ----- AdminCredential (hashed admin passwords) -----
const adminCredentialSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  pinHash: { type: String, default: null },
  pinResetCode: { type: String, default: null },
  pinResetCodeExpiresAt: { type: Date, default: null },
  emailVerificationToken: { type: String, default: null },
  emailVerificationExpires: { type: Date, default: null },
  emailVerified: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true, toJSON: toJSONOptions() });
addIdVirtual(adminCredentialSchema);
export const AdminCredential = mongoose.model('AdminCredential', adminCredentialSchema);

// ----- AlumniSignup (pending approvals) -----
const alumniSignupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  alumniEmail: { type: String, required: true },
  transcriptOriginalName: String,
  transcriptData: { type: Buffer },
  transcriptMime: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: Date,
  reviewedBy: String,
}, { timestamps: true, toJSON: toJSONOptions() });
addIdVirtual(alumniSignupSchema);
export const AlumniSignup = mongoose.model('AlumniSignup', alumniSignupSchema);
