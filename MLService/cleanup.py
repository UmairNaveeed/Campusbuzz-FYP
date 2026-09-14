# cleanup.py - Run this once before starting the app
import os
import shutil

print("Cleaning up corrupted files...")

# Remove local cache
if os.path.exists("./local_sentiment_model"):
    shutil.rmtree("./local_sentiment_model")
    print("✅ Removed local cache")

# Remove HF cache for this model
cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
model_cache = os.path.join(cache_dir, "models--Umair1710--xlmt-roberta-twitter-finetuned-sentimentalAnalysis")
if os.path.exists(model_cache):
    shutil.rmtree(model_cache)
    print("✅ Removed HF cache")

# Also remove tokenizers cache
tokenizers_cache = os.path.expanduser("~/.cache/huggingface/tokenizers")
if os.path.exists(tokenizers_cache):
    for item in os.listdir(tokenizers_cache):
        if "xlmt" in item.lower() or "sentimental" in item.lower():
            cache_path = os.path.join(tokenizers_cache, item)
            shutil.rmtree(cache_path)
            print(f"✅ Removed tokenizer cache: item")

print("\n✅ Cleanup complete! Now restart your Flask app.")