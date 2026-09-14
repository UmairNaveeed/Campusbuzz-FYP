# ============================================================================
# FILE: preprocess.py
# Shared Roman Urdu preprocessing pipeline for both models
# ============================================================================

import re

ROMAN_URDU_DICT = {
    'aj': 'aaj', 'ajj': 'aaj', 'aaj': 'aaj',
    'acha': 'achha', 'accha': 'achha', 'achha': 'achha',
    'bohat': 'bahut', 'bohot': 'bahut', 'bahut': 'bahut',
    'nahi': 'nahin', 'nhi': 'nahin', 'nahin': 'nahin',
    'kya': 'kya', 'kia': 'kya', 'yaar': 'yar', 'tum': 'tum',
    'hai': 'hai', 'hain': 'hain', 'tha': 'tha', 'lekin': 'lekin',
    'agar': 'agar', 'toh': 'to', 'tension': 'tension',
    'kal': 'kal', 'abhi': 'abhi', 'phir': 'phir', 'thora': 'thoda',
    'kuch': 'kuch', 'kharab': 'kharab', 'maza': 'maza', 'theek': 'theek',
    'jeet': 'jeet', 'gaye': 'gaye', 'raha': 'raha', 'kar': 'kar',
    'koi': 'koi', 'mujhe': 'mujhe', 'apna': 'apna', 'aap': 'aap',
    'magar': 'lekin', 'problem': 'problem', 'fail': 'fail', 'pass': 'pass'
}

def normalize_roman_urdu(text):
    words = text.lower().split()
    normalized = []
    for word in words:
        clean_word = re.sub(r'[^\w\s]', '', word)
        if clean_word in ROMAN_URDU_DICT:
            normalized.append(ROMAN_URDU_DICT[clean_word])
        else:
            normalized.append(word)
    return ' '.join(normalized)

def preprocess_text(text):
    """Complete preprocessing pipeline for Roman Urdu/Urdu/English"""
    text = str(text).lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text)
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'#', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    
    has_urdu_script = bool(re.search('[\u0600-\u06FF]', text))
    
    if not has_urdu_script:
        roman_urdu_pattern = re.compile(
            r'\b(aj|acha|hai|bohat|yaar|nahi|tha|kya|koi|'
            r'tum|lekin|agar|toh|phir|abhi|kal|thora|tension|theek)\b'
        )
        if roman_urdu_pattern.search(text):
            text = normalize_roman_urdu(text)
    
    return text