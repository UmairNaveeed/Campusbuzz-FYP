// ============================================================================
// FILE: utils/sentimentAnalysis.js
// Two-stage ML analysis: Hate Speech → Sentiment
// ============================================================================

import axios from 'axios';

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';

let mlAvailable = false;

// Initialize ML service check
export const initMLService = async () => {
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 120000 });
    mlAvailable = response.data && response.data.status === 'ok';
    if (mlAvailable) {
      console.log(`✅ ML Service connected - Pipeline: ${response.data.pipeline || 'hate_first_then_sentiment'}`);
      console.log(`   Hate Model: ${response.data.models?.hate_speech?.model_name}`);
      console.log(`   Sentiment Model: ${response.data.models?.sentiment?.model_name}`);
    } else {
      console.warn(`⚠️ ML Service unavailable. Posts will be created without analysis.`);
    }
  } catch (err) {
    console.error(`❌ ML Service initialization failed: ${err.message}`);
    mlAvailable = false;
  }
  return mlAvailable;
};

// Check ML service health (for admin panel)
export const checkMlServiceHealth = async () => {
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 5000 });
    return response.data && response.data.status === 'ok';
  } catch (error) {
    return false;
  }
};

// Lexicon-based fallback
const lexiconSentiment = (text) => {
  const t = String(text || '').toLowerCase().trim();
  if (!t || t.length < 2) return null;

  const negativeKeywords = ['hate', 'bad', 'sad', 'angry', 'upset', 'terrible', 'awful', 'horrible', 'nervous', 'stressed', 'depressed', 'miserable'];
  const positiveKeywords = ['happy', 'love', 'great', 'good', 'amazing', 'awesome', 'fantastic', 'excellent', 'wonderful'];

  let neg = 0, pos = 0;
  for (const kw of negativeKeywords) {
    if (t.includes(kw)) neg++;
  }
  for (const kw of positiveKeywords) {
    if (t.includes(kw)) pos++;
  }

  if (neg > pos && neg > 0) return { sentiment_label: 'negative', confidence: 0.75 };
  if (pos > neg && pos > 0) return { sentiment_label: 'positive', confidence: 0.75 };
  return null;
};

/**
 * Analyze text using two-stage pipeline (WITH DEBUG LOGS)
 */
export const analyzeSentiment = async (text) => {
  console.log('📞 [DEBUG] Calling ML API for:', text);

  const fallbackResult = {
    is_hate_speech: false,
    hate_label: 'normal',
    hate_confidence: 0,
    hate_probabilities: { normal: 0.5, hate: 0.5 },
    sentiment_label: 'neutral',
    sentiment_confidence: 0,
    sentiment_probabilities: { negative: 0.33, neutral: 0.34, positive: 0.33 },
    model: 'fallback',
    model_version: '1.0',
    analysis_stage: 'fallback'
  };

  if (!mlAvailable) {
    await initMLService();
  }

  if (!mlAvailable) {
    console.log('⚠️ ML not available, using lexicon fallback');
    const lex = lexiconSentiment(text);
    if (lex) {
      return {
        ...fallbackResult,
        sentiment_label: lex.sentiment_label,
        sentiment_confidence: lex.confidence,
        model: 'lexicon-fallback',
        analysis_stage: 'lexicon_fallback'
      };
    }
    return fallbackResult;
  }

  try {
    const response = await axios.post(`${ML_API_URL}/analyze`, { text }, { timeout: 30000 });
    const result = response.data;
    
    console.log('📥 ML API Response:', JSON.stringify(result, null, 2));

    const parsedResult = {
      is_hate_speech: result.is_hate_speech || false,
      hate_label: result.hate_speech?.label?.toLowerCase() || 'normal',
      hate_confidence: (result.hate_speech?.confidence || 0) / 100,
      hate_probabilities: {
        normal: (result.hate_speech?.probabilities?.normal || 50) / 100,
        hate: (result.hate_speech?.probabilities?.hate || 50) / 100
      },
      sentiment_label: result.sentiment?.label || 'neutral',
      sentiment_confidence: (result.sentiment?.confidence || 0) / 100,
      sentiment_probabilities: result.sentiment?.probabilities || {
        negative: 0.33,
        neutral: 0.34,
        positive: 0.33
      },
      model: result.model_used?.sentiment_model || 'Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned',
      model_version: '2.0',
      analysis_stage: result.analysis_stage || 'unknown'
    };

    console.log('📤 Parsed Result:', {
      is_hate_speech: parsedResult.is_hate_speech,
      hate_label: parsedResult.hate_label,
      hate_confidence: parsedResult.hate_confidence,
      sentiment_label: parsedResult.sentiment_label
    });

    return parsedResult;
  } catch (error) {
    console.error(`❌ Sentiment analysis error: ${error.message}`);
    const lex = lexiconSentiment(text);
    if (lex) {
      return {
        ...fallbackResult,
        sentiment_label: lex.sentiment_label,
        sentiment_confidence: lex.confidence,
        model: 'lexicon-fallback',
        analysis_stage: 'lexicon_fallback'
      };
    }
    return fallbackResult;
  }
};

/**
 * Batch analyze multiple texts
 */
export const batchAnalyzeSentiment = async (texts) => {
  if (!texts || texts.length === 0) return [];
  
  if (!mlAvailable) {
    return texts.map((text) => {
      const lex = lexiconSentiment(text);
      return {
        sentiment_label: lex?.sentiment_label || 'neutral',
        confidence: lex?.confidence || 0,
        model: 'lexicon-fallback'
      };
    });
  }

  try {
    const response = await axios.post(`${ML_API_URL}/analyze/batch`, { texts }, { timeout: 120000 });
    const results = response.data.results || [];
    
    return results.map((result, index) => ({
      sentiment_label: result.sentiment?.label || 'neutral',
      confidence: (result.sentiment?.confidence || 0) / 100,
      is_hate_speech: result.is_hate_speech || false,
      model: 'Umair1710/xlm-roberta-twitter-HateSpeech-FineTuned'
    }));
  } catch (error) {
    console.error(`❌ Batch sentiment analysis error: ${error.message}`);
    return texts.map((text) => {
      const lex = lexiconSentiment(text);
      return {
        sentiment_label: lex?.sentiment_label || 'neutral',
        confidence: lex?.confidence || 0,
        model: 'fallback'
      };
    });
  }
};

/**
 * Check if ML service is available
 */
export const isMLAvailable = () => mlAvailable;

/**
 * Get hate speech detection only (faster)
 */
export const detectHateSpeech = async (text) => {
  if (!mlAvailable) {
    return { is_hate_speech: false, confidence: 0, label: 'normal' };
  }

  try {
    const result = await analyzeSentiment(text);
    return {
      is_hate_speech: result.is_hate_speech,
      label: result.hate_label,
      confidence: result.hate_confidence,
      probabilities: result.hate_probabilities
    };
  } catch (error) {
    console.error(`❌ Hate speech detection error: ${error.message}`);
    return { is_hate_speech: false, confidence: 0, label: 'normal' };
  }
};