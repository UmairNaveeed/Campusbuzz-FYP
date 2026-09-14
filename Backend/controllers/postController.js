import mongoose from 'mongoose';
import {
  Post,
  User,
  Comment,
  Hashtag,
  Report,
  Share,
  Repost,
  PostLike,
  PostHashtag,
  PostMention,
  PostReport,
  CommentLike,
  UserMedia,
  UserLikedPost,
  UserCommentedPost,
  UserFollow,
  Message,
  Conversation,
  ConversationParticipant,
  ConversationDeletedBy,
} from '../database/index.js';
import { getUserByFirebaseId } from '../utils/dbHelpers.js';
import { parseRollNumber } from '../utils/rollNumberParser.js';
import {
  normalizeTopic,
  buildTopicContentOrClauses,
  contentMatchesTopic,
} from '../utils/topicMatch.js';
import { getAuthorIdsForDepartment } from '../utils/departmentAuthors.js';
import { createNotification } from '../utils/createNotification.js';
import { analyzeSentiment } from '../utils/sentimentAnalysis.js';
import {
  filterPostsForViewer,
  isHateSpeechPost,
  isPostVisibleToViewer,
  excludeAllHateSpeechFilter,
} from '../utils/hateSpeechFilter.js';

const CONTENT_WARNING_MESSAGE =
  'Your post contains inappropriate/hate content and will not be visible to anyone.';
import { Notification } from '../database/index.js';

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract hashtags from text
 * @param {string} text - The text content
 * @returns {Array<string>} - Array of hashtag names (without #)
 */
const extractHashtags = (text) => {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  
  // Return hashtags without # and in lowercase
  return matches.map(tag => tag.slice(1).toLowerCase());
};

/**
 * Extract mentions from text
 * @param {string} text - The text content
 * @returns {Array<string>} - Array of usernames (without @)
 */
const extractMentions = (text) => {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  
  // Return usernames without @
  return matches.map(mention => mention.slice(1));
};

function isValidId(id) {
  if (!id) return false;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && String(id).length === 24) return true;
  const n = parseInt(String(id), 10);
  return Number.isInteger(n) && n > 0;
}

/** Fields returned on post authors (feed, profile, reposts). */
export const AUTHOR_PUBLIC_FIELDS = 'name username firebaseId profilePhoto department program';
const AUTHOR_PUBLIC_FIELDS_WITH_ID = `id ${AUTHOR_PUBLIC_FIELDS}`;

function resolveAuthorId(authorLike) {
  if (!authorLike || typeof authorLike !== 'object') return null;
  return authorLike._id || authorLike.id || null;
}

function resolvePostAuthorObjectId(post) {
  if (!post) return null;
  const fromAuthor = resolveAuthorId(post.author);
  if (fromAuthor) return fromAuthor;
  const raw = post.authorId;
  if (raw && typeof raw === 'object') return raw._id || raw.id || null;
  if (raw) return raw;
  return null;
}

/** Ensure department/program are present even when populate omitted them (e.g. reposts). */
export async function enrichPostsWithAuthorDetails(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;

  const ids = new Set();
  for (const p of posts) {
    const id = resolveAuthorId(p.author) || resolveAuthorId(p.authorId);
    if (id) ids.add(id);
  }
  if (ids.size === 0) return posts;

  const users = await User.find({ _id: { $in: [...ids] } })
    .select('_id department program')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return posts.map((p) => {
    const raw =
      p.author && typeof p.author === 'object' && p.author.name != null
        ? p.author
        : p.authorId;
    const id = resolveAuthorId(raw);
    if (!id) return p;
    const u = byId.get(String(id));
    if (!u) return p;
    const department = raw?.department || u.department || u.program || null;
    const author =
      typeof raw === 'object' && raw !== null
        ? { ...raw, department, program: raw.program || u.program || null }
        : { ...u, id: u._id };
    return { ...p, author };
  });
}

// ==================== FR-3.1: CREATE POST ====================
// ==================== FR-3.1: CREATE POST (UPDATED with Hate Speech) ====================

export const createPost = async (req, res) => {
  console.log('🚀🚀🚀 [DEBUG] createPost FUNCTION WAS CALLED 🚀🚀🚀');
  console.log('📝 Request body:', req.body);
  
  try {
    const { content, image, visibility: visibilityInput } = req.body;
    const normalizedContent = (content || '').trim();
    const visibility = visibilityInput === 'private' ? 'private' : 'public';

    if (!normalizedContent && !image) {
      return res.status(400).json({ error: 'Post content or image is required' });
    }

    if (normalizedContent.length > 280) {
      return res.status(400).json({ error: 'Post content must be 280 characters or less' });
    }

    let user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      const { email, name } = req.user || {};
      const rollData = email ? parseRollNumber(email) : null;
      user = await User.create({
        firebaseId: req.user.uid,
        email: email || null,
        name: name || 'User',
        ...(rollData || {}),
      });
    }

    const hashtags = extractHashtags(normalizedContent);
    const mentionUsernames = extractMentions(normalizedContent);

    const mentionedUsers = [];
    if (mentionUsernames.length > 0) {
      const users = await User.find({ username: { $in: mentionUsernames } }).select('_id').lean();
      mentionedUsers.push(...users.map(u => u._id));
    }

    // ✅ TWO-STAGE ML ANALYSIS (Hate Speech → Sentiment)
    const analysisResult = await analyzeSentiment(normalizedContent);

    console.log('🔍 ========== ANALYSIS RESULT ==========');
    console.log('Text:', normalizedContent);
    console.log('is_hate_speech:', analysisResult.is_hate_speech);
    console.log('hate_label:', analysisResult.hate_label);
    console.log('hate_confidence:', analysisResult.hate_confidence);
    console.log('sentiment_label:', analysisResult.sentiment_label);
    console.log('=========================================');

    // Create post with analysis results
    const post = await Post.create({
      content: normalizedContent,
      image: image || null,
      authorId: user._id,
      visibility,
      likesCount: 0,
      commentsCount: 0,
      reportsCount: 0,
      
      // Legacy sentiment fields (for backward compatibility)
      SentimentLabel: analysisResult.sentiment_label,
      Confidence: Math.round(analysisResult.sentiment_confidence * 100),
      Model: analysisResult.model,
      ModelVersion: '2.0',
      
      // New hate speech fields
      hateSpeech: {
        isHateSpeech: analysisResult.is_hate_speech,
        label: analysisResult.hate_label,
        confidence: Math.round(analysisResult.hate_confidence * 100),
        probabilities: {
          normal: Math.round(analysisResult.hate_probabilities.normal * 100),
          hate: Math.round(analysisResult.hate_probabilities.hate * 100)
        },
        model: {
          name: 'Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned',
          version: '1.0.0',
          accuracy: '86.40%',
          hateF1: '67.34%'
        },
        analyzedAt: new Date()
      },
      
      // Analysis status
      analysisStatus: {
        sentimentCompleted: !analysisResult.is_hate_speech,
        hateSpeechCompleted: true,
        lastAnalyzedAt: new Date()
      },

      moderationFlagged: !!analysisResult.is_hate_speech,
    });

    // Handle mentions
    if (mentionedUsers.length > 0) {
      await PostMention.insertMany(mentionedUsers.map(uid => ({ postId: post._id, userId: uid })));
      for (const mentionedUserId of mentionedUsers) {
        if (String(mentionedUserId) !== String(user._id)) {
          await createNotification(
            { Notification },
            mentionedUserId,
            user._id,
            'mention',
            { postId: post._id }
          );
        }
      }
    }

    // Handle hashtags
    if (hashtags.length > 0) {
      for (const tag of hashtags) {
        let hashtag = await Hashtag.findOne({ name: tag });
        if (!hashtag) {
          hashtag = await Hashtag.create({ name: tag, postsCount: 0 });
        }
        await Hashtag.updateOne(
          { _id: hashtag._id },
          { $inc: { postsCount: 1 }, lastUsed: new Date() }
        );
        const exists = await PostHashtag.findOne({ postId: post._id, hashtagId: hashtag._id });
        if (!exists) await PostHashtag.create({ postId: post._id, hashtagId: hashtag._id });
      }
    }

    // Handle image
    if (image) {
      await UserMedia.create({ userId: user._id, postId: post._id, imageUrl: image });
    }

    const populatedPost = await Post.findById(post._id)
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .lean();
    const mentionUsers = await User.find({ _id: { $in: mentionedUsers } }).select('name username firebaseId profilePhoto').lean();
    const out = populatedPost ? { ...populatedPost, author: populatedPost.authorId, mentions: mentionUsers } : post.toObject ? post.toObject() : post;
    if (out.authorId && !out.author) out.author = out.authorId;
    if (!out.id && out._id) out.id = out._id;
    
    // Log hate speech detection and notify the author
    if (analysisResult.is_hate_speech) {
      console.log(`⚠️ HATE SPEECH DETECTED in post ${post._id}: "${normalizedContent.substring(0, 50)}..."`);
      try {
        await Notification.create({
          userId: user._id,
          actorId: user._id,
          type: 'content_warning',
          postId: post._id,
          extra: CONTENT_WARNING_MESSAGE,
        });
      } catch (notifErr) {
        console.error('Failed to create hate speech warning notification:', notifErr.message);
      }
    }
    
    res.status(201).json({
      success: true,
      post: out,
      analysis: {
        is_hate_speech: analysisResult.is_hate_speech,
        sentiment: analysisResult.sentiment_label,
        stage: analysisResult.analysis_stage
      }
    });
    
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
};



// export const createPost = async (req, res) => {
//   try {
//     const { content, image, visibility: visibilityInput } = req.body;
//     const normalizedContent = (content || '').trim();
//     const visibility = visibilityInput === 'private' ? 'private' : 'public';

//     // Allow text-only or image-only posts
//     if (!normalizedContent && !image) {
//       return res.status(400).json({ error: 'Post content or image is required' });
//     }

//     if (normalizedContent.length > 280) {
//       return res.status(400).json({ error: 'Post content must be 280 characters or less' });
//     }

//     let user = await getUserByFirebaseId(req.user.uid);
//     if (!user) {
//       const { email, name } = req.user || {};
//       const rollData = email ? parseRollNumber(email) : null;
//       user = await User.create({
//         firebaseId: req.user.uid,
//         email: email || null,
//         name: name || 'User',
//         ...(rollData || {}),
//       });
//     }

//     const hashtags = extractHashtags(normalizedContent);
//     const mentionUsernames = extractMentions(normalizedContent);

//     const mentionedUsers = [];
//     if (mentionUsernames.length > 0) {
//       const users = await User.find({ username: { $in: mentionUsernames } }).select('_id').lean();
//       mentionedUsers.push(...users.map(u => u._id));
//     }

//     // Analyze sentiment using Flask ML service
//     const sentimentResult = await analyzeSentiment(normalizedContent);

//     const post = await Post.create({
//       content: normalizedContent,
//       image: image || null,
//       authorId: user._id,
//       visibility,
//       likesCount: 0,
//       commentsCount: 0,
//       reportsCount: 0,
//       yalla: 0,
//       SentimentLabel: sentimentResult.sentiment_label,
//       Confidence: sentimentResult.confidence,
//       Model: sentimentResult.model,
//       ModelVersion: sentimentResult.model_version
//     });

//     if (mentionedUsers.length > 0) {
//       await PostMention.insertMany(mentionedUsers.map(uid => ({ postId: post._id, userId: uid })));
//       for (const mentionedUserId of mentionedUsers) {
//         if (String(mentionedUserId) !== String(user._id)) {
//           await createNotification(
//             { Notification },
//             mentionedUserId,
//             user._id,
//             'mention',
//             { postId: post._id }
//           );
//         }
//       }
//     }

//     if (hashtags.length > 0) {
//       for (const tag of hashtags) {
//         let hashtag = await Hashtag.findOne({ name: tag });
//         if (!hashtag) {
//           hashtag = await Hashtag.create({ name: tag, postsCount: 0 });
//         }
//         await Hashtag.updateOne(
//           { _id: hashtag._id },
//           { $inc: { postsCount: 1 }, lastUsed: new Date() }
//         );
//         const exists = await PostHashtag.findOne({ postId: post._id, hashtagId: hashtag._id });
//         if (!exists) await PostHashtag.create({ postId: post._id, hashtagId: hashtag._id });
//       }
//     }

//     if (image) {
//       await UserMedia.create({ userId: user._id, postId: post._id, imageUrl: image });
//     }

//     const populatedPost = await Post.findById(post._id)
//       .populate('authorId', AUTHOR_PUBLIC_FIELDS)
//       .lean();
//     const mentionUsers = await User.find({ _id: { $in: mentionedUsers } }).select('name username firebaseId profilePhoto').lean();
//     const out = populatedPost ? { ...populatedPost, author: populatedPost.authorId, mentions: mentionUsers } : post.toObject ? post.toObject() : post;
//     if (out.authorId && !out.author) out.author = out.authorId;
//     if (!out.id && out._id) out.id = out._id;
//     res.status(201).json({
//       success: true,
//       post: out,
//     });
//   } catch (error) {
//     console.error('Create post error:', error);
//     res.status(500).json({ error: 'Failed to create post', details: error.message });
//   }
// };

// ==================== UPDATE POST ====================

export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, image } = req.body;

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    if (content.length > 280) {
      return res.status(400).json({ error: 'Post content must be 280 characters or less' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only update your own posts' });
    }

    const newHashtags = extractHashtags(content);
    const mentionUsernames = extractMentions(content);

    const mentionedUsers = [];
    if (mentionUsernames.length > 0) {
      const users = await User.find({ username: { $in: mentionUsernames } }).select('_id').lean();
      mentionedUsers.push(...users.map(u => u._id));
    }

    const oldHashtagRows = await PostHashtag.find({ postId: post._id }).populate('hashtagId', 'name').lean();
    const oldHashtags = oldHashtagRows.map(r => r.hashtagId?.name).filter(Boolean);

    const trimmedContent = content.trim();
    const contentChanged = post.content !== trimmedContent;
    post.content = trimmedContent;
    if (image !== undefined) post.image = image || null;

    if (contentChanged && trimmedContent) {
      try {
        const analysisResult = await analyzeSentiment(trimmedContent);
        post.SentimentLabel = analysisResult.sentiment_label;
        post.Confidence = Math.round(analysisResult.sentiment_confidence * 100);
        post.Model = analysisResult.model;
        if (post.hateSpeech) {
          post.hateSpeech.isHateSpeech = !!analysisResult.is_hate_speech;
          post.hateSpeech.label = analysisResult.hate_label;
          post.hateSpeech.confidence = Math.round(analysisResult.hate_confidence * 100);
        }
      } catch (sentimentErr) {
        console.error('Failed to re-analyze sentiment on post update:', sentimentErr.message);
      }
    }
    await post.save();

    await PostHashtag.deleteMany({ postId: post._id });
    await PostMention.deleteMany({ postId: post._id });

    for (const tag of oldHashtags) {
      await Hashtag.updateOne({ name: tag }, { $inc: { postsCount: -1 } });
    }
    for (const tag of newHashtags) {
      let hashtag = await Hashtag.findOne({ name: tag });
      if (!hashtag) hashtag = await Hashtag.create({ name: tag, postsCount: 0 });
      await Hashtag.updateOne({ _id: hashtag._id }, { $inc: { postsCount: 1 }, lastUsed: new Date() });
      await PostHashtag.create({ postId: post._id, hashtagId: hashtag._id });
    }
    if (mentionedUsers.length > 0) {
      await PostMention.insertMany(mentionedUsers.map(uid => ({ postId: post._id, userId: uid })));
    }

    if (image !== undefined) {
      if (image) {
        const mediaExists = await UserMedia.findOne({ userId: user._id, postId: post._id });
        if (mediaExists) {
          await UserMedia.updateOne({ _id: mediaExists._id }, { imageUrl: image });
        } else {
          await UserMedia.create({ userId: user._id, postId: post._id, imageUrl: image });
        }
      } else {
        await UserMedia.deleteOne({ userId: user._id, postId: post._id });
      }
    }

    const updatedPost = await Post.findById(post._id)
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .lean();
    const mentionList = mentionedUsers.length ? await User.find({ _id: { $in: mentionedUsers } }).select('name username firebaseId profilePhoto').lean() : [];
    const out = { ...updatedPost, author: updatedPost.authorId, mentions: mentionList };
    if (out.authorId && !out.author) out.author = out.authorId;
    if (!out.id && out._id) out.id = out._id;

    res.json({
      success: true,
      post: out,
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post', details: error.message });
  }
};

// ==================== UPDATE POST VISIBILITY ====================

export const updatePostVisibility = async (req, res) => {
  try {
    const { postId } = req.params;
    const { visibility: visibilityInput } = req.body;
    const visibility = visibilityInput === 'private' ? 'private' : 'public';

    const parsedId = parseInt(postId, 10);
    if (Number.isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const post = await Post.findById(parsedId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.authorId !== user.id) {
      return res.status(403).json({ error: 'You can only change visibility of your own posts' });
    }

    await post.update({ visibility });
    const out = post.toJSON ? post.toJSON() : post;
    out._id = out.id;
    res.json({ success: true, post: out });
  } catch (error) {
    console.error('Update post visibility error:', error);
    res.status(500).json({ error: 'Failed to update visibility', details: error.message });
  }
};

// ==================== DELETE POST ====================

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the post
    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    const postHashtags = await PostHashtag.find({ postId: post._id }).select('hashtagId').lean();

    await Post.updateOne({ _id: post._id }, { isDeleted: true });
    await Comment.updateMany({ postId: post._id }, { isDeleted: true });

    await Promise.all([
      UserMedia.deleteMany({ postId: post._id }),
      PostLike.deleteMany({ postId: post._id }),
      PostMention.deleteMany({ postId: post._id }),
      Share.deleteMany({ postId: post._id }),
      UserLikedPost.deleteMany({ postId: post._id }),
      UserCommentedPost.deleteMany({ postId: post._id }),
      PostHashtag.deleteMany({ postId: post._id }),
    ]);

    const hashtagIds = [...new Set(postHashtags.map((ph) => ph.hashtagId).filter(Boolean))];
    if (hashtagIds.length > 0) {
      const tags = await Hashtag.find({ _id: { $in: hashtagIds } }).select('postsCount').lean();
      for (const tag of tags) {
        await Hashtag.updateOne(
          { _id: tag._id },
          { postsCount: Math.max(0, (tag.postsCount || 0) - 1) }
        );
      }
    }

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post', details: error.message });
  }
};

// ==================== FR-3.2: LIKE/UNLIKE POST ====================

export const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) return res.status(404).json({ error: 'Post not found' });
    if (isHateSpeechPost(post)) {
      return res.status(403).json({ error: 'Interactions are disabled on flagged posts' });
    }

    const likeRow = await PostLike.findOne({ postId, userId: user._id });
    const isLiked = !!likeRow;

    if (isLiked) {
      await PostLike.deleteOne({ postId, userId: user._id });
      await Post.updateOne({ _id: post._id }, { $inc: { likesCount: -1 } });
      const updated = await Post.findById(postId).select('likesCount').lean();
      res.json({ success: true, isLiked: false, likesCount: updated?.likesCount ?? 0 });
    } else {
      await PostLike.create({ postId: post._id, userId: user._id });
      await Post.updateOne({ _id: post._id }, { $inc: { likesCount: 1 } });
      
      // Get all users who reposted this post
      const reposts = await Repost.find({ postId: post._id }).select('userId').lean();
      const reposterIds = reposts.map(r => String(r.userId)).filter(Boolean);
      
      // Send notification to original author (if not the person who liked it)
      if (String(post.authorId) !== String(user._id)) {
        await createNotification(
          { Notification },
          post.authorId,
          user._id,
          'like',
          { postId: post._id }
        );
      }
      
      // Send notifications to all users who reposted this post (if not the person who liked it)
      for (const reposterId of reposterIds) {
        if (reposterId !== String(user._id) && reposterId !== String(post.authorId)) {
          await createNotification(
            { Notification },
            reposterId,
            user._id,
            'like',
            { 
              postId: post._id,
              extra: JSON.stringify({ isRepostLike: true }) // Mark this as a like on a reposted post
            }
          );
        }
      }
      
      const updated = await Post.findById(postId).select('likesCount').lean();
      res.json({ success: true, isLiked: true, likesCount: updated?.likesCount ?? 0 });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like/unlike post', details: error.message });
  }
};

// ==================== FR-3.3 & FR-3.4: COMMENTS & REPLIES ====================

export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;

    console.log('📝 Creating comment for postId:', postId);
    console.log('📝 Content:', content);
    console.log('📝 Parent comment ID:', parentCommentId);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    if (content.length > 280) {
      return res.status(400).json({ error: 'Comment must be 280 characters or less' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      console.error('❌ User not found for uid:', req.user.uid);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (isHateSpeechPost(post)) {
      return res.status(403).json({ error: 'Comments are disabled on flagged posts' });
    }

    let parentComment = null;
    if (parentCommentId && isValidId(parentCommentId)) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment || parentComment.isDeleted) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      if (String(parentComment.postId) !== String(post._id)) {
        return res.status(400).json({ error: 'Parent comment does not belong to this post' });
      }
    }

    const commentData = {
      content: content.trim(),
      authorId: user._id,
      postId: post._id,
      likesCount: 0,
      repliesCount: 0,
      ...(parentComment ? { parentCommentId: parentComment._id } : {}),
    };

    const comment = await Comment.create(commentData);

    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });

    const postAuthor = await User.findById(post.authorId).select('name username').lean();
    try {
      await UserCommentedPost.create({
        userId: user._id,
        postId: post._id,
        commentId: comment._id,
        postContent: (post.content || '').substring(0, 280),
        commentContent: content.trim().substring(0, 280),
        postAuthorId: post.authorId,
        postAuthorName: (postAuthor?.name || 'Unknown').substring(0, 255),
        postAuthorUsername: postAuthor?.username ? String(postAuthor.username).substring(0, 100) : null,
        commentedAt: new Date(),
      });
    } catch (_) {}

    if (parentComment) {
      await Comment.updateOne({ _id: parentComment._id }, { $inc: { repliesCount: 1 } });
    }

    if (post.authorId.toString() !== user._id.toString()) {
      await createNotification(
        { Notification },
        post.authorId,
        user._id,
        parentComment ? 'reply' : 'comment',
        { postId: post._id, commentId: comment._id }
      );
    }

    // Get all users who reposted this post
    const reposts = await Repost.find({ postId: post._id }).select('userId').lean();
    const reposterIds = reposts.map(r => String(r.userId)).filter(Boolean);
    
    // Send notifications to all users who reposted this post (if not the person who commented and not the original author)
    for (const reposterId of reposterIds) {
      if (reposterId !== String(user._id) && reposterId !== String(post.authorId)) {
        await createNotification(
          { Notification },
          reposterId,
          user._id,
          parentComment ? 'reply' : 'comment',
          { 
            postId: post._id, 
            commentId: comment._id,
            extra: JSON.stringify({ isRepostComment: true }) // Mark this as a comment on a reposted post
          }
        );
      }
    }

    let populatedComment = await Comment.findById(comment._id)
      .populate('authorId', AUTHOR_PUBLIC_FIELDS_WITH_ID)
      .lean();
    let parentCommentData = null;
    if (comment.parentCommentId) {
      const parent = await Comment.findById(comment.parentCommentId)
        .populate('authorId', 'id name username')
        .lean();
      if (parent) parentCommentData = { ...parent, author: parent.authorId };
    }

    const responseData = populatedComment ? { ...populatedComment, author: populatedComment.authorId, id: populatedComment._id } : comment.toObject ? comment.toObject() : comment;
    // Ensure _id is set for frontend compatibility
    if (!responseData._id) {
      responseData._id = responseData.id;
    }
    
    if (parentCommentData) responseData.parentComment = parentCommentData;
    if (!responseData._id && responseData.id) responseData._id = responseData.id;

    res.status(201).json({
      success: true,
      comment: responseData,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment', details: error.message });
  }
};

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const allCommentsForPost = await Comment.countDocuments({
      postId: post._id,
      isDeleted: false,
    });

    const topLevelComments = await Comment.find({
      postId: post._id,
      parentCommentId: null,
      isDeleted: false,
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS_WITH_ID)
      .sort({ created_at: -1 })
      .limit(Math.min(parseInt(limit) || 20, 50))
      .skip(parseInt(skip) || 0)
      .lean();

    if (topLevelComments.length === 0) {
      return res.json({ success: true, comments: [], count: 0 });
    }

    const topIds = topLevelComments.map((c) => c._id);
    const allReplies = await Comment.find({
      parentCommentId: { $in: topIds },
      isDeleted: false,
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS_WITH_ID)
      .sort({ created_at: 1 })
      .lean();

    const repliesByParent = new Map();
    for (const reply of allReplies) {
      const pid = reply.parentCommentId?.toString?.() ?? reply.parentCommentId;
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
      if (repliesByParent.get(pid).length < 10) {
        const replyJson = { ...reply, _id: reply._id, id: reply._id, author: reply.authorId };
        if (reply.created_at && !reply.createdAt) replyJson.createdAt = reply.created_at;
        repliesByParent.get(pid).push(replyJson);
      }
    }

    const commentsWithReplies = topLevelComments.map((comment) => {
      const commentJson = { ...comment, _id: comment._id, id: comment._id, author: comment.authorId };
      if (comment.created_at && !comment.createdAt) commentJson.createdAt = comment.created_at;
      const formattedReplies = (repliesByParent.get(comment._id?.toString?.() ?? comment._id) || []).map(reply => {
        const replyJson = reply;
        if (replyJson.author) {
          if (!replyJson.author._id && replyJson.author.id) {
            replyJson.author._id = replyJson.author.id;
          }
        }
        return replyJson;
      });
      return {
        ...commentJson,
        replies: formattedReplies,
        repliesCount: formattedReplies.length || commentJson.repliesCount || 0,
      };
    });

    console.log(`✅ Returning ${commentsWithReplies.length} comments for post ${postId}`);
    if (commentsWithReplies.length > 0) {
      const firstComment = commentsWithReplies[0];
      console.log('📤 First comment sample:', {
        id: firstComment.id,
        _id: firstComment._id,
        content: firstComment.content?.substring(0, 50),
        author: firstComment.author?.name,
        repliesCount: firstComment.repliesCount || firstComment.replies?.length || 0,
        repliesLength: firstComment.replies?.length || 0,
        hasReplies: !!firstComment.replies && firstComment.replies.length > 0,
        createdAt: firstComment.createdAt || firstComment.created_at,
      });
      if (firstComment.replies && firstComment.replies.length > 0) {
        console.log('📤 First reply sample:', {
          id: firstComment.replies[0].id,
          _id: firstComment.replies[0]._id,
          content: firstComment.replies[0].content?.substring(0, 30),
          author: firstComment.replies[0].author?.name,
        });
      }
    } else {
      console.log('📤 No comments to return');
    }
    
    res.json({
      success: true,
      comments: commentsWithReplies,
      count: commentsWithReplies.length,
    });
  } catch (error) {
    console.error('❌ Get comments error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to fetch comments', 
      details: error.message,
    });
  }
};

export const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    if (!isValidId(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const parentComment = await Comment.findById(commentId);
    if (!parentComment || parentComment.isDeleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const replies = await Comment.find({
      parentCommentId: parentComment._id,
      isDeleted: false,
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS_WITH_ID)
      .sort({ createdAt: 1 })
      .limit(Math.min(parseInt(limit) || 20, 50))
      .skip(parseInt(skip) || 0)
      .lean();

    const repliesData = replies.map(reply => ({
      ...reply,
      _id: reply._id,
      id: reply._id,
      author: reply.authorId,
      createdAt: reply.createdAt || reply.created_at,
    }));

    res.json({
      success: true,
      replies: repliesData,
      count: repliesData.length,
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ error: 'Failed to fetch replies', details: error.message });
  }
};

export const likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!isValidId(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find comment using Sequelize
    const comment = await Comment.findById(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const existingLike = await CommentLike.findOne({
      commentId: comment._id,
      userId: user._id,
    });

    let isLiked;
    if (existingLike) {
      await CommentLike.deleteOne({ _id: existingLike._id });
      await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: -1 } });
      isLiked = false;
    } else {
      await CommentLike.create({ commentId: comment._id, userId: user._id });
      await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: 1 } });
      isLiked = true;
      
      // Create notification for comment author (if not liking own comment)
      if (comment.authorId.toString() !== user._id.toString()) {
        await createNotification(
          { Notification },
          comment.authorId,
          user._id,
          'comment_like',
          { postId: comment.postId, commentId: comment._id }
        );
      }
    }

    const updated = await Comment.findById(commentId).select('likesCount').lean();
    res.json({
      success: true,
      isLiked,
      likesCount: updated?.likesCount ?? 0,
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Failed to like/unlike comment', details: error.message });
  }
};

// ==================== FR-3.5: HASHTAGS ====================

export const getPostsByHashtag = async (req, res) => {
  try {
    const { hashtag } = req.params;
    const { limit = 50, skip = 0, departmentId } = req.query;

    if (!hashtag) {
      return res.status(400).json({ error: 'Hashtag is required' });
    }

    const normalizedHashtag = normalizeTopic(decodeURIComponent(String(hashtag)));

    if (!normalizedHashtag) {
      return res.status(400).json({ error: 'Hashtag is required' });
    }

    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 50);
    const parsedSkip = parseInt(skip, 10) || 0;

    const user = await getUserByFirebaseId(req.user.uid);

    const baseFilter = { isDeleted: false };
    const deptId = String(departmentId || '').trim();
    if (deptId) {
      const authorIds = await getAuthorIdsForDepartment(deptId);
      if (!authorIds?.length) {
        return res.json({
          success: true,
          posts: [],
          count: 0,
          hashtag: normalizedHashtag,
          departmentId: deptId,
        });
      }
      baseFilter.authorId = { $in: authorIds };
    }

    const matchedIdSet = new Set();

    const hashtagDoc = await Hashtag.findOne({ name: normalizedHashtag });
    if (hashtagDoc) {
      const postIdRows = await PostHashtag.find({ hashtagId: hashtagDoc._id }).select('postId').lean();
      for (const r of postIdRows) {
        if (r.postId) matchedIdSet.add(String(r.postId));
      }
    }

    const contentOr = buildTopicContentOrClauses(normalizedHashtag);
    if (contentOr.length) {
      const contentMatches = await Post.find({
        ...baseFilter,
        $or: contentOr,
      })
        .select('_id content')
        .limit(800)
        .lean();

      for (const p of contentMatches) {
        if (contentMatchesTopic(p.content, normalizedHashtag)) {
          matchedIdSet.add(String(p._id));
        }
      }
    }

    if (!matchedIdSet.size) {
      const pool = await Post.find(baseFilter)
        .select('_id content')
        .sort({ createdAt: -1 })
        .limit(deptId ? 2000 : 500)
        .lean();
      for (const p of pool) {
        if (contentMatchesTopic(p.content, normalizedHashtag)) {
          matchedIdSet.add(String(p._id));
        }
      }
    }

    const allIds = [...matchedIdSet];
    const totalCount = allIds.length;

    let posts = allIds.length
      ? await Post.find({ _id: { $in: allIds }, ...baseFilter, ...excludeAllHateSpeechFilter() })
          .populate('authorId', AUTHOR_PUBLIC_FIELDS)
          .sort({ createdAt: -1 })
          .limit(parsedLimit)
          .skip(parsedSkip)
          .lean()
      : [];

    if (user?._id) {
      posts = filterPostsForViewer(posts);
    } else {
      posts = posts.filter((p) => !isHateSpeechPost(p));
    }

    const pagePostIds = posts.map((p) => p._id).filter(Boolean);
    let postsWithLikes = posts.map((p) => ({ ...p, author: p.authorId, isLiked: false }));
    if (user && pagePostIds.length > 0) {
      const likedPostIds = await PostLike.find({ userId: user._id, postId: { $in: pagePostIds } })
        .select('postId')
        .lean();
      const likedSet = new Set(likedPostIds.map((r) => String(r.postId)));
      postsWithLikes = postsWithLikes.map((p) => ({ ...p, isLiked: likedSet.has(String(p._id)) }));
    }

    res.json({
      success: true,
      posts: postsWithLikes,
      count: totalCount,
      hashtag: normalizedHashtag,
      ...(deptId ? { departmentId: deptId } : {}),
    });
  } catch (error) {
    console.error('Get posts by hashtag error:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
};

export const getTrendingHashtags = async (req, res) => {
  try {
    const parsed = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200;

    const hashtags = await Hashtag.find()
      .sort({ postsCount: -1, lastUsed: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      hashtags,
    });
  } catch (error) {
    console.error('Get trending hashtags error:', error);
    res.status(500).json({ error: 'Failed to fetch trending hashtags', details: error.message });
  }
};

export const searchHashtags = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || !String(q).trim()) {
      return res.json({ success: true, hashtags: [] });
    }

    const query = String(q).trim().toLowerCase();
    
    // Search for hashtags that start with the query
    const hashtags = await Hashtag.find({
      name: { $regex: `^${query}`, $options: 'i' }
    })
      .sort({ postsCount: -1, lastUsed: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      hashtags,
    });
  } catch (error) {
    console.error('Search hashtags error:', error);
    res.status(500).json({ error: 'Failed to search hashtags', details: error.message });
  }
};

// ==================== FR-3.6: MENTIONS ====================

export const getPostsByMention = async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findOne({ username }).select('_id').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mentionRows = await PostMention.find({ userId: user._id }).select('postId').lean();
    const postIds = [...new Set(mentionRows.map((r) => r.postId).filter(Boolean))];
    if (postIds.length === 0) {
      return res.json({ success: true, posts: [], count: 0 });
    }

    const currentUser = await getUserByFirebaseId(req.user?.uid);
    let posts = await Post.find({ _id: { $in: postIds }, isDeleted: false, ...excludeAllHateSpeechFilter() })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 30, 50))
      .skip(parseInt(skip) || 0)
      .lean();

    if (currentUser?._id) {
      posts = filterPostsForViewer(posts);
    } else {
      posts = posts.filter((p) => !isHateSpeechPost(p));
    }

    res.json({
      success: true,
      posts: posts.map((p) => ({ ...p, id: p._id, author: p.authorId })),
      count: posts.length,
    });
  } catch (error) {
    console.error('Get posts by mention error:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
};

// ==================== FR-3.7: REPORT POST ====================

export const reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const validReasons = ['hate_speech', 'inappropriate_content'];

    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        error: 'Report reason must be hate speech or inappropriate content',
        validReasons,
      });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingReport = await Report.findOne({
      reportedById: user._id,
      postId: post._id,
      itemType: 'post',
    });
    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this post' });
    }

    const report = await Report.create({
      reportedById: user._id,
      reportedItemId: post._id,
      itemType: 'post',
      postId: post._id,
      reason,
      description: description || undefined,
      status: 'pending',
    });

    await Post.updateOne(
      { _id: post._id },
      { $inc: { reportsCount: 1 }, moderationFlagged: true }
    );

    const populatedReport = await Report.findById(report._id)
      .populate('reportedById', 'name username firebaseId')
      .lean();

    res.status(201).json({
      success: true,
      report: { ...populatedReport, reportedBy: populatedReport?.reportedById },
    });
  } catch (error) {
    console.error('Report post error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'You have already reported this post' });
    }

    res.status(500).json({ error: 'Failed to report post', details: error.message });
  }
};

// ==================== EXISTING FUNCTIONS (UPDATED) ====================

export const getMyPosts = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const myPosts = await Post.find({
      authorId: user._id,
      isDeleted: false,
      ...excludeAllHateSpeechFilter(),
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    const receivedShares = await Share.find({ sharedWithId: user._id })
      .populate('postId')
      .populate('sharedById', 'name username')
      .sort({ created_at: -1 })
      .lean();

    const sharedPostIds = receivedShares.map((s) => s.postId?._id ?? s.postId).filter(Boolean);
    let sharedPostsWithInfo = [];
    if (sharedPostIds.length > 0) {
      const sharedPosts = await Post.find({
        _id: { $in: sharedPostIds },
        isDeleted: false,
        ...excludeAllHateSpeechFilter(),
      })
        .populate('authorId', AUTHOR_PUBLIC_FIELDS)
        .sort({ created_at: -1 })
        .lean();
      const shareMap = new Map(receivedShares.map((s) => [String(s.postId?._id ?? s.postId), s]));
      sharedPostsWithInfo = sharedPosts.map((post) => {
        const share = shareMap.get(String(post._id));
        return {
          ...post,
          id: post._id,
          author: post.authorId,
          isShared: true,
          sharedBy: share?.sharedById?._id ?? share?.sharedById,
          sharedByName: share?.sharedById?.name,
          sharedByUsername: share?.sharedById?.username,
          shareMessage: share?.message,
          sharedAt: share?.createdAt ?? share?.created_at,
        };
      });
    }

    const myPostsWithInfo = myPosts.map((p) => ({ ...p, id: p._id, author: p.authorId, isShared: false }));

    const allPosts = filterPostsForViewer([...myPostsWithInfo, ...sharedPostsWithInfo]);
    const uniquePosts = allPosts.filter((post, index, self) =>
      index === self.findIndex((p) => p.id === post.id || p._id === post._id)
    );
    uniquePosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const postIds = uniquePosts.map((p) => p.id || p._id);
    const likedRows = postIds.length
      ? await PostLike.find({ postId: { $in: postIds }, userId: user._id }).select('postId').lean()
      : [];
    const likedSet = new Set(likedRows.map((r) => String(r.postId)));

    const postsWithLikes = uniquePosts.map((post) => {
      const pid = String(post.id || post._id);
      return { ...post, isLiked: likedSet.has(pid) };
    });

    res.json({
      success: true,
      posts: postsWithLikes,
      count: postsWithLikes.length,
    });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
};

export const getFeed = async (req, res) => {
  try {
    console.log("🔍 getFeed called");
    
    if (!req.user || !req.user.uid) {
      console.error("❌ No user or uid in req.user:", req.user);
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { limit = 30, skip = 0 } = req.query;
    console.log("🔍 Looking for user with firebaseId:", req.user.uid);
    let user = await getUserByFirebaseId(req.user.uid);
    console.log("🔍 Found user:", user ? `id=${user.id}` : "not found");
    
    // If user doesn't exist, create basic user
    if (!user) {
      try {
        const { email, name } = req.user;
        const rollData = email ? parseRollNumber(email) : null;
        user = await User.create({
          firebaseId: req.user.uid,
          email: email || null,
          name: name || 'User',
          ...(rollData || {}),
        });
        console.log("✅ Auto-created user for feed:", user.id);
        // Ensure user has an id before proceeding
        if (!user || !user.id) {
          return res.status(500).json({ error: 'User created but ID not found' });
        }
      } catch (createError) {
        console.error("❌ Error auto-creating user:", createError);
        console.error("❌ Create error details:", createError.original?.message || createError.message);
        return res.status(500).json({ error: 'Failed to create user', details: createError.message });
      }
    }

    if (!user || !user._id) {
      return res.status(500).json({ error: 'User not found or invalid' });
    }

    // Get list of users the current user is following
    const followingRows = await UserFollow.find({ followerId: user._id }).select('followingId').lean();
    const followingIds = followingRows.map((r) => r.followingId).filter(Boolean);
    const currentUserId = user._id;
    const followingOnlyIds = followingIds.filter((id) => String(id) !== String(currentUserId));
    const allowedAuthorIds = new Set([
      String(currentUserId),
      ...followingOnlyIds.map((id) => String(id)),
    ]);
    const isAllowedFeedAuthor = (post) => {
      const authorId = resolvePostAuthorObjectId(post);
      return authorId != null && allowedAuthorIds.has(String(authorId));
    };

    const limitNum = Math.min(parseInt(limit) || 30, 50);
    const skipNum = parseInt(skip) || 0;
    const fetchCap = Math.min(Math.max(limitNum * 4, 50), 150);
    const notDeleted = { $ne: true };

    // 1️⃣ Own posts always included (even when following a busy timeline)
    const ownPosts = await Post.find({ authorId: currentUserId, isDeleted: notDeleted })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(fetchCap)
      .lean();

    // 2️⃣ Posts from people the user follows
    let followingPosts = [];
    if (followingOnlyIds.length > 0) {
      followingPosts = await Post.find({
        authorId: { $in: followingOnlyIds },
        isDeleted: notDeleted,
        ...excludeAllHateSpeechFilter(),
      })
        .populate('authorId', AUTHOR_PUBLIC_FIELDS)
        .sort({ createdAt: -1 })
        .limit(fetchCap)
        .lean();
    }

    const postById = new Map();
    for (const p of [...ownPosts, ...followingPosts]) {
      if (p?._id) postById.set(String(p._id), p);
    }
    const posts = [...postById.values()];

    // 3️⃣ Reposts by followed users (not the viewer's own repost rows)
    const reposts = followingOnlyIds.length > 0
      ? await Repost.find({ userId: { $in: followingOnlyIds } })
      .populate({
        path: 'postId',
        populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS },
        match: { isDeleted: false }, // Only include non-deleted posts
      })
      .populate('userId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(fetchCap)
      .lean()
      : [];

    // Reposts only when the original post author is self or someone you follow (exclude hate speech)
    const validReposts = reposts.filter(
      (r) =>
        r.postId &&
        r.postId.authorId &&
        isAllowedFeedAuthor(r.postId) &&
        isPostVisibleToViewer(r.postId)
    );

    // Combine all post IDs for mentions and likes lookup
    const allPostIds = [
      ...posts.map((p) => p._id),
      ...validReposts.map((r) => r.postId._id),
    ].filter(Boolean);

    // Get mentions for all posts
    const mentionsMap = new Map();
    if (allPostIds.length > 0) {
      const mentions = await PostMention.find({ postId: { $in: allPostIds } }).select('postId userId').lean();
      const mentionUserIds = [...new Set(mentions.map((m) => m.userId).filter(Boolean))];
      if (mentionUserIds.length > 0) {
        const mentionedUsers = await User.find({ _id: { $in: mentionUserIds } }).select('_id name username firebaseId profilePhoto').lean();
        const userMap = new Map(mentionedUsers.map((u) => [String(u._id), u]));
        mentions.forEach((m) => {
          const pk = String(m.postId);
          if (!mentionsMap.has(pk)) mentionsMap.set(pk, []);
          const user = userMap.get(String(m.userId));
          if (user) mentionsMap.get(pk).push({ ...user, id: user._id });
        });
      }
    }

    // Get liked status for all posts
    const likedRows = allPostIds.length
      ? await PostLike.find({ postId: { $in: allPostIds }, userId: user._id }).select('postId').lean()
      : [];
    const likedSet = new Set(likedRows.map((r) => String(r.postId)));

    // Get reposted status for all posts (check if current user has reposted)
    const userRepostRows = allPostIds.length
      ? await Repost.find({ postId: { $in: allPostIds }, userId: user._id }).select('postId').lean()
      : [];
    const userRepostedSet = new Set(userRepostRows.map((r) => String(r.postId)));

    const mapFeedPost = (p, extras = {}) => {
      const author =
        p.authorId && typeof p.authorId === 'object' && p.authorId.name != null
          ? p.authorId
          : p.author || p.authorId;
      const j = {
        ...p,
        id: p._id,
        author,
        isLiked: likedSet.has(String(p._id)),
        isReposted: false,
        userReposted: userRepostedSet.has(String(p._id)),
        mentions: mentionsMap.get(String(p._id)) || [],
        _sortDate: p.created_at || p.createdAt,
        ...extras,
      };
      return j;
    };

    // Map normal posts (do not drop rows when populate is partial)
    let postsWithLikes = posts.map((p) => mapFeedPost(p));

    // Map reposted posts (original author must be in allowedAuthorIds)
    const existingIds = new Set(postsWithLikes.map((p) => String(p.id || p._id)));
    for (const repost of validReposts) {
      const p = repost.postId;
      if (!p || !p.authorId || !isAllowedFeedAuthor(p) || existingIds.has(String(p._id))) continue;
      existingIds.add(String(p._id));
      const j = { ...p, id: p._id, author: p.authorId };
      j.isReposted = true; // This indicates if post was reposted by someone (for display)
      j.userReposted = userRepostedSet.has(String(p._id)); // This indicates if current user reposted it
      j.repostedBy = repost.userId;
      j.repostedByName = repost.userId?.name;
      j.repostedByUsername = repost.userId?.username;
      j.repostedByFirebaseId = repost.userId?.firebaseId;
      j.repostedAt = repost.createdAt || repost.created_at;
      j._sortDate = repost.createdAt || repost.created_at; // Sort by repost time
      j.isLiked = likedSet.has(String(p._id));
      j.mentions = mentionsMap.get(String(p._id)) || [];
      postsWithLikes.push(j);
    }

    // Sort all posts by activity time (newest first)
    postsWithLikes.sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));

    // Guarantee viewer's own posts are in the feed (not dropped by pagination)
    const inFeedIds = new Set(postsWithLikes.map((p) => String(p.id || p._id)));
    for (const p of ownPosts) {
      const pid = String(p._id);
      if (!inFeedIds.has(pid)) {
        postsWithLikes.unshift(mapFeedPost(p));
        inFeedIds.add(pid);
      }
    }
    postsWithLikes.sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));

    // Home feed: only posts authored by the viewer or accounts they follow
    postsWithLikes = postsWithLikes.filter(isAllowedFeedAuthor);
    postsWithLikes = filterPostsForViewer(postsWithLikes);

    // Apply limit and skip after own posts are merged
    postsWithLikes = postsWithLikes.slice(skipNum, skipNum + limitNum);

    // Clean up temporary sort field
    postsWithLikes.forEach((p) => delete p._sortDate);

    postsWithLikes = await enrichPostsWithAuthorDetails(postsWithLikes);

    res.json({
      success: true,
      posts: postsWithLikes,
      count: postsWithLikes.length,
      followingCount: followingOnlyIds.length,
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch feed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Get posts from users that the logged-in user is following
export const getFollowingFeed = async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const followingRows = await UserFollow.find({ followerId: user._id }).select('followingId').lean();
    const followingIds = followingRows.map((r) => r.followingId).filter(Boolean);

    if (followingIds.length === 0) {
      return res.json({
        success: true,
        posts: [],
        count: 0,
        message: 'You are not following anyone yet. Follow users to see their posts here.',
      });
    }

    let posts = await Post.find({
      authorId: { $in: followingIds },
      isDeleted: false,
      ...excludeAllHateSpeechFilter(),
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ created_at: -1 })
      .limit(Math.min(parseInt(limit) || 30, 50))
      .skip(parseInt(skip) || 0)
      .lean();

    const postIds = posts.map((p) => p._id);
    const likedRows = postIds.length
      ? await PostLike.find({ postId: { $in: postIds }, userId: user._id }).select('postId').lean()
      : [];
    const likedSet = new Set(likedRows.map((r) => String(r.postId)));

    // Get reposts from followed users (exclude user's own reposts - they shouldn't see their own reposts)
    const reposts = await Repost.find({ userId: { $in: followingIds } })
      .populate({
        path: 'postId',
        populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS },
        match: { isDeleted: false }, // Only include non-deleted posts
      })
      .populate('userId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 30, 50))
      .lean();

    // Filter out reposts where the post was deleted, hate speech, or user's own reposts
    const validReposts = reposts.filter(
      (r) =>
        r.postId &&
        r.postId.authorId &&
        String(r.userId?._id || r.userId) !== String(user._id) &&
        isPostVisibleToViewer(r.postId)
    );

    const repostedPostIds = validReposts.map((r) => r.postId?._id).filter(Boolean);
    const allPostIds = [...postIds, ...repostedPostIds].filter(Boolean);
    
    // Get liked status for all posts
    const allLikedRows = allPostIds.length
      ? await PostLike.find({ postId: { $in: allPostIds }, userId: user._id }).select('postId').lean()
      : [];
    const allLikedSet = new Set(allLikedRows.map((r) => String(r.postId)));
    
    // Get reposted status for all posts (check if current user has reposted)
    const userRepostRows = allPostIds.length
      ? await Repost.find({ postId: { $in: allPostIds }, userId: user._id }).select('postId').lean()
      : [];
    const userRepostedSet = new Set(userRepostRows.map((r) => String(r.postId)));

    let postsWithLikes = posts.map((p) => {
      const j = { ...p, id: p._id, author: p.authorId };
      j.isLiked = allLikedSet.has(String(p._id));
      j.isReposted = false; // This indicates if post was reposted by someone (for display)
      j.userReposted = userRepostedSet.has(String(p._id)); // This indicates if current user reposted it
      j._sortDate = p.created_at || p.createdAt;
      return j;
    });

    // Add reposted posts (only from followed users, not user's own reposts)
    const existingIds = new Set(postsWithLikes.map((p) => String(p.id)));
    for (const repost of validReposts) {
      const p = repost.postId;
      if (!p || !p.authorId || existingIds.has(String(p._id))) continue;
      existingIds.add(String(p._id));
      const j = { ...p, id: p._id, author: p.authorId };
      j.isReposted = true; // This indicates if post was reposted by someone (for display)
      j.userReposted = userRepostedSet.has(String(p._id)); // This indicates if current user reposted it
      j.repostedBy = repost.userId;
      j.repostedByName = repost.userId?.name;
      j.repostedByUsername = repost.userId?.username;
      j.repostedByFirebaseId = repost.userId?.firebaseId;
      j.repostedAt = repost.createdAt || repost.created_at;
      j._sortDate = repost.createdAt || repost.created_at; // Sort by repost time
      j.isLiked = allLikedSet.has(String(p._id));
      postsWithLikes.push(j);
    }

    try {
      const shares = await Share.find({ sharedWithId: user._id })
        .populate({ path: 'postId', populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS } })
        .populate('sharedById', 'name username profilePhoto')
        .sort({ createdAt: -1 })
        .limit(Math.min(parseInt(limit) || 30, 50))
        .lean();
      const existingIds = new Set(postsWithLikes.map((p) => String(p.id)));
      for (const share of shares) {
        const p = share.postId;
        if (!p || !p.authorId || existingIds.has(String(p._id)) || !isPostVisibleToViewer(p)) continue;
        existingIds.add(String(p._id));
        const j = { ...p, id: p._id, author: p.authorId };
        j.isShared = true;
        j.sharedByUsername = share.sharedById?.username;
        j.sharedByName = share.sharedById?.name;
        j._sortDate = share.createdAt ?? share.created_at;
        j.isLiked = likedSet.has(String(p._id));
        postsWithLikes.push(j);
      }
      postsWithLikes.sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));
      postsWithLikes = postsWithLikes.slice(0, Math.min(parseInt(limit) || 30, 50));
    } catch (_) {}
    postsWithLikes.forEach((p) => delete p._sortDate);

    postsWithLikes = await enrichPostsWithAuthorDetails(postsWithLikes);

    res.json({
      success: true,
      posts: postsWithLikes,
      count: postsWithLikes.length,
    });
  } catch (error) {
    console.error('❌ [FOLLOWING FEED] Error:', error);
    res.status(500).json({ error: 'Failed to fetch following feed', details: error.message });
  }
};

export const getPostsByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const profileUser = await User.findOne({ username }).select('_id').lean();
    if (!profileUser) return res.status(404).json({ error: 'User not found' });

    const currentUser = await getUserByFirebaseId(req.user?.uid);

    let posts = await Post.find({
      authorId: profileUser._id,
      isDeleted: false,
      ...excludeAllHateSpeechFilter(),
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    posts = filterPostsForViewer(posts);

    const postIds = posts.map((p) => p._id);
    const likedRows = (postIds.length > 0 && currentUser?._id)
      ? await PostLike.find({ postId: { $in: postIds }, userId: currentUser._id }).select('postId').lean()
      : [];
    const likedSet = new Set(likedRows.map((r) => String(r.postId)));

    // Get reposted status for all posts (check if current user has reposted)
    const userRepostRows = (postIds.length > 0 && currentUser?._id)
      ? await Repost.find({ postId: { $in: postIds }, userId: currentUser._id }).select('postId').lean()
      : [];
    const userRepostedSet = new Set(userRepostRows.map((r) => String(r.postId)));

    let postsWithLikes = posts.map((post) => ({
      ...post,
      id: post._id,
      author: post.authorId,
      isLiked: likedSet.has(String(post._id)),
      userReposted: userRepostedSet.has(String(post._id)),
    }));

    postsWithLikes = await enrichPostsWithAuthorDetails(postsWithLikes);

    res.json({
      success: true,
      posts: postsWithLikes,
    });
  } catch (error) {
    console.error('Get posts by username error:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidId(postId)) return res.status(400).json({ error: 'Invalid post ID' });
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const post = await Post.findById(postId)
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .lean();
    if (!post || post.isDeleted) return res.status(404).json({ error: 'Post not found' });
    if (!isPostVisibleToViewer(post)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likeRow = await PostLike.findOne({ postId: post._id, userId: user._id });
    const j = { ...post, id: post._id, author: post.authorId };
    res.json({ success: true, post: { ...j, isLiked: !!likeRow } });
  } catch (error) {
    console.error('Get post by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch post', details: error.message });
  }
};

// ==================== GET USER'S LIKED POSTS ====================

export const getUserLikedPosts = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const likedRows = await PostLike.find({ userId: user._id })
      .populate({
        path: 'postId',
        populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS },
      })
      .sort({ createdAt: -1 })
      .lean();

    const likedPosts = filterPostsForViewer(
      likedRows.map((r) => r.postId).filter(Boolean).filter((p) => !p.isDeleted)
    ).map((p) => ({
      post: {
        ...p,
        author: p.authorId,
        id: p._id,
        createdAt: p.createdAt || p.created_at,
      },
    }));

    res.json({ success: true, likedPosts, count: likedPosts.length });
  } catch (error) {
    console.error('Get user liked posts error:', error);
    res.status(500).json({ error: 'Failed to fetch liked posts', details: error.message });
  }
};

// ==================== GET USER'S COMMENTED POSTS ====================

export const getUserCommentedPosts = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rows = await UserCommentedPost.find({ userId: user._id })
      .populate({ path: 'postId', populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS } })
      .sort({ commentedAt: -1 })
      .lean();

    const commentedPosts = rows
      .map((r) => ({
        post: r.postId ? { ...r.postId, author: r.postId.authorId, id: r.postId._id } : null,
        comment: { content: r.commentContent, createdAt: r.commentedAt, postContent: r.postContent },
      }))
      .filter((r) => r.post && isPostVisibleToViewer(r.post));

    res.json({ success: true, commentedPosts, count: commentedPosts.length });
  } catch (error) {
    console.error('Get user commented posts error:', error);
    res.status(500).json({ error: 'Failed to fetch commented posts', details: error.message });
  }
};

// ==================== GET POSTS & REPLIES (Posts where user has commented) ====================

export const getPostsAndReplies = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userComments = await Comment.find({
      authorId: user._id,
      isDeleted: false,
    })
      .select('postId parentCommentId createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const postIds = [...new Set(userComments.map((c) => c.postId?.toString()).filter(Boolean))];
    if (postIds.length === 0) {
      return res.json({ success: true, posts: [], count: 0 });
    }

    const posts = await Post.find({ _id: { $in: postIds }, isDeleted: false })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    const commentsByPost = new Map();
    for (const c of userComments) {
      const pid = (c.postId && c.postId.toString && c.postId.toString()) || String(c.postId);
      if (!commentsByPost.has(pid)) commentsByPost.set(pid, []);
      commentsByPost.get(pid).push(c);
    }
    const latestCommentIds = [];
    const postToCommentId = new Map();
    for (const [pid, arr] of commentsByPost) {
      const sorted = [...arr].sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
      latestCommentIds.push(sorted[0]._id);
      postToCommentId.set(pid, sorted[0]._id.toString());
    }

    const latestComments = await Comment.find({ _id: { $in: latestCommentIds } })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .lean();
    const commentMap = new Map(latestComments.map((c) => [c._id.toString(), c]));

    const likedPostIds = await PostLike.find({ userId: user._id, postId: { $in: postIds } }).select('postId').lean();
    const likedSet = new Set(likedPostIds.map((r) => String(r.postId)));

    const postsWithUserComments = posts.map((post) => {
      const cid = postToCommentId.get(post._id.toString());
      const latestComment = cid ? commentMap.get(cid) : null;
      return {
        ...post,
        id: post._id,
        author: post.authorId,
        isLiked: likedSet.has(String(post._id)),
        userComment: latestComment
          ? {
              _id: latestComment._id,
              content: latestComment.content,
              createdAt: latestComment.createdAt || latestComment.created_at,
              author: latestComment.authorId,
            }
          : null,
      };
    });

    res.json({
      success: true,
      posts: postsWithUserComments,
      count: postsWithUserComments.length,
    });
  } catch (error) {
    console.error('Get posts and replies error:', error);
    res.status(500).json({ error: 'Failed to fetch posts and replies', details: error.message });
  }
};

// ==================== SHARE POST ====================

/** Find a chat (DM) between two users. */
async function findConversationBetween(userId1, userId2) {
  const id1 = userId1?.toString?.() ?? userId1;
  const id2 = userId2?.toString?.() ?? userId2;
  const ids = [id1, id2];
  const participants = await ConversationParticipant.find({ userId: { $in: ids } }).lean();
  const byConv = new Map();
  for (const p of participants) {
    const cid = p.conversationId?.toString?.() ?? p.conversationId;
    if (!byConv.has(cid)) byConv.set(cid, new Set());
    byConv.get(cid).add(p.userId?.toString?.() ?? p.userId);
  }
  for (const [cid, userIds] of byConv) {
    if (userIds.has(id1) && userIds.has(id2)) {
      const conv = await Conversation.findById(cid);
      if (conv && !conv.isGroup) return conv;
    }
  }
  return null;
}

/** Get or create a chat (DM) between two users. */
async function getOrCreateConversation(user1Id, user2Id, status = 'accepted', requestedById = null) {
  let conversation = await findConversationBetween(user1Id, user2Id);
  if (!conversation) {
    conversation = await Conversation.create({
      status,
      requestedById: requestedById || null,
      lastMessageAt: new Date(),
      isGroup: false,
    });
    await ConversationParticipant.insertMany([
      { conversationId: conversation._id, userId: user1Id },
      { conversationId: conversation._id, userId: user2Id },
    ]);
  }
  return conversation;
}

/** Check if both users follow each other. */
async function isMutualFollow(userId1, userId2) {
  const [a, b] = await Promise.all([
    UserFollow.findOne({ followerId: userId1, followingId: userId2 }),
    UserFollow.findOne({ followerId: userId2, followingId: userId1 }),
  ]);
  return !!(a && b);
}

export const sharePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { sharedWithUsername, message } = req.body;

    console.log(`📤 Share post request received`);
    console.log(`   Post ID: ${postId}`);
    console.log(`   Username: "${sharedWithUsername}"`);
    console.log(`   Message: "${message || 'none'}"`);

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    if (!sharedWithUsername || !sharedWithUsername.trim()) {
      return res.status(400).json({ error: 'Username to share with is required' });
    }

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      console.log(`❌ Sharing user not found for Firebase ID: ${req.user.uid}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (isHateSpeechPost(post)) {
      return res.status(403).json({ error: 'This post cannot be shared' });
    }

    const cleanUsername = sharedWithUsername.trim().replace(/^@+/, '');
    const sharedWithUser = await User.findOne({
      username: new RegExp(`^${cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });

    if (!sharedWithUser) {
      const similarUsers = await User.find({
        username: new RegExp(cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      })
        .select('username')
        .limit(3)
        .lean();
      let errorMessage = `User "@${cleanUsername}" not found.`;
      if (similarUsers.length > 0) {
        errorMessage += ` Did you mean: ${similarUsers.map((u) => `@${u.username}`).join(', ')}?`;
      } else {
        errorMessage += ' Please check the username and try again.';
      }
      return res.status(404).json({ error: errorMessage });
    }

    if (sharedWithUser._id.toString() === user._id.toString()) {
      return res.status(400).json({ error: 'Cannot share post with yourself' });
    }

    const existingShare = await Share.findOne({
      postId: post._id,
      sharedById: user._id,
      sharedWithId: sharedWithUser._id,
    });
    if (existingShare) {
      return res.status(400).json({ error: 'You have already shared this post with this user' });
    }

    await Share.create({
      postId: post._id,
      sharedById: user._id,
      sharedWithId: sharedWithUser._id,
      message: (message && message.trim()) || null,
      status: 'pending',
    });

    await Post.updateOne({ _id: post._id }, { $inc: { sharesCount: 1 } });

    // Create message in chat so the shared post appears in messaging
    const mutualFollow = await isMutualFollow(user._id, sharedWithUser._id);
    const status = mutualFollow ? 'accepted' : 'pending';
    const conv = await getOrCreateConversation(user._id, sharedWithUser._id, status, user._id);
    const shareContent = (message && message.trim()) || null;
    const chatMessage = await Message.create({
      conversationId: conv._id,
      senderId: user._id,
      content: shareContent,
      postId: post._id,
      deliveryStatus: 'sent',
    });
    await ConversationDeletedBy.deleteMany({
      conversationId: conv._id,
      userId: { $in: [user._id, sharedWithUser._id] },
    });
    await Conversation.updateOne(
      { _id: conv._id },
      { lastMessageId: chatMessage._id, lastMessageAt: new Date() }
    );

    res.status(201).json({
      success: true,
      message: `Post shared with @${sharedWithUser.username} successfully`,
    });
  } catch (error) {
    console.error('Share post error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'You have already shared this post with this user' });
    }
    res.status(500).json({ error: 'Failed to share post', details: error.message });
  }
};

export const getUserSharedPosts = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const shares = await Share.find({ sharedById: user._id })
      .populate({ path: 'postId', populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS } })
      .populate('sharedWithId', 'name username')
      .sort({ createdAt: -1 })
      .lean();

    const sharedPosts = shares.map((s) => ({
      post: s.postId ? { ...s.postId, author: s.postId.authorId } : null,
      sharedWith: s.sharedWithId,
      message: s.message,
      sharedAt: s.createdAt ?? s.created_at,
    })).filter((s) => s.post);

    res.json({ success: true, sharedPosts, count: sharedPosts.length });
  } catch (error) {
    console.error('Get user shared posts error:', error);
    res.status(500).json({ error: 'Failed to fetch shared posts', details: error.message });
  }
};

// Get user's received shares
// ==================== GET USER'S MEDIA ====================

export const getUserMedia = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all posts by this user that have images or videos (stored in image field as base64)
    const postsWithMedia = await Post.find({
      authorId: user._id,
      image: { $exists: true, $ne: null, $ne: '' },
      isDeleted: false,
    })
      .select('_id image createdAt content')
      .sort({ createdAt: -1 })
      .lean();
    
    // Filter to ensure we only return posts that actually have media (image or video)
    const validMediaPosts = postsWithMedia.filter(post => {
      if (!post.image) return false;
      // Check if it's a base64 image or video data URL
      return post.image.startsWith('data:image/') || post.image.startsWith('data:video/');
    });

    // Format media items (only posts with actual images or videos)
    const media = validMediaPosts.map(post => ({
      postId: post._id,
      imageUrl: post.image,
      createdAt: post.createdAt,
      postContent: post.content,
    }));

    console.log(`✅ Found ${media.length} media items for user ${user.username || user.name}`);

    res.json({
      success: true,
      media,
      count: media.length,
    });
  } catch (error) {
    console.error('Get user media error:', error);
    res.status(500).json({ error: 'Failed to fetch media', details: error.message });
  }
};

export const getUserReceivedShares = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const shares = await Share.find({ sharedWithId: user._id })
      .populate({ path: 'postId', populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS } })
      .populate('sharedById', 'name username profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    const receivedShares = shares.map((s) => ({
      post: s.postId ? { ...s.postId, author: s.postId.authorId } : null,
      sharedBy: s.sharedById,
      message: s.message,
      receivedAt: s.createdAt ?? s.created_at,
    })).filter((s) => s.post);

    res.json({ success: true, receivedShares, count: receivedShares.length });
  } catch (error) {
    console.error('Get user received shares error:', error);
    res.status(500).json({ error: 'Failed to fetch received shares', details: error.message });
  }
};

// ==================== REPOST POST ====================

export const repostPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!isValidId(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (isHateSpeechPost(post)) {
      return res.status(403).json({ error: 'This post cannot be reposted' });
    }

    // Check if user already reposted this post
    const existingRepost = await Repost.findOne({ postId: post._id, userId: user._id });
    if (existingRepost) {
      // Unrepost
      await Repost.deleteOne({ _id: existingRepost._id });
      await Post.updateOne({ _id: post._id }, { $inc: { repostsCount: -1 } });
      return res.json({ success: true, reposted: false, message: 'Post unreposted' });
    }

    // Create repost
    await Repost.create({
      postId: post._id,
      userId: user._id,
    });

    // Increment reposts count
    await Post.updateOne({ _id: post._id }, { $inc: { repostsCount: 1 } });

    // Create notification for the original post author (if not reposting own post)
    if (post.authorId.toString() !== user._id.toString()) {
      await createNotification(
        { Notification },
        post.authorId,
        user._id,
        'repost',
        { postId: post._id }
      );
    }

    res.json({ success: true, reposted: true, message: 'Post reposted' });
  } catch (error) {
    console.error('Repost post error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Post already reposted' });
    }
    res.status(500).json({ error: 'Failed to repost', details: error.message });
  }
};

// ==================== GET USER'S REPOSTED POSTS ====================

export const getUserReposts = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const reposts = await Repost.find({ userId: user._id })
      .populate({
        path: 'postId',
        populate: { path: 'authorId', select: AUTHOR_PUBLIC_FIELDS },
      })
      .sort({ createdAt: -1 })
      .lean();

    const repostedPosts = reposts
      .map((r) => ({ post: r.postId, repostedAt: r.createdAt || r.created_at }))
      .filter((item) => item.post && !item.post.isDeleted)
      .map((item) => ({
        post: { 
          ...item.post, 
          author: item.post.authorId, 
          id: item.post._id,
          createdAt: item.post.createdAt || item.post.created_at,
          repostedAt: item.repostedAt,
        },
      }));

    res.json({ success: true, repostedPosts, count: repostedPosts.length });
  } catch (error) {
    console.error('Get user reposts error:', error);
    res.status(500).json({ error: 'Failed to fetch reposts', details: error.message });
  }
};
