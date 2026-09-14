# # ============================================================================
# # FILE: sentiment_model.py
# # Sentiment Analysis Model (Stage 2 - Only if NOT hate)
# # ============================================================================

# import torch
# import logging
# from transformers import AutoTokenizer, AutoModelForSequenceClassification
# from preprocess import preprocess_text

# logger = logging.getLogger(__name__)

# class SentimentAnalyzer:
    
#     MODEL_NAME = "Umair1710/xlmt-roberta-twitter-finetuned-sentimentalAnalysis"
    
#     def __init__(self):
#         self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
#         self.preprocessor = preprocess_text
#         self.labels = {0: "negative", 1: "neutral", 2: "positive"}
#         self.model = None
#         self.tokenizer = None
        
#         try:
#             logger.info(f"📥 Loading sentiment model from: {self.MODEL_NAME}")
            
#             self.tokenizer = AutoTokenizer.from_pretrained(
#                 self.MODEL_NAME,
#                 use_fast=False
#             )
#             self.model = AutoModelForSequenceClassification.from_pretrained(self.MODEL_NAME)
#             self.model.to(self.device)
#             self.model.eval()
            
#             logger.info(f"✅ Sentiment model loaded on {self.device}")
#             logger.info(f"   Accuracy: 86.00% | F1: 0.86")
#         except Exception as e:
#             logger.error(f"❌ Failed to load sentiment model: {e}")
#             self.model = None
#             self.tokenizer = None
    
#     def predict(self, text):
#         """Returns (label, confidence, probabilities)"""
#         if self.model is None or self.tokenizer is None:
#             return "neutral", 0.33, {"negative": 0.33, "neutral": 0.34, "positive": 0.33}
        
#         try:
#             cleaned_text = self.preprocessor(text)
#             inputs = self.tokenizer(
#                 cleaned_text,
#                 return_tensors="pt",
#                 truncation=True,
#                 max_length=512,
#                 padding=True
#             )
#             inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
#             with torch.no_grad():
#                 outputs = self.model(**inputs)
#                 logits = outputs.logits
#                 probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            
#             pred_class = int(probs.argmax())
#             label = self.labels[pred_class]
#             confidence = float(probs[pred_class])
#             probabilities = {
#                 "negative": float(probs[0]),
#                 "neutral": float(probs[1]),
#                 "positive": float(probs[2])
#             }
            
#             return label, confidence, probabilities
            
#         except Exception as e:
#             logger.error(f"Sentiment prediction error: {e}")
#             return "neutral", 0.33, {"negative": 0.33, "neutral": 0.34, "positive": 0.33}

# ============================================================================
# FILE: sentiment_model.py
# Sentiment Analysis Model (Stage 2 - Only if NOT hate)
# ============================================================================
# ============================================================================
# FILE: sentiment_model.py - COMPLETE FIX FOR TOKENIZER ISSUE
# ============================================================================

import torch
import logging
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from preprocess import preprocess_text
import os
import json

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    
    # Use base model tokenizer + our fine-tuned weights
    BASE_MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
    FINETUNED_MODEL_NAME = "Umair1710/xlm-roberta-balanced-sentiment"
    LOCAL_CACHE = "./local_sentiment_model"
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.preprocessor = preprocess_text
        self.labels = {0: "negative", 1: "neutral", 2: "positive"}
        self.model = None
        self.tokenizer = None
        
        # Try multiple strategies
        if self._load_from_local():
            return
        
        if self._load_with_base_tokenizer():
            return
        
        if self._load_from_hub_weights_only():
            return
        
        self._load_fallback()
    
    def _load_from_local(self):
        """Try to load from local cached model"""
        if os.path.exists(self.LOCAL_CACHE):
            try:
                logger.info(f"📥 Loading sentiment model from local cache: {self.LOCAL_CACHE}")
                self.tokenizer = AutoTokenizer.from_pretrained(self.LOCAL_CACHE)
                self.model = AutoModelForSequenceClassification.from_pretrained(self.LOCAL_CACHE)
                self.model.to(self.device)
                self.model.eval()
                logger.info(f"✅ Sentiment model loaded from local cache")
                return True
            except Exception as e:
                logger.warning(f"Local cache load failed: {e}")
        return False
    
    def _load_with_base_tokenizer(self):
        """Use base model's tokenizer with fine-tuned weights (MOST RELIABLE)"""
        try:
            logger.info(f"📥 Loading with base tokenizer + fine-tuned weights...")
            
            # Load tokenizer from base model (known working)
            logger.info(f"   Loading tokenizer from: {self.BASE_MODEL_NAME}")
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.BASE_MODEL_NAME,
                use_fast=True  # Fast tokenizer works well
            )
            
            # Load fine-tuned model weights
            logger.info(f"   Loading model weights from: {self.FINETUNED_MODEL_NAME}")
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.FINETUNED_MODEL_NAME,
                from_tf=False
            )
            
            self.model.to(self.device)
            self.model.eval()
            
            # Save combined model locally for next time
            logger.info(f"💾 Saving combined model to {self.LOCAL_CACHE}")
            self.model.save_pretrained(self.LOCAL_CACHE)
            self.tokenizer.save_pretrained(self.LOCAL_CACHE)
            
            logger.info(f"✅ Sentiment model loaded successfully!")
            logger.info(f"   Accuracy: 86.89% | F1: 0.868")
            return True
            
        except Exception as e:
            logger.error(f"Base tokenizer approach failed: {e}")
            return False
    
    def _load_from_hub_weights_only(self):
        """Alternative: Load weights only from HF, tokenizer from base"""
        try:
            logger.info(f"📥 Alternative load: weights from HF, tokenizer from base...")
            
            # Download only the model weights
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.FINETUNED_MODEL_NAME,
                trust_remote_code=True
            )
            
            # Use base tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.BASE_MODEL_NAME,
                use_fast=True
            )
            
            self.model.to(self.device)
            self.model.eval()
            
            logger.info(f"✅ Alternative load successful!")
            return True
            
        except Exception as e:
            logger.error(f"Alternative load failed: {e}")
            return False
    
    def _load_fallback(self):
        """Fallback to simple rule-based model"""
        logger.warning("⚠️ Using fallback rule-based sentiment model")
        self.model = None
        self.tokenizer = None
    
    def predict(self, text):
        """Returns (label, confidence, probabilities)"""
        # Use fallback if model not loaded
        if self.model is None or self.tokenizer is None:
            # Simple rule-based fallback for common Roman Urdu words
            text_lower = text.lower()
            
            # Positive words in Roman Urdu
            positive_words = [
                'good', 'great', 'awesome', 'love', 'like', 'nice', 'best', 'happy',
                'jeet', 'win', 'success', 'acha', 'achha', 'maza', 'theek', 'passed',
                'brilliant', 'excellent', 'wonderful', 'fantastic', 'enjoy', 'fun'
            ]
            
            # Negative words in Roman Urdu
            negative_words = [
                'bad', 'worst', 'hate', 'dislike', 'sad', 'fail', 'loss', 'problem',
                'tension', 'kharab', 'bura', 'difficult', 'hard', 'stress', 'upset',
                'angry', 'annoying', 'hate', 'terrible', 'horrible'
            ]
            
            pos_score = sum(1 for w in positive_words if w in text_lower)
            neg_score = sum(1 for w in negative_words if w in text_lower)
            
            # Also check for negation
            if 'not' in text_lower or 'nahi' in text_lower or 'nhi' in text_lower:
                neg_score *= 1.5
            
            if pos_score > neg_score and pos_score > 0:
                return "positive", 0.7, {"negative": 0.15, "neutral": 0.15, "positive": 0.7}
            elif neg_score > pos_score and neg_score > 0:
                return "negative", 0.7, {"negative": 0.7, "neutral": 0.15, "positive": 0.15}
            else:
                return "neutral", 0.5, {"negative": 0.25, "neutral": 0.5, "positive": 0.25}
        
        try:
            # Preprocess text
            cleaned_text = self.preprocessor(text)
            
            # Tokenize
            inputs = self.tokenizer(
                cleaned_text,
                return_tensors="pt",
                truncation=True,
                max_length=128,
                padding=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Predict
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            
            # Get prediction
            pred_class = int(probs.argmax())
            label = self.labels[pred_class]
            confidence = float(probs[pred_class])
            probabilities = {
                "negative": float(probs[0]),
                "neutral": float(probs[1]),
                "positive": float(probs[2])
            }
            
            return label, confidence, probabilities
            
        except Exception as e:
            logger.error(f"Sentiment prediction error: {e}")
            return "neutral", 0.33, {"negative": 0.33, "neutral": 0.34, "positive": 0.33}