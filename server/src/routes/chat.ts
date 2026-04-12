/**
 * Chat Routes
 * AI chat and chat history
 */

import express from 'express';
import { query } from '../database/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { formatProductSearchAsDataTable, formatProductSearchAsItemCarousel } from './tool-ui-helpers.js';

const router = express.Router();

/**
 * Product search function for OpenAI tool calling
 */
async function searchProducts(params: {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<any[]> {
  try {
    let sql = 'SELECT * FROM products WHERE 1=1';
    const sqlParams: any[] = [];
    let paramCount = 1;

    // Text search across name, description
    if (params.query) {
      sql += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
      sqlParams.push(`%${params.query.toLowerCase()}%`);
      paramCount++;
    }

    // Category filter
    if (params.category) {
      sql += ` AND category = $${paramCount}`;
      sqlParams.push(params.category);
      paramCount++;
    }

    // Price range filters
    if (params.minPrice !== undefined) {
      sql += ` AND price >= $${paramCount}`;
      sqlParams.push(params.minPrice);
      paramCount++;
    }

    if (params.maxPrice !== undefined) {
      sql += ` AND price <= $${paramCount}`;
      sqlParams.push(params.maxPrice);
      paramCount++;
    }

    // Limit results
    const limit = params.limit || 20;
    sql += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    sqlParams.push(limit);

    const result = await query(sql, sqlParams);
    return result.rows;
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

/**
 * Get recipe with ingredient matching
 */
async function getRecipe(params: {
  recipeName: string;
  servings?: number;
}): Promise<{
  name: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    product?: any;
  }>;
  steps: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
}> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Use OpenAI to generate recipe
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a recipe expert. Generate detailed recipes in JSON format. Always return valid JSON.',
          },
          {
            role: 'user',
            content: `Generate a recipe for: ${params.recipeName}${params.servings ? ` (${params.servings} servings)` : ''}. Return as JSON with this exact structure: {"name": "Recipe Name", "ingredients": [{"name": "Ingredient Name", "quantity": "Amount"}], "steps": ["Step 1", "Step 2"], "prepTime": "X minutes", "cookTime": "X minutes", "servings": "X"}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate recipe: ${errorText}`);
    }

    const data = await response.json();
    let recipeJson: any = {};
    try {
      const content = data.choices?.[0]?.message?.content || '{}';
      recipeJson = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error('Recipe JSON parse error:', parseError);
      throw new Error('Failed to parse recipe response');
    }

    // Match ingredients with products in database
    const matchedIngredients = await Promise.all(
      (recipeJson.ingredients || []).map(async (ingredient: any) => {
        // Search for matching product
        const searchResult = await query(
          `SELECT * FROM products 
           WHERE LOWER(name) LIKE $1 
             OR LOWER(description) LIKE $1
           ORDER BY 
             CASE 
               WHEN LOWER(name) = $2 THEN 1
               WHEN LOWER(name) LIKE $3 THEN 2
               ELSE 3
             END
           LIMIT 1`,
          [
            `%${ingredient.name.toLowerCase()}%`,
            ingredient.name.toLowerCase(),
            `${ingredient.name.toLowerCase()}%`,
          ]
        );

        return {
          name: ingredient.name,
          quantity: ingredient.quantity || '',
          product: searchResult.rows[0] || undefined,
        };
      })
    );

    return {
      name: recipeJson.name || params.recipeName,
      ingredients: matchedIngredients,
      steps: recipeJson.steps || [],
      prepTime: recipeJson.prepTime || 'Not specified',
      cookTime: recipeJson.cookTime || 'Not specified',
      servings: recipeJson.servings || (params.servings ? params.servings.toString() : '4'),
    };
  } catch (error: any) {
    console.error('Recipe generation error:', error);
    throw error;
  }
}

/**
 * Compare multiple products
 */
async function compareProducts(params: {
  productIds: string[];
}): Promise<{
  products: any[];
  comparison: {
    priceRange: { min: number; max: number };
    categories: string[];
    analysis: string;
    recommendations: string[];
  };
}> {
  try {
    if (!params.productIds || params.productIds.length < 2) {
      throw new Error('At least 2 products are required for comparison');
    }

    if (params.productIds.length > 5) {
      throw new Error('Maximum 5 products can be compared at once');
    }

    // Get product details
    const products = await Promise.all(
      params.productIds.map(async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          throw new Error(`Product ${id} not found`);
        }
        return result.rows[0];
      })
    );

    // Calculate comparison metrics
    const prices = products.map((p) => parseFloat(p.price));
    const priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
    const categories = Array.from(new Set(products.map((p) => p.category)));

    // Generate AI-powered comparison analysis
    const productSummaries = products
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} - $${p.price} (${p.category}, Stock: ${p.stock})`
      )
      .join('\n');

    // Use OpenAI to generate comparison analysis
    const openaiApiKey = process.env.OPENAI_API_KEY;
    let analysis = '';
    let recommendations: string[] = [];

    if (openaiApiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a product comparison expert. Analyze products and provide concise, helpful comparisons focusing on value, features, and recommendations.',
              },
              {
                role: 'user',
                content: `Compare these products:\n${productSummaries}\n\nProvide a brief analysis (2-3 sentences) and 2-3 specific recommendations.`,
              },
            ],
            temperature: 0.7,
            max_tokens: 300,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const lines = content.split('\n').filter((l: string) => l.trim());
          analysis = lines[0] || content;
          recommendations = lines.slice(1).filter((l: string) => l.trim().length > 0);
        }
      } catch (error) {
        console.error('AI comparison generation error:', error);
      }
    }

    // Fallback analysis if AI fails
    if (!analysis) {
      const sortedByPrice = [...products].sort((a, b) => a.price - b.price);
      const cheapest = sortedByPrice[0];
      const mostExpensive = sortedByPrice[sortedByPrice.length - 1];

      analysis = `Comparing ${products.length} products. Price range: $${priceRange.min.toFixed(2)} - $${priceRange.max.toFixed(2)}. `;
      if (priceRange.max - priceRange.min > 100) {
        analysis += `${cheapest.name} offers the best value, while ${mostExpensive.name} is the premium option.`;
      } else {
        analysis += 'Products are similarly priced, so choose based on your specific needs.';
      }

      recommendations = [
        `Best Value: ${cheapest.name} at $${cheapest.price}`,
        `Premium Option: ${mostExpensive.name} at $${mostExpensive.price}`,
      ];
    }

    return {
      products,
      comparison: {
        priceRange,
        categories,
        analysis,
        recommendations,
      },
    };
  } catch (error: any) {
    console.error('Product comparison error:', error);
    throw error;
  }
}

/**
 * Get grocery insights from user's order history
 */
async function getGroceryInsights(params: {
  userId: string;
  days?: number;
}): Promise<{
  period: string;
  dailyData: Array<{
    date: string;
    day: string;
    amount: number;
    itemCount: number;
  }>;
  stats: {
    totalSpent: number;
    averageDaily: number;
    highestDay: { date: string; amount: number };
    lowestDay: { date: string; amount: number };
    totalItems: number;
  };
}> {
  try {
    const days = params.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get orders with grocery items from the last N days
    const ordersResult = await query(
      `SELECT o.id, o.created_at, oi.quantity, oi.price, p.category
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1 
         AND o.created_at >= $2
         AND p.category = 'Groceries'
       ORDER BY o.created_at ASC`,
      [params.userId, startDate.toISOString()]
    );

    // Group by date
    const dailyMap = new Map<string, { amount: number; itemCount: number }>();
    const today = new Date();

    // Initialize all days in range with zero
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyMap.set(dateKey, { amount: 0, itemCount: 0 });
    }

    // Aggregate order data by date
    for (const row of ordersResult.rows) {
      const orderDate = new Date(row.created_at).toISOString().split('T')[0];
      const existing = dailyMap.get(orderDate) || { amount: 0, itemCount: 0 };
      existing.amount += parseFloat(row.price) * row.quantity;
      existing.itemCount += row.quantity;
      dailyMap.set(orderDate, existing);
    }

    // Convert to array format
    const dailyData: Array<{
      date: string;
      day: string;
      amount: number;
      itemCount: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const data = dailyMap.get(dateKey) || { amount: 0, itemCount: 0 };

      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        amount: parseFloat(data.amount.toFixed(2)),
        itemCount: data.itemCount,
      });
    }

    // Calculate statistics
    const totalSpent = dailyData.reduce((sum, day) => sum + day.amount, 0);
    const shoppingDays = dailyData.filter((day) => day.amount > 0);
    const averageDaily =
      shoppingDays.length > 0 ? totalSpent / shoppingDays.length : 0;
    const totalItems = dailyData.reduce((sum, day) => sum + day.itemCount, 0);

    const sortedByAmount = [...dailyData].sort((a, b) => b.amount - a.amount);
    const highestDay = sortedByAmount[0] || { date: 'N/A', amount: 0 };
    const lowestDay =
      shoppingDays.length > 0
        ? [...shoppingDays].sort((a, b) => a.amount - b.amount)[0]
        : { date: 'N/A', amount: 0 };

    return {
      period: `Last ${days} Days`,
      dailyData,
      stats: {
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        averageDaily: parseFloat(averageDaily.toFixed(2)),
        highestDay: { date: highestDay.date, amount: highestDay.amount },
        lowestDay: { date: lowestDay.date, amount: lowestDay.amount },
        totalItems,
      },
    };
  } catch (error) {
    console.error('Grocery insights error:', error);
    throw error;
  }
}

/**
 * OpenAI tool definitions
 */
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description: 'Search for products in the catalog based on user query, category, price range, or other criteria. Use this when users ask about products, want to browse, or need recommendations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to match product names, descriptions, or SKUs. Use this for general product searches.',
          },
          category: {
            type: 'string',
            description: 'Filter by product category (e.g., Electronics, Groceries, Clothing). Use when user specifies a category.',
          },
          minPrice: {
            type: 'number',
            description: 'Minimum price filter. Use when user asks for products above a certain price.',
          },
          maxPrice: {
            type: 'number',
            description: 'Maximum price filter. Use when user asks for products under a certain price or within a budget.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 20, max: 50).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_grocery_insights',
      description: 'Get grocery spending insights and analytics for a user based on their order history. Use this when users ask about their grocery spending, expenses, or want to see spending breakdowns.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to analyze (default: 30). Use when user specifies a time period.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_products',
      description: 'Compare multiple products side-by-side. Provide detailed analysis of differences, similarities, and recommendations. Use when users want to compare products or ask which product is better.',
      parameters: {
        type: 'object',
        properties: {
          productIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of product IDs to compare (2-5 products recommended)',
          },
        },
        required: ['productIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recipe',
      description: 'Get a recipe with ingredients. Searches product catalog to match ingredients with available products. Use when users ask for recipes or want cooking instructions.',
      parameters: {
        type: 'object',
        properties: {
          recipeName: {
            type: 'string',
            description: 'Name of the recipe (e.g., "Butter Chicken", "Pasta Carbonara", "Chocolate Cake")',
          },
          servings: {
            type: 'number',
            description: 'Number of servings (optional, defaults to recipe default)',
          },
        },
        required: ['recipeName'],
      },
    },
  },
];

/**
 * POST /api/chat/ai
 * Get AI response (OpenAI integration) - Non-streaming endpoint for backward compatibility
 */
router.post('/ai', async (req, res) => {
  try {
    const { message, conversationHistory = [], products = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Build system prompt with product context
    const productList = products.slice(0, 50).map((p: any) =>
      `- ${p.name} ($${p.price}): ${p.description} [Category: ${p.category}, Stock: ${p.stock}]`
    ).join('\n');

    const systemPrompt = `You are a helpful AI shopping assistant for Xerow.ai, an e-commerce platform. Your role is to help users discover products, answer questions, and provide shopping recommendations.

Available Products:
${productList || 'No products available at the moment.'}

Guidelines:
- Be friendly, helpful, and conversational
- When users ask about products, search through the available products and recommend relevant ones
- If users ask for recipes, you can suggest recipes and help them find ingredients from the product catalog
- If users ask about grocery spending insights, explain that you can help analyze their shopping patterns
- Always mention product prices and availability when recommending products
- If a product isn't available, suggest similar alternatives
- Keep responses concise but informative
- Use emojis sparingly and appropriately

When recommending products, format them clearly with name, price, and brief description.`;

    // Build conversation messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorData}`);
      return res.status(response.status).json({
        error: 'Failed to get AI response',
        details: errorData
      });
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>, usage?: any };
    const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    res.json({
      response: aiResponse,
      usage: data.usage
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

/**
 * POST /api/chat/ai/stream
 * Get AI response with streaming and tool calling support (SSE)
 */
router.post('/ai/stream', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Try to get user ID from authenticated request (optional)
    // Extract user ID from token if present, but don't require authentication
    let userId = '';
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          userId = decoded.userId;
        } catch (error) {
          // Invalid token, but continue without user ID
        }
      }
    } catch (error) {
      // No authentication, continue without user ID
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const systemPrompt = `You are a helpful AI shopping assistant for Xerow.ai, an e-commerce platform. Your role is to help users discover products, answer questions, and provide shopping recommendations.

Available Tools:
- search_products: Search for products by query, category, price range, etc.
- get_recipe: Get recipes with ingredients matched to available products
- get_grocery_insights: Get grocery spending insights from user's order history (requires authentication)
- compare_products: Compare multiple products side-by-side with detailed analysis

Guidelines:
- Be friendly, helpful, and conversational
- When users ask about products, use the search_products tool to find relevant products
- When users ask for recipes, use the get_recipe tool to generate recipes and match ingredients
- When users ask about grocery spending or insights, use the get_grocery_insights tool
- When users want to compare products, use the compare_products tool
- Always mention product prices and availability when recommending products
- If a product isn't available, suggest similar alternatives
- Keep responses concise but informative
- Use emojis sparingly and appropriately

When recommending products, format them clearly with name, price, and brief description.`;

    // Build conversation messages
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Helper to send SSE event
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Make initial OpenAI API call with tools
    let currentMessages = [...messages];
    let maxIterations = 5; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: currentMessages,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`OpenAI API error: ${response.status} - ${errorData}`);
        sendEvent('error', { error: 'Failed to get AI response', details: errorData });
        res.end();
        return;
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        sendEvent('error', { error: 'No message in response' });
        res.end();
        return;
      }

      // Check if tool calls are requested
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant message with tool calls to conversation
        currentMessages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls
        });

        // Emit tool-call events and execute tools
        for (const toolCall of message.tool_calls) {
          const toolCallId = toolCall.id;
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

          // Emit tool-call event
          sendEvent('tool', {
            type: 'tool-call',
            toolCallId: toolCallId,
            toolName: functionName,
            args: functionArgs
          });

          // Execute tool function
          let toolResult: any;
          try {
            if (functionName === 'search_products') {
              const products = await searchProducts(functionArgs);
              // Return Tool UI Item Carousel format (preferred for product browsing)
              toolResult = formatProductSearchAsItemCarousel(
                products,
                functionArgs.query,
                {
                  category: functionArgs.category,
                  minPrice: functionArgs.minPrice,
                  maxPrice: functionArgs.maxPrice,
                }
              );
            } else if (functionName === 'get_grocery_insights') {
              // Check if user is authenticated
              if (!userId) {
                toolResult = {
                  error: 'Authentication required to view grocery insights. Please sign in.',
                };
              } else {
                // Add userId to function args
                toolResult = await getGroceryInsights({
                  ...functionArgs,
                  userId: userId,
                });
              }
            } else if (functionName === 'compare_products') {
              toolResult = await compareProducts(functionArgs);
            } else if (functionName === 'get_recipe') {
              toolResult = await getRecipe(functionArgs);
            } else {
              toolResult = { error: `Unknown tool: ${functionName}` };
            }
          } catch (error: any) {
            console.error(`Tool execution error: ${error}`);
            toolResult = { error: error.message || 'Tool execution failed' };
          }

          // Emit tool-result event
          sendEvent('tool', {
            type: 'tool-result',
            toolCallId: toolCallId,
            toolName: functionName,
            result: toolResult
          });

          // Add tool result to conversation
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: functionName,
            content: JSON.stringify(toolResult)
          });
        }

        // Continue loop to get final response
        continue;
      }

      // No tool calls - stream text response
      if (message.content) {
        // Stream text content line by line
        const lines = message.content.split('\n');
        for (const line of lines) {
          sendEvent('text', { text: line });
        }
      }

      // Send usage info and end
      if (data.usage) {
        sendEvent('usage', data.usage);
      }

      sendEvent('done', {});
      res.end();
      return;
    }

    // Max iterations reached
    sendEvent('error', { error: 'Maximum iterations reached' });
    res.end();
  } catch (error: any) {
    console.error('Streaming chat error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || 'Failed to process AI request' })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/chat/messages
 * Save chat message
 */
router.post('/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { sessionId, message, sender } = req.body;

    if (!sessionId || !message || !sender) {
      return res.status(400).json({ error: 'sessionId, message, and sender are required' });
    }

    await query(
      'INSERT INTO chat_messages (session_id, content, sender) VALUES ($1, $2, $3)',
      [sessionId, message, sender]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save chat message error:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

/**
 * GET /api/chat/messages/:sessionId
 * Get chat history
 */
router.get('/messages/:sessionId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;

    const result = await query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY timestamp ASC',
      [sessionId]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export { router as chatRoutes };
