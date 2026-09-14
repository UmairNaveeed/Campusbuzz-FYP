// import mongoose from 'mongoose';

// const postSchema = new mongoose.Schema(
//   {
//     content: { 
//       type: String, 
//       required: true,
//       maxlength: 280,
//     },
//     image: String,
//     author: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     likes: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//     }],
//     likesCount: {
//       type: Number,
//       default: 0,
//     },
//     commentsCount: {
//       type: Number,
//       default: 0,
//     },
//     hashtags: [{
//       type: String,
//       lowercase: true,
//       trim: true,
//     }],
//     mentions: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//     }],
//     reports: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Report',
//     }],
//     reportsCount: {
//       type: Number,
//       default: 0,
//     },
//     sharesCount: {
//       type: Number,
//       default: 0,
//     },
//     isDeleted: {
//       type: Boolean,
//       default: false,
//     },
//     // ✅ SENTIMENT FIELDS - YAHAN PE SAHI JAGAH PE DALO
    
//                 sentiMentlabel: {
//                   type: String,
//                   enum: ['Positive', 'Neutral', 'Negative'],
//                   default: 'Neutral'
//                 },
//                 emoji: {
//                   type: String,
//                   default: '😐'
//                 },
//                 class: {
//                   type: Number,  // 0=Negative, 1=Neutral, 2=Positive
//                   default: 1
//                 },
//                 confidence: {
//                   type: Number,  // 0 to 100
//                   default: 0
//                 },
      
//                     Modelname: {
//                       type: String,
//                       default: 'twitter-xlm-roberta-base-sentiment'
//                     },
//                     Modelversion: {
//                       type: String,
//                       default: '1.0.0'
//                     },
//                     source: {
//                       type: String,
//                       enum: ['kaggle', 'huggingface', 'local'],
//                       default: 'kaggle'
//                     },
//                     loadedAt: {
//                       type: Date,
//                       default: null
//                     }
//       ,
//       analyzedAt: {
//         type: Date,
//         default: null
//       }
    
//   },
//   { 
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true },
//   }
// );

// // Indexes
// postSchema.index({ hashtags: 1 });
// postSchema.index({ mentions: 1 });
// postSchema.index({ author: 1, createdAt: -1 });
// postSchema.index({ isDeleted: 1, createdAt: -1 });
// postSchema.index({ isDeleted: 1, author: 1, createdAt: -1 });
// postSchema.index({ isDeleted: 1, hashtags: 1, createdAt: -1 });

// // ✅ Sentiment indexes for faster queries
// // postSchema.index({ 'sentiment.label': 1 });
// // postSchema.index({ 'sentiment.model.version': 1 });
// // postSchema.index({ 'sentiment.analyzedAt': -1 });

// const Post = mongoose.model('Post', postSchema, 'posts');

// export default Post;
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    content: { 
      type: String, 
      required: true,
      maxlength: 280,
    },
    image: String,
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    hashtags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    reports: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    }],
    reportsCount: {
      type: Number,
      default: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
    },
    repostsCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    
    // ============================================================
    // SENTIMENT ANALYSIS FIELDS (Existing)
    // ============================================================
    SentimentLabel: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    },
    Confidence: {
      type: Number,
      default: 0
    },
    Model: {
      type: String,
      default: 'iumairr/xlm-t-roman-urdu-sentiment'
    },
    ModelVersion: {
      type: String,
      default: '1.0'
    },
    
    // ============================================================
    // HATE SPEECH DETECTION FIELDS (NEW)
    // ============================================================
    hateSpeech: {
      isHateSpeech: {
        type: Boolean,
        default: false
      },
      label: {
        type: String,
        enum: ['normal', 'hate'],
        default: 'normal'
      },
      confidence: {
        type: Number,
        default: 0
      },
      probabilities: {
        normal: { type: Number, default: 0 },
        hate: { type: Number, default: 0 }
      },
      model: {
        name: {
          type: String,
          default: 'Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned'
        },
        version: {
          type: String,
          default: '1.0.0'
        },
        accuracy: {
          type: String,
          default: '86.40%'
        },
        hateF1: {
          type: String,
          default: '67.34%'
        }
      },
      analyzedAt: {
        type: Date,
        default: null
      }
    },
    
    // ============================================================
    // ANALYSIS STATUS
    // ============================================================
    analysisStatus: {
      sentimentCompleted: {
        type: Boolean,
        default: false
      },
      hateSpeechCompleted: {
        type: Boolean,
        default: false
      },
      lastAnalyzedAt: {
        type: Date,
        default: null
      }
    }
    
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for hate speech queries
postSchema.index({ 'hateSpeech.isHateSpeech': 1 });
postSchema.index({ 'hateSpeech.label': 1 });
postSchema.index({ 'analysisStatus.hateSpeechCompleted': 1 });
postSchema.index({ isDeleted: 1, 'hateSpeech.isHateSpeech': 1 });

// Virtual for moderation
postSchema.virtual('requiresModeration').get(function() {
  return this.hateSpeech.isHateSpeech === true;
});

const Post = mongoose.model('Post', postSchema, 'posts');

export default Post;