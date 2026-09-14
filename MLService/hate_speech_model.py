# ============================================================================
# FILE: hate_speech_model.py
# Hate Speech Detection Model - Using base XLM-RoBERTa tokenizer
# ============================================================================

import torch
import logging
import warnings
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Suppress warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class HateSpeechDetector:
    MODEL_NAME = "Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned"
    BASE_TOKENIZER = "xlm-roberta-base"  # Use base tokenizer instead of model's tokenizer
    
    # THRESHOLD FOR HATE SPEECH DETECTION (LOWER = MORE SENSITIVE)
    # Default: 0.35 means any text with >35% hate probability is flagged as hate
    HATE_THRESHOLD = 0.35
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        
        try:
            logger.info(f"📥 Loading hate speech model from: {self.MODEL_NAME}")
            
            # Use base XLM-RoBERTa tokenizer (bypasses the corrupted tokenizer)
            logger.info(f"   Using base tokenizer: {self.BASE_TOKENIZER}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.BASE_TOKENIZER)
            
            # Load the model (weights only)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.MODEL_NAME,
                trust_remote_code=True
            )
            self.model.to(self.device)
            self.model.eval()
            
            logger.info(f"✅ Hate speech model loaded on {self.device}")
            logger.info(f"   Hate threshold: {self.HATE_THRESHOLD * 100}%")
            
            # Test inference
            test_input = self.tokenizer("test", return_tensors="pt", truncation=True, max_length=128)
            test_input = {k: v.to(self.device) for k, v in test_input.items()}
            with torch.no_grad():
                test_output = self.model(**test_input)
            logger.info(f"✅ Model inference test passed")
            
        except Exception as e:
            logger.error(f"❌ Failed to load hate speech model: {e}")
            logger.warning("⚠️ Hate speech detection will use fallback")
            self.model = None
            self.tokenizer = None
    
    def predict(self, text):
        """
        Returns (is_hate_speech, label, confidence, probabilities)
        
        Uses HATE_THRESHOLD instead of argmax for better sensitivity
        """
        if self.model is None or self.tokenizer is None:
            return False, "normal", 0.5, {"normal": 0.5, "hate": 0.5}
        
        try:
            from preprocess import preprocess_text
            cleaned_text = preprocess_text(text)
            
            inputs = self.tokenizer(
                cleaned_text,
                return_tensors="pt",
                truncation=True,
                max_length=128,
                padding=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            
            # Get hate probability
            hate_prob = float(probs[1])
            normal_prob = float(probs[0])
            
            # Use threshold instead of argmax
            is_hate = hate_prob >= self.HATE_THRESHOLD
            
            label = "hate" if is_hate else "normal"
            # Confidence is the probability of the chosen class
            confidence = hate_prob if is_hate else normal_prob
            probabilities = {"normal": normal_prob, "hate": hate_prob}
            
            logger.debug(f"Hate prob: {hate_prob:.3f}, Threshold: {self.HATE_THRESHOLD}, Is hate: {is_hate}")
            
            return is_hate, label, confidence, probabilities
            
        except Exception as e:
            logger.error(f"Hate speech prediction error: {e}")
            return False, "normal", 0.5, {"normal": 0.5, "hate": 0.5}