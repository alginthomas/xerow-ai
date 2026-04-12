"""
Quick test to verify Ollama embedding generation works.
"""

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

def test_ollama_embedding():
    """Test Ollama embedding generation."""
    test_text = "SAP developer with 5 years experience in Bengaluru"
    
    print(f"Testing Ollama embedding generation...")
    print(f"Ollama URL: {OLLAMA_URL}")
    print(f"Model: {OLLAMA_EMBEDDING_MODEL}")
    print(f"Test text: {test_text}\n")
    
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/embed",
            json={
                "model": OLLAMA_EMBEDDING_MODEL,
                "input": test_text  # Ollama uses "input" not "prompt"
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        # Ollama returns embeddings as array of arrays
        embeddings_array = data.get("embeddings", [])
        if not embeddings_array:
            print("❌ No embeddings in response")
            return False
        
        embedding = embeddings_array[0]
        print(f"✅ Success! Generated embedding with {len(embedding)} dimensions")
        
        if len(embedding) == 384:
            print("✅ Perfect! Embedding is 384 dimensions (matches database schema)")
        else:
            print(f"⚠️  Warning: Embedding is {len(embedding)} dimensions, expected 384")
            print("   You may need to use a different model or adjust the database schema")
        
        print(f"\nFirst 5 values: {embedding[:5]}")
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Failed to connect to Ollama at {OLLAMA_URL}")
        print("   Make sure Ollama is running: ollama serve")
        print(f"   Or pull the model: ollama pull {OLLAMA_EMBEDDING_MODEL}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_ollama_embedding()
    sys.exit(0 if success else 1)
