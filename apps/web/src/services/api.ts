/**
 * API Service for Xerow.ai
 * Handles all backend API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Get authentication headers
 */
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Get JWT token from localStorage
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * AI Chat API - Get response from OpenAI
 */
export async function getAIResponse(
  message: string,
  conversationHistory: Array<{ content: string; sender: 'user' | 'ai' }>,
  products: any[]
): Promise<{ response: string; usage?: any }> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/ai`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory.map(msg => ({
          content: msg.content,
          sender: msg.sender
        })),
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          category: p.category,
          stock: p.stock
        }))
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI API error:', error);
    throw error;
  }
}

/**
 * Parse AI response to extract structured data (products, recipes, etc.)
 * This is a fallback parser - the AI should ideally return structured responses
 */
export function parseAIResponse(
  aiResponse: string,
  products: any[]
): {
  content: string;
  products?: any[];
  recipe?: any;
  insights?: any;
} {
  const result: any = { content: aiResponse };

  // Try to extract product mentions
  const productMentions: any[] = [];
  products.forEach(product => {
    const nameRegex = new RegExp(product.name, 'i');
    if (nameRegex.test(aiResponse)) {
      productMentions.push(product);
    }
  });

  if (productMentions.length > 0) {
    result.products = productMentions.slice(0, 6);
  }

  // Check for recipe keywords
  if (aiResponse.toLowerCase().includes('recipe') || 
      aiResponse.toLowerCase().includes('ingredients') ||
      aiResponse.toLowerCase().includes('cooking')) {
    // Could parse recipe structure if AI returns it in a specific format
  }

  // Check for insights/analytics keywords
  if (aiResponse.toLowerCase().includes('insight') ||
      aiResponse.toLowerCase().includes('spending') ||
      aiResponse.toLowerCase().includes('analytics')) {
    // Could parse insights if AI returns structured data
  }

  return result;
}
