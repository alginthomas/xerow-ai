"""
Web Client Module
Handles web search and URL browsing functionality
"""
import requests
import logging
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import time

try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None
    logging.warning("duckduckgo-search not installed. Web search will not work.")

logger = logging.getLogger(__name__)

# User agent to avoid blocking
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def search_web(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search the web using DuckDuckGo.
    
    Args:
        query: Search query string
        max_results: Maximum number of results to return (default: 5)
        
    Returns:
        List of search results with title, url, and snippet
    """
    if DDGS is None:
        logger.error("duckduckgo-search library not installed")
        return []
    
    try:
        logger.info(f"Searching web for: '{query}' (max_results: {max_results})")
        
        with DDGS() as ddgs:
            results = []
            for result in ddgs.text(query, max_results=max_results):
                results.append({
                    'title': result.get('title', ''),
                    'url': result.get('href', ''),
                    'snippet': result.get('body', '')
                })
            
            logger.info(f"Found {len(results)} search results")
            return results
            
    except Exception as e:
        error_msg = str(e)
        if "Ratelimit" in error_msg or "rate limit" in error_msg.lower():
            logger.warning(f"Rate limited by DuckDuckGo. Please wait a moment before searching again.")
            return []
        logger.error(f"Error searching web: {e}", exc_info=True)
        return []


def browse_url(url: str, max_length: int = 5000) -> Dict[str, Any]:
    """
    Fetch and parse content from a URL.
    
    Args:
        url: URL to fetch
        max_length: Maximum length of content to return (default: 5000)
        
    Returns:
        Dictionary with title, content, and metadata
    """
    try:
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return {
                'error': 'Invalid URL format',
                'url': url
            }
        
        logger.info(f"Fetching URL: {url}")
        
        # Fetch with timeout and user agent
        headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        
        response = requests.get(
            url,
            headers=headers,
            timeout=15,
            allow_redirects=True
        )
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'lxml')
        
        # Extract title
        title = ''
        if soup.title:
            title = soup.title.get_text().strip()
        elif soup.find('h1'):
            title = soup.find('h1').get_text().strip()
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
            script.decompose()
        
        # Extract main content
        # Try to find main content area
        main_content = None
        for selector in ['main', 'article', '[role="main"]', '.content', '#content']:
            main_content = soup.select_one(selector)
            if main_content:
                break
        
        if not main_content:
            main_content = soup.body if soup.body else soup
        
        # Get text content
        text = main_content.get_text(separator=' ', strip=True)
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Truncate if too long
        if len(text) > max_length:
            text = text[:max_length] + "... [content truncated]"
        
        # Extract some links (optional, for context)
        links = []
        for link in main_content.find_all('a', href=True)[:10]:
            href = link.get('href')
            link_text = link.get_text().strip()
            if href and link_text:
                # Make absolute URL
                absolute_url = urljoin(url, href)
                links.append({
                    'text': link_text[:50],  # Truncate long link text
                    'url': absolute_url
                })
        
        result = {
            'url': url,
            'title': title,
            'content': text,
            'content_length': len(text),
            'links': links[:5]  # Limit to 5 links
        }
        
        logger.info(f"Successfully fetched URL: {url} (content length: {len(text)})")
        return result
        
    except requests.exceptions.Timeout:
        logger.error(f"Timeout fetching URL: {url}")
        return {
            'error': 'Request timeout',
            'url': url
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return {
            'error': f'Failed to fetch URL: {str(e)}',
            'url': url
        }
    except Exception as e:
        logger.error(f"Unexpected error browsing URL {url}: {e}", exc_info=True)
        return {
            'error': f'Unexpected error: {str(e)}',
            'url': url
        }
