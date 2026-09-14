#......warnings........#

import os
import warnings

# Disable tokenizer parallelism warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Disable HF hub symlink warnings
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Suppress specific warnings
warnings.filterwarnings("ignore", message="torch.utils._pytree._register_pytree_node")
warnings.filterwarnings("ignore", message="`use_fast`=False is deprecated")

#......warning........#
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from datetime import datetime
import os
from dotenv import load_dotenv

# Import the separate model classes
from hate_speech_model import HateSpeechDetector
from sentiment_model import SentimentAnalyzer

load_dotenv()

app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# INITIALIZE MODELS
# ============================================================================

print("\n" + "=" * 60)
print("🚀 STARTING ML SERVICE - TWO-STAGE PIPELINE")
print("=" * 60)

hate_detector = HateSpeechDetector()
sentiment_analyzer = SentimentAnalyzer()

print("\n📊 Pipeline: Hate Speech → Then → Sentiment")
print("=" * 60 + "\n")

# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'models': {
            'hate_speech': {
                'loaded': hate_detector.model is not None,
                'model_name': 'Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned',
                'accuracy': '86.40%'
            },
            'sentiment': {
                'loaded': sentiment_analyzer.model is not None,
                'model_name': 'iumairr/xlm-t-roman-urdu-sentiment',
                'accuracy': '71.00%'
            }
        },
        'pipeline': 'hate_first_then_sentiment'
    }), 200

# ============================================================================
# MAIN ANALYSIS ENDPOINT (Two-Stage)
# ============================================================================

@app.route('/analyze', methods=['POST'])
def analyze_post():
    """
    TWO-STAGE ANALYSIS:
    1. First check for hate speech
    2. If hate speech detected → return hate result (stop)
    3. If not hate → run sentiment analysis
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing "text" field'}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({'error': 'Text cannot be empty'}), 400
        
        if len(text) > 512:
            text = text[:512]
        
        # ============================================================
        # STAGE 1: HATE SPEECH DETECTION
        # ============================================================
        logger.info(f"🔍 Stage 1: Checking hate speech for: '{text[:50]}...'")
        
        is_hate, hate_label, hate_confidence, hate_probs = hate_detector.predict(text)
        
        # IF HATE SPEECH DETECTED → RETURN IMMEDIATELY (STOP HERE)
        if is_hate:
            logger.info(f"⚠️ HATE SPEECH DETECTED! Stopping analysis.")
            
            return jsonify({
                'text': data['text'],
                'is_hate_speech': True,
                'hate_speech': {
                    'detected': True,
                    'label': 'HATE',
                    'confidence': round(hate_confidence * 100, 2),
                    'probabilities': {
                        'normal': round(hate_probs['normal'] * 100, 2),
                        'hate': round(hate_probs['hate'] * 100, 2)
                    }
                },
                'sentiment': None,
                'analysis_stage': 'stopped_at_hate',
                'message': 'This post contains hate speech and will not be analyzed for sentiment',
                'timestamp': datetime.now().isoformat()
            }), 200
        
        # ============================================================
        # STAGE 2: SENTIMENT ANALYSIS (ONLY IF NOT HATE)
        # ============================================================
        logger.info(f"✅ No hate speech detected. Stage 2: Running sentiment analysis...")
        
        sentiment_label, sentiment_confidence, sentiment_probs = sentiment_analyzer.predict(text)
        
        logger.info(f"✓ Sentiment result: {sentiment_label} ({sentiment_confidence:.2%})")
        
        return jsonify({
            'text': data['text'],
            'is_hate_speech': False,
            'hate_speech': {
                'detected': False,
                'label': 'NORMAL',
                'confidence': round(hate_confidence * 100, 2),
                'probabilities': {
                    'normal': round(hate_probs['normal'] * 100, 2),
                    'hate': round(hate_probs['hate'] * 100, 2)
                }
            },
            'sentiment': {
                'label': sentiment_label,
                'confidence': round(sentiment_confidence * 100, 2),
                'probabilities': {
                    'negative': round(sentiment_probs['negative'], 4),
                    'neutral': round(sentiment_probs['neutral'], 4),
                    'positive': round(sentiment_probs['positive'], 4)
                }
            },
            'analysis_stage': 'completed_both',
            'message': 'Post is clean. Sentiment analysis completed.',
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in analysis: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# ============================================================================
# SENTIMENT ONLY ENDPOINT (Legacy - keeps your existing API working)
# ============================================================================

@app.route('/analyze-sentiment', methods=['POST'])
def analyze_sentiment_only():
    """Legacy endpoint - sentiment analysis only (no hate speech check)"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing "text" field'}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({'error': 'Text cannot be empty'}), 400
        
        if len(text) > 512:
            text = text[:512]
        
        sentiment_label, sentiment_confidence, sentiment_probs = sentiment_analyzer.predict(text)
        
        return jsonify({
            'text': data['text'],
            'sentiment_label': sentiment_label,
            'confidence': round(sentiment_confidence * 100, 2),
            'probabilities': {
                'negative': round(sentiment_probs['negative'], 4),
                'neutral': round(sentiment_probs['neutral'], 4),
                'positive': round(sentiment_probs['positive'], 4)
            },
            'model': sentiment_analyzer.MODEL_NAME,
            'model_accuracy': '71.00%',
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# ============================================================================
# BATCH ANALYSIS ENDPOINT
# ============================================================================

@app.route('/analyze/batch', methods=['POST'])
def analyze_batch():
    """Batch analysis for multiple texts"""
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({'error': 'Missing "texts" field'}), 400
        
        texts = data['texts']
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({'error': 'texts must be a non-empty array'}), 400
        
        if len(texts) > 50:
            return jsonify({'error': 'Maximum 50 texts per request'}), 400
        
        results = []
        hate_count = 0
        
        for text in texts:
            if not text or not isinstance(text, str):
                continue
            
            text = text.strip()[:512]
            if not text:
                continue
            
            is_hate, _, hate_confidence, _ = hate_detector.predict(text)
            
            if is_hate:
                hate_count += 1
                results.append({
                    'text': text,
                    'is_hate_speech': True,
                    'hate_confidence': round(hate_confidence * 100, 2),
                    'sentiment': None
                })
            else:
                sentiment_label, sentiment_confidence, _ = sentiment_analyzer.predict(text)
                results.append({
                    'text': text,
                    'is_hate_speech': False,
                    'hate_confidence': round(hate_confidence * 100, 2),
                    'sentiment': {
                        'label': sentiment_label,
                        'confidence': round(sentiment_confidence * 100, 2)
                    }
                })
        
        return jsonify({
            'count': len(results),
            'hate_speech_count': hate_count,
            'clean_count': len(results) - hate_count,
            'results': results,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'service': 'Campus Buzz ML API',
        'version': '4.0',
        'pipeline': 'Two-Stage: Hate Speech First, Then Sentiment',
        'endpoints': {
            'POST /analyze': 'Two-stage analysis (hate first, then sentiment)',
            'POST /analyze-sentiment': 'Sentiment analysis only (legacy)',
            'POST /analyze/batch': 'Batch analysis (max 50 texts)',
            'GET /health': 'Health check'
        }
    }), 200

# ============================================================================
# MAIN
# ============================================================================

# if __name__ == '__main__':
#     port = int(os.getenv('ML_API_PORT', 5001))
    
#     print(f"\n🚀 Starting Campus Buzz ML API v4.0 on port {port}")
#     print(f"📍 API available at: http://0.0.0.0:{port}")
#     print(f"\n📊 Pipeline: Hate Speech → Then → Sentiment")
#     print("=" * 60 + "\n")
# ============================================================================
# Main entry point
# ============================================================================

if __name__ == '__main__':
    print(f"\n🚀 Starting Campus Buzz ML API v4.0 on port 5001")
    print(f"📍 API available at: http://0.0.0.0:5001")
    print(f"\n📊 Pipeline: Hate Speech → Then → Sentiment")
    print("=" * 60)
    
    # Run with debug=False to prevent double loading
    app.run(
        debug=False,  # Critical: prevents model from loading twice
        host='0.0.0.0',
        port=5001,
        threaded=True
    )
    
    # app.run(debug=True, port=port, host='0.0.0.0')