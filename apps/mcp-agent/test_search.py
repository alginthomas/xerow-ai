#!/usr/bin/env python3
"""
Test script to debug product search
Run this to see what's happening with search queries
"""

import sys
import os
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from supabase_client import search_products

def test_search(query: str, max_price: float = None):
    print(f"\n{'='*60}")
    print(f"Testing search: '{query}'")
    if max_price:
        print(f"Max price: {max_price}")
    print(f"{'='*60}")
    
    try:
        results = search_products(query=query, max_price=max_price, limit=10)
        
        print(f"\nFound {len(results)} products")
        
        if results:
            print("\nResults:")
            for i, product in enumerate(results[:5], 1):  # Show first 5
                print(f"\n{i}. {product.get('title', 'N/A')}")
                print(f"   ID: {product.get('id')}")
                print(f"   Category: {product.get('category')}")
                print(f"   Brand: {product.get('brand')}")
                print(f"   Price: ₹{product.get('price', 0)}")
                print(f"   Similarity: {product.get('similarity', 0):.3f}")
                print(f"   Keyword Match: {product.get('keyword_match', False)}")
        else:
            print("\n⚠️  No results found!")
            print("\nPossible reasons:")
            print("  1. No products match the keywords")
            print("  2. Similarity threshold too high")
            print("  3. Price filter too restrictive")
            print("\nTry:")
            print("  - Using more general terms")
            print("  - Removing price filters")
            print("  - Checking if products exist in database")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Test queries
    test_queries = [
        "laptop",
        "HP Laptop",
        "shoes",
        "Nike Shoes",
        "phone",
        "Samsung Phone",
    ]
    
    if len(sys.argv) > 1:
        # Custom query from command line
        query = " ".join(sys.argv[1:])
        test_search(query)
    else:
        # Run default test queries
        for query in test_queries:
            test_search(query)
            input("\nPress Enter to continue to next test...")
