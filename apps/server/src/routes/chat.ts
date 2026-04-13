/**
 * Chat Routes
 * AI chat and chat history
 */

import express from 'express';
import { query } from '../database/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import {
  validateEmployeeSearchSQL,
  extractPaginationParams,
  rewriteSQLWithPagination,
  logSQLQuery,
} from '../utils/sql-validator.js';
import { formatEmployeeSearchAsItemCarousel } from './tool-ui-helpers.js';

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

    const data = await response.json() as any;
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
          const data = await response.json() as any;
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
 * Web search using Ollama's web search API
 */
async function webSearch(params: {
  query: string;
  max_results?: number | string;
}): Promise<{
  results: Array<{
    title: string;
    url: string;
    content: string;
  }>;
}> {
  // Use environment variable or fallback to provided key
  const ollamaApiKey = process.env.OLLAMA_API_KEY || 'e12a490ee4c44cfd962cec4b48584a5c.Bi7_tUQdpV2NCG-3zanPv85I';
  
  if (!ollamaApiKey) {
    throw new Error('OLLAMA_API_KEY is required for web search');
  }

  // Validate and normalize max_results
  let maxResults = 5; // default
  if (params.max_results !== undefined && params.max_results !== null) {
    // Convert to number if it's a string
    const parsed = typeof params.max_results === 'string' 
      ? parseInt(params.max_results, 10) 
      : Number(params.max_results);
    
    // Validate it's a valid number and within acceptable range
    if (!isNaN(parsed) && parsed > 0) {
      // Clamp between 1 and 10 (reasonable limits for web search)
      maxResults = Math.min(Math.max(1, parsed), 10);
    } else {
      console.warn('[webSearch] Invalid max_results value:', params.max_results, 'using default: 5');
    }
  }
  
  try {
    const response = await fetch('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ollamaApiKey}`,
      },
      body: JSON.stringify({
        query: params.query,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Web search failed: ${errorText}`);
    }

    const data = await response.json() as any;
    return {
      results: data.results || [],
    };
  } catch (error: any) {
    console.error('Web search error:', error);
    throw error;
  }
}

/**
 * Web fetch using Ollama's web fetch API
 */
async function webFetch(params: {
  url: string;
}): Promise<{
  title: string;
  content: string;
  links: string[];
}> {
  // Use environment variable or fallback to provided key
  const ollamaApiKey = process.env.OLLAMA_API_KEY || 'e12a490ee4c44cfd962cec4b48584a5c.Bi7_tUQdpV2NCG-3zanPv85I';
  
  try {
    const response = await fetch('https://ollama.com/api/web_fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ollamaApiKey}`,
      },
      body: JSON.stringify({
        url: params.url,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Web fetch failed: ${errorText}`);
    }

    const data = await response.json() as any;
    return {
      title: data.title || '',
      content: data.content || '',
      links: data.links || [],
    };
  } catch (error: any) {
    console.error('Web fetch error:', error);
    throw error;
  }
}

/**
 * Generate SQL query for employee search
 * LLM generates PostgreSQL SELECT query from natural language using Ollama
 */
/**
 * Check if Ollama is ready (model loaded)
 * This helps avoid long timeouts on first request
 */
async function checkOllamaReady(ollamaUrl: string, ollamaModel: string): Promise<boolean> {
  try {
    // Quick health check - just verify Ollama is responding
    const healthUrl = ollamaUrl.replace('/api/chat', '/api/tags');
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout for health check
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function generateEmployeeSearchSQL(params: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<{ sql: string }> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b'; // llama3.1:8b supports tool calling
  
  // Quick health check before making the actual request
  const isReady = await checkOllamaReady(ollamaUrl, ollamaModel);
  if (!isReady) {
    console.warn('[Ollama] Health check failed - Ollama may not be ready. Proceeding anyway...');
  }

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 25, 100);
  const offset = (page - 1) * pageSize;

  // Minimal schema context for LLM
  const schemaContext = `IMPORTANT: You must query the 'employees' table. The 'users' table is for system accounts and should NEVER be used for employee searches.

Table: employees (USE THIS TABLE FOR ALL EMPLOYEE SEARCHES)
Key columns:
- id (uuid)
- candidate_id (text) - unique identifier like "KudzuC-0003767"
- full_name (text) - employee's full name
- skill (text) - technical skills
- current_location (text) - current work location
- preferred_location (text) - preferred work location
- current_ctc_numeric (numeric) - current salary
- expected_ctc_numeric (numeric) - expected salary
- stage (text) - recruitment stage
- status (text) - candidate status
- embedding (vector(384)) - for semantic search
- overall_experience (text) - total experience
- relevant_experience (text) - relevant experience
- email (text) - email address
- phone_number (text) - phone number
- resume_url (text) - resume URL

DO NOT use the 'users' table - it is for system user accounts, not employees.

Note: For semantic search, you can use the hybrid_search_employees function:
SELECT * FROM hybrid_search_employees(
  search_query := 'query text',
  query_embedding := NULL::vector,  -- Will be generated server-side
  skill_filter := NULL,
  location_filter := NULL,
  stage_filter := NULL,
  status_filter := NULL,
  min_ctc := NULL,
  max_ctc := NULL,
  match_count := ${pageSize},
  min_similarity := 0.5
);

Or use direct SQL with vector similarity:
WHERE 1 - (embedding <=> query_embedding) > 0.5

Always include LIMIT ${pageSize} OFFSET ${offset} for pagination.`;

  const systemPrompt = `You are a SQL query generator for employee search.

CRITICAL RULES:
- Output ONLY valid PostgreSQL SELECT SQL.
- Do NOT return JSON.
- Do NOT explain anything.
- Do NOT include comments.
- Use parameterized WHERE clauses when possible.
- Always include LIMIT and OFFSET for pagination.
- ONLY query the 'employees' table - NEVER use the 'users' table.
- The 'employees' table contains employee/candidate data with fields like full_name, candidate_id, skill, etc.
- The 'users' table is completely different and should NEVER be used for employee searches.
- For searching by NAME or PERSON: Use direct SQL with ILIKE on full_name and candidate_id fields (do NOT require embeddings).
- For skill/location searches: Use the hybrid_search_employees function for semantic search, or direct SQL with vector similarity.
- IMPORTANT: When user searches for a specific person by name, prioritize exact/partial name matching over semantic search.

Schema:
${schemaContext}

Example queries:
User: "Find SAP developers in Bengaluru"
SQL: SELECT id, candidate_id, full_name, skill, current_location, expected_ctc_numeric, stage, status FROM employees WHERE skill ILIKE '%SAP%' AND (current_location ILIKE '%Bengaluru%' OR preferred_location ILIKE '%Bengaluru%') LIMIT 25 OFFSET 0;

User: "Show employees with CTC above 20 LPA"
SQL: SELECT id, candidate_id, full_name, skill, expected_ctc_numeric, current_ctc_numeric FROM employees WHERE COALESCE(expected_ctc_numeric, current_ctc_numeric, 0) >= 2000000 LIMIT 25 OFFSET 0;

User: "Find experienced Java consultants"
SQL: SELECT * FROM hybrid_search_employees('experienced Java consultant', NULL::vector, NULL, NULL, NULL, NULL, NULL, NULL, 25, 0.5) LIMIT 25 OFFSET 0;

User: "Find John Smith" or "Show me John" or "Search for employee named John"
SQL: SELECT * FROM employees WHERE full_name ILIKE '%John%' OR full_name ILIKE '%John Smith%' OR candidate_id ILIKE '%John%' OR email ILIKE '%John%' LIMIT 25 OFFSET 0;

User: "Find employee with candidate ID KudzuC-0003767"
SQL: SELECT * FROM employees WHERE candidate_id = 'KudzuC-0003767' OR candidate_id ILIKE '%KudzuC-0003767%' LIMIT 25 OFFSET 0;

User: "Show me Neeraj Verma"
SQL: SELECT * FROM employees WHERE full_name ILIKE '%Neeraj%' AND full_name ILIKE '%Verma%' OR full_name ILIKE '%Neeraj Verma%' LIMIT 25 OFFSET 0;

IMPORTANT: When searching for a specific person by name:
- Use ILIKE with wildcards (%) for partial name matching
- Search full_name, candidate_id, and email fields
- For full names, try both combined search (ILIKE '%FirstName LastName%') and individual parts
- Do NOT require embeddings for name searches - use direct WHERE clauses
- Always include LIMIT and OFFSET for pagination
- If the query looks like a person's name (contains common name patterns), prioritize name matching over semantic search`;

  try {
    // Create AbortController for timeout handling
    // Reduced timeout for faster failure - Ollama should respond quickly if model is loaded
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout (reduced from 120)

    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Generate a PostgreSQL SELECT query for: "${params.query}"\n\nInclude LIMIT ${pageSize} OFFSET ${offset}.\n\nIf this looks like a person's name (e.g., "John Smith", "Neeraj", "Find John"), prioritize searching the full_name and candidate_id fields using ILIKE with wildcards. Do NOT require embeddings for name searches.`,
          },
        ],
        options: {
          temperature: 0.3, // Lower temperature for more deterministic SQL
          num_predict: 150, // Reduced from 200 - SQL queries should be short and fast
        },
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate SQL: ${errorText}`);
    }

    const data = await response.json() as any;
    
    // Ollama response format: { "message": { "content": "..." } }
    let sql = '';
    if (data.message?.content) {
      sql = data.message.content.trim();
    } else if (data.content) {
      sql = data.content.trim();
    } else if (typeof data === 'string') {
      sql = data.trim();
    } else {
      throw new Error('Unexpected Ollama response format');
    }

    // Remove markdown code blocks if present
    let cleanSQL = sql.replace(/^```sql\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/i, '').trim();

    // Auto-fix common mistakes: replace 'users' table with 'employees' table
    // This handles cases where the model incorrectly uses 'users' instead of 'employees'
    if (cleanSQL.toLowerCase().includes('from users') || cleanSQL.toLowerCase().includes('join users')) {
      console.warn('[SQL Generation] Detected incorrect table name "users", auto-correcting to "employees"');
      cleanSQL = cleanSQL
        .replace(/FROM\s+users\b/gi, 'FROM employees')
        .replace(/JOIN\s+users\b/gi, 'JOIN employees')
        .replace(/,\s*users\b/gi, ', employees')
        .replace(/\busers\./gi, 'employees.');
    }

    // Log the generated SQL for auditing
    logSQLQuery(cleanSQL, {
      userQuery: params.query,
    });

    return { sql: cleanSQL };
  } catch (error: any) {
    console.error('SQL generation error:', error);
    
    // Handle timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('timed out')) {
      throw new Error('Request to Ollama timed out. The model may be loading. Please ensure Ollama is running and the model is loaded. Start Ollama with: `ollama serve` and preload the model with: `ollama pull ' + ollamaModel + '`');
    }
    
    // Handle connection errors
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed') || error.message?.includes('Connection')) {
      throw new Error('Cannot connect to Ollama. Please ensure Ollama is running on ' + ollamaUrl + '. Start it with: ollama serve');
    }
    
    // Handle other errors
    if (error.message) {
      throw new Error(`Failed to generate SQL: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Execute validated SQL query for employee search
 */
async function executeEmployeeSearchSQL(
  sql: string,
  options: {
    page?: number;
    pageSize?: number;
    userId?: string;
  } = {}
): Promise<{
  rows: any[];
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    total?: number;
  };
}> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 25;

  try {
    // Validate SQL
    const validation = validateEmployeeSearchSQL(sql, {
      maxLimit: 100,
      defaultLimit: pageSize,
      requireLimit: true,
    });

    if (!validation.isValid) {
      throw new Error(validation.error || 'SQL validation failed');
    }

    // Use sanitized SQL if available
    const finalSQL = validation.sanitizedSQL || sql;

    // Log warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('[SQL Validation Warnings]', validation.warnings);
    }

    // Execute query
    const result = await query(finalSQL, []);

    // Determine if there are more results
    const hasMore = result.rows.length === pageSize;

    return {
      rows: result.rows,
      pagination: {
        page,
        pageSize,
        hasMore,
      },
    };
  } catch (error: any) {
    console.error('SQL execution error:', error);
    // Provide user-friendly error messages
    if (error.message?.includes('syntax error')) {
      throw new Error('Invalid SQL query syntax. Please try rephrasing your search.');
    }
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      throw new Error('Query references a column that does not exist. Please check your search criteria.');
    }
    throw new Error(`Database query failed: ${error.message || 'Unknown error'}`);
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
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for current information, news, or facts. Use this when users ask about recent events, need up-to-date information, or want to search the internet. Returns relevant web search results with titles, URLs, and content snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string to search the web for',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5, max: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch the content of a specific web page by URL. Use this when users want to read a specific webpage or need detailed content from a URL.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the web page to fetch',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_employee_search_sql',
      description: 'Generate a PostgreSQL SELECT SQL query for searching employees in the EMPLOYEES table (NOT the users table). The employees table EXISTS and contains employee/candidate data. Use this when users ask about employees, candidates, consultants, developers, search by skill, location, experience, or any professional services. IMPORTANT: Always query the "employees" table, never the "users" table. The tool generates SQL that will be executed to find matching employees. ALWAYS use this tool when users search by skill (e.g., "Java developers", "SAP consultants", "SAP FICO consultants", "Python engineers") or location (e.g., "developers in Bengaluru", "candidates from Mumbai"). DO NOT respond with text - always use this tool for employee searches.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query describing what employees to find. Examples: "SAP developers in Bengaluru", "Java consultants with 5+ years experience", "employees with CTC above 20 LPA", "Python developers", "React engineers in Mumbai", "show all Java developers", "find all candidates with SAP skill". Always include the skill name and optionally location in the query.',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (default: 1)',
          },
          pageSize: {
            type: 'number',
            description: 'Number of results per page (default: 25, max: 100)',
          },
        },
        required: ['query'],
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
  // Set SSE headers early
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      // For SSE, send error event instead of JSON
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
      res.end();
      return;
    }

    // Use Ollama instead of OpenAI
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
    // Default to llama3.1:8b if qwen3 is not available, as it also supports tool calling
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    
    // Quick health check
    const isReady = await checkOllamaReady(ollamaUrl, ollamaModel);
    if (!isReady) {
      console.warn('[Ollama] Health check failed - Ollama may not be ready. Proceeding anyway...');
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

    // SSE headers already set above

    const systemPrompt = `You are a helpful AI assistant for Xerow.ai. Your role is to help users discover products, search for employees/candidates, answer questions, search the web for current information, and provide recommendations.

CRITICAL RULE: You have DIRECT ACCESS to an employee database through tools. NEVER say you don't have access to employee data. ALWAYS use the generate_employee_search_sql tool when users ask about employees, candidates, consultants, developers, or search by skill/location.

Available Tools:
- web_search: Search the web for current information, news, or facts. Use this for recent events, up-to-date information, or general web searches.
- web_fetch: Fetch content from a specific web page by URL. Use this when users want to read a specific webpage.
- search_products: Search for products by query, category, price range, etc.
- get_recipe: Get recipes with ingredients matched to available products
- get_grocery_insights: Get grocery spending insights from user's order history (requires authentication)
- compare_products: Compare multiple products side-by-side with detailed analysis
- generate_employee_search_sql: Generate SQL query for searching employees, candidates, consultants, developers, or professional services. IMPORTANT: This tool searches the "employees" table (NOT the "users" table). The employees table EXISTS and contains employee/candidate data. ALWAYS use this tool when users search by skill (e.g., "Java developers", "SAP consultants", "SAP FICO consultants", "Python engineers", "show all React developers"), location (e.g., "developers in Bengaluru"), experience, or any employee-related search. When users ask about people, employees, candidates, search for names, or search by skill/location, you MUST use this tool. DO NOT respond with text saying you don't have access - USE THE TOOL. Example: User says "find SAP FICO consultants" -> You MUST call generate_employee_search_sql with query="SAP FICO consultants". DO NOT say the table doesn't exist.

Guidelines:
- Be friendly, helpful, and conversational
- When users ask about current events, recent news, or need up-to-date information, use the web_search tool
- When users provide a specific URL and want to read its content, use the web_fetch tool
- When users ask about products, use the search_products tool to find relevant products
- CRITICAL: When users ask about employees, candidates, consultants, developers, professional services, search by skill (e.g., "Java developers", "SAP consultants", "SAP FICO consultants", "show all Python engineers"), search by location, or search for a person's name, you MUST ALWAYS use the generate_employee_search_sql tool. DO NOT say the table doesn't exist. DO NOT suggest searching LinkedIn or other sites. DO NOT say you don't have access to employee data. USE THE TOOL IMMEDIATELY. Examples: "find SAP FICO consultants" -> call tool with query="SAP FICO consultants". "show me Java developers" -> call tool with query="Java developers". "find employees in Bengaluru" -> call tool with query="employees in Bengaluru".
- IMPORTANT: The "employees" table EXISTS and contains employee/candidate data. The "users" table is for system users/accounts. Never confuse these two tables.
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

    // Make Ollama API calls with tool calling support
    let currentMessages = [...messages];
    let maxIterations = 5; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        // Log tool availability for debugging
        console.log('[Ollama Request] Tools available:', tools.length);
        console.log('[Ollama Request] Tool names:', tools.map((t: any) => t.function?.name || t.name));
        console.log('[Ollama Request] Last user message:', currentMessages.filter((m: any) => m.role === 'user').pop()?.content);
        
        const requestBody = {
          model: ollamaModel,
          messages: currentMessages,
          tools: tools,
          stream: true, // Enable streaming
          options: {
            temperature: 0.7,
            num_predict: 1000,
          },
        };
        
        console.log('[Ollama Request] Request body (without messages):', {
          model: requestBody.model,
          toolsCount: requestBody.tools.length,
          stream: requestBody.stream,
        });
        
        const response = await fetch(ollamaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Ollama API error: ${response.status} - ${errorData}`);
          
          // Try to parse error details
          let errorMessage = 'Failed to get AI response from Ollama';
          let errorDetails = errorData;
          
          try {
            const parsedError = JSON.parse(errorData);
            if (parsedError.error) {
              errorMessage = parsedError.error;
              // Check if it's a model not found error
              if (errorMessage.includes("not found") || errorMessage.includes("model")) {
                errorMessage = `Model '${ollamaModel}' not found. Please ensure Ollama is running and the model is installed.`;
                errorDetails = `Run: ollama pull ${ollamaModel}`;
              }
              // Handle nested JSON in details
              if (parsedError.details && typeof parsedError.details === 'string') {
                try {
                  const nestedDetails = JSON.parse(parsedError.details);
                  if (nestedDetails.error) {
                    errorMessage = nestedDetails.error;
                  }
                } catch {
                  // Keep original details string
                }
              }
            }
          } catch {
            // Use raw error data if parsing fails
            if (errorData.includes("not found") || errorData.includes("model")) {
              errorMessage = `Model '${ollamaModel}' not found. Please ensure Ollama is running and the model is installed.`;
              errorDetails = `Run: ollama pull ${ollamaModel}`;
            }
          }
          
          sendEvent('error', { 
            error: errorMessage,
            details: errorDetails,
            suggestion: `Try running: ollama pull ${ollamaModel}`
          });
          res.end();
          return;
        }

        // Parse NDJSON stream (newline-delimited JSON)
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          sendEvent('error', { 
            error: 'No response body reader available',
            details: 'Ollama streaming response could not be read'
          });
          res.end();
          return;
        }

        // Accumulate streaming fields
        let thinking = '';
        let content = '';
        const toolCalls: any[] = [];
        const toolCallIdMap = new Map<number | string, string>(); // Map tool call index/id to our generated ID
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines (NDJSON format)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue; // Skip empty lines
            
            try {
              const chunk = JSON.parse(line);
              
              // Accumulate thinking
              if (chunk.message?.thinking) {
                thinking += chunk.message.thinking;
              }
              
              // Accumulate content and stream it
              if (chunk.message?.content) {
                content += chunk.message.content;
                // Stream text incrementally
                sendEvent('text', { text: chunk.message.content });
              }
              
              // Accumulate tool calls (they may come in chunks)
              if (chunk.message?.tool_calls) {
                for (const toolCall of chunk.message.tool_calls) {
                  // Check if we already have this tool call (by index or id)
                  const existingIndex = toolCall.function?.index !== undefined 
                    ? toolCalls.findIndex(tc => tc.function?.index === toolCall.function.index)
                    : -1;
                  
                  if (existingIndex >= 0) {
                    // Merge with existing tool call (arguments may be partial)
                    const existing = toolCalls[existingIndex];
                    if (toolCall.function?.arguments) {
                      // Merge arguments (may be partial JSON strings)
                      let existingArgs = existing.function?.arguments || {};
                      if (typeof existingArgs === 'string') {
                        try {
                          existingArgs = JSON.parse(existingArgs);
                        } catch {
                          existingArgs = {};
                        }
                      }
                      
                      let newArgs = toolCall.function.arguments;
                      if (typeof newArgs === 'string') {
                        try {
                          newArgs = JSON.parse(newArgs);
                        } catch {
                          // Partial JSON, keep as string for now
                        }
                      }
                      
                      // Merge arguments
                      if (typeof newArgs === 'object' && typeof existingArgs === 'object') {
                        existing.function = {
                          ...existing.function,
                          ...toolCall.function,
                          arguments: { ...existingArgs, ...newArgs }
                        };
                      } else if (typeof newArgs === 'string') {
                        // Still partial, append to string
                        existing.function = {
                          ...existing.function,
                          ...toolCall.function,
                          arguments: (typeof existingArgs === 'string' ? existingArgs : '') + newArgs
                        };
                      }
                    }
                  } else {
                    // New tool call - emit event immediately
                    const toolCallKey = toolCall.function?.index !== undefined 
                      ? toolCall.function.index 
                      : (toolCall.id || toolCalls.length);
                    const newToolCallId = `tool-${toolCallKey}-${Date.now()}`;
                    const newFunctionName = toolCall.function?.name || toolCall.name;
                    const newFunctionArgs = typeof toolCall.function?.arguments === 'string'
                      ? (() => {
                          try {
                            return JSON.parse(toolCall.function.arguments);
                          } catch {
                            return toolCall.function.arguments; // Keep as string if partial
                          }
                        })()
                      : (toolCall.function?.arguments || toolCall.arguments || {});
                    
                    // Store the ID mapping for later use
                    toolCallIdMap.set(toolCallKey, newToolCallId);
                    
                    // Emit tool-call event as soon as we detect it
                    sendEvent('tool', {
                      type: 'tool-call',
                      toolCallId: newToolCallId,
                      toolName: newFunctionName,
                      args: newFunctionArgs
                    });
                    
                    toolCalls.push(toolCall);
                  }
                }
              }
            } catch (parseError) {
              // Check if this is an error line from Ollama
              if (line.includes('"error"') || line.includes('error')) {
                try {
                  // Try to extract error message
                  const errorMatch = line.match(/"error"\s*:\s*"([^"]+)"/);
                  if (errorMatch) {
                    const errorMsg = errorMatch[1];
                    sendEvent('error', { 
                      error: errorMsg,
                      details: 'Ollama returned an error during streaming'
                    });
                    res.end();
                    return;
                  }
                } catch {
                  // Fall through to skip
                }
              }
              // Skip malformed JSON lines (but log for debugging)
              console.warn('[Ollama Stream] Failed to parse line:', line.substring(0, 200));
            }
          }
        }

        // Build complete message from accumulated fields
        const message: any = {
          content: content || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        };

        if (thinking) {
          message.thinking = thinking;
        }

        // Add assistant message to conversation
        currentMessages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls || [],
          ...(message.thinking && { thinking: message.thinking }),
        });

        // Check if the AI responded with text that suggests it should have used a tool
        // If content mentions "table doesn't exist" or "don't have access" for employee searches, force tool usage
        try {
          const contentLower = (typeof message.content === 'string' ? message.content : '').toLowerCase();
          const lastUserMessage = currentMessages.filter((m: any) => m.role === 'user').pop();
          const userMessageText = (typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '').toLowerCase();
          const shouldUseEmployeeTool = userMessageText.includes('employee') || 
                                        userMessageText.includes('candidate') || 
                                        userMessageText.includes('consultant') || 
                                        userMessageText.includes('developer') ||
                                        userMessageText.includes('skill') ||
                                        userMessageText.includes('sap') ||
                                        userMessageText.includes('java') ||
                                        userMessageText.includes('python') ||
                                        userMessageText.includes('fico');
          
          const incorrectResponse = shouldUseEmployeeTool && 
                                   (contentLower.includes("table doesn't exist") || 
                                    contentLower.includes("don't have access") ||
                                    contentLower.includes("don't have direct access") ||
                                    contentLower.includes("as a text-based") ||
                                    contentLower.includes("unfortunately") ||
                                    contentLower.includes("i don't have"));
          
          if (incorrectResponse && (!message.tool_calls || message.tool_calls.length === 0)) {
            console.warn('[Tool Call] AI responded with text instead of using tool for employee search. Forcing tool usage.');
            console.warn('[Tool Call] User message:', lastUserMessage?.content);
            console.warn('[Tool Call] AI response:', message.content);
            // Force tool call by creating one
            const userQuery = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : 'employee search';
            message.tool_calls = [{
              function: {
                name: 'generate_employee_search_sql',
                arguments: JSON.stringify({ query: userQuery }),
              },
              id: `forced-${Date.now()}`,
            }];
            message.content = null; // Clear the incorrect text response
          }
        } catch (error) {
          console.error('[Tool Call] Error in fallback detection:', error);
          // Continue without forcing tool usage if there's an error
        }

        // Check if tool calls are requested
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Tool-call events were emitted during streaming when detected
          // Now execute the tools with complete arguments
          for (const toolCall of message.tool_calls) {
            // Ollama tool call format: { "function": { "name": "...", "arguments": {...} } }
            // Use the same ID that was emitted during streaming
            const toolCallKey = toolCall.function?.index !== undefined 
              ? toolCall.function.index 
              : (toolCall.id || toolCalls.indexOf(toolCall));
            const toolCallId = toolCallIdMap.get(toolCallKey) || `tool-${toolCallKey}-${Date.now()}`;
            const functionName = toolCall.function?.name || toolCall.name;
            // Ollama may return arguments as object or string - parse complete arguments
            let functionArgs: any = {};
            if (toolCall.function?.arguments) {
              if (typeof toolCall.function.arguments === 'string') {
                try {
                  functionArgs = JSON.parse(toolCall.function.arguments);
                } catch {
                  // If parsing fails, try to extract what we can
                  console.warn('[Tool Call] Failed to parse arguments as JSON:', toolCall.function.arguments);
                  functionArgs = {};
                }
              } else {
                functionArgs = toolCall.function.arguments;
              }
            } else if (toolCall.arguments) {
              functionArgs = toolCall.arguments;
            }
            
            console.log('[Tool Call] Executing tool:', functionName, 'with args:', functionArgs);

          // Execute tool function
          let toolResult: any;
          try {
            if (functionName === 'web_search') {
              // Validate required parameters
              if (!functionArgs.query) {
                throw new Error('web_search requires a "query" parameter');
              }
              const webSearchResult = await webSearch(functionArgs);
              
              // Format web search results for Citation component
              // webSearch returns: { results: [{ title, url, content }] }
              // We need to format it as: { role: 'information', citations: [...] }
              const citations = (webSearchResult.results || []).map((item: any, index: number) => {
                const url = item.url || '';
                let domain = '';
                try {
                  if (url) {
                    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://') 
                      ? url 
                      : `https://${url}`;
                    const urlObj = new URL(urlWithProtocol);
                    domain = urlObj.hostname.replace('www.', '');
                  }
                } catch {
                  const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
                  domain = match ? match[1] : '';
                }
                
                return {
                  id: `citation-${toolCallId}-${index}`,
                  href: url,
                  title: item.title || 'Untitled',
                  snippet: item.content || item.snippet || '',
                  domain: domain,
                  favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : undefined,
                  type: 'webpage' as const,
                };
              });
              
              // Format as Tool UI WebSearchResults
              toolResult = {
                id: `web-search-${toolCallId}`,
                role: 'information',
                title: `Web Search Results for "${functionArgs.query}"`,
                description: `Found ${citations.length} result${citations.length !== 1 ? 's' : ''}`,
                citations: citations,
                variant: 'default',
              };
              
              console.log('[Web Search] Formatted result:', JSON.stringify(toolResult, null, 2));
              console.log('[Web Search] Citations count:', citations.length);
            } else if (functionName === 'web_fetch') {
              toolResult = await webFetch(functionArgs);
            } else if (functionName === 'search_products') {
              toolResult = await searchProducts(functionArgs);
            } else if (functionName === 'generate_employee_search_sql') {
              const startTime = Date.now();
              const page = functionArgs.page || 1;
              const pageSize = functionArgs.pageSize || 25;
              const offset = (page - 1) * pageSize;
              
              // Send initial progress update
              sendEvent('tool', {
                type: 'tool-progress',
                toolCallId: toolCallId,
                toolName: functionName,
                progress: {
                  id: `employee-search-${toolCallId}`,
                  role: 'state',
                  steps: [
                    {
                      id: 'generate-sql',
                      label: 'Generating SQL Query',
                      description: 'Translating your search into a database query',
                      status: 'in-progress',
                    },
                    {
                      id: 'execute-query',
                      label: 'Executing Query',
                      description: 'Searching employee database',
                      status: 'pending',
                    },
                    {
                      id: 'format-results',
                      label: 'Formatting Results',
                      description: 'Preparing results for display',
                      status: 'pending',
                    },
                  ],
                  elapsedTime: Date.now() - startTime,
                },
              });

              // Step 1: Generate SQL from natural language query
              let sql: string;
              try {
                const sqlResult = await generateEmployeeSearchSQL({
                  query: functionArgs.query,
                  page: functionArgs.page || 1,
                  pageSize: functionArgs.pageSize || 25,
                });
                sql = sqlResult.sql;

                // Update progress: SQL generation complete
                sendEvent('tool', {
                  type: 'tool-progress',
                  toolCallId: toolCallId,
                  toolName: functionName,
                  progress: {
                    id: `employee-search-${toolCallId}`,
                    role: 'state',
                    steps: [
                      {
                        id: 'generate-sql',
                        label: 'Generating SQL Query',
                        description: 'Translating your search into a database query',
                        status: 'completed',
                      },
                      {
                        id: 'execute-query',
                        label: 'Executing Query',
                        description: 'Searching employee database',
                        status: 'in-progress',
                      },
                      {
                        id: 'format-results',
                        label: 'Formatting Results',
                        description: 'Preparing results for display',
                        status: 'pending',
                      },
                    ],
                    elapsedTime: Date.now() - startTime,
                  },
                });
              } catch (error: any) {
                // Update progress: SQL generation failed
                sendEvent('tool', {
                  type: 'tool-progress',
                  toolCallId: toolCallId,
                  toolName: functionName,
                  progress: {
                    id: `employee-search-${toolCallId}`,
                    role: 'state',
                    steps: [
                      {
                        id: 'generate-sql',
                        label: 'Generating SQL Query',
                        description: error.message || 'Failed to generate SQL',
                        status: 'failed',
                      },
                      {
                        id: 'execute-query',
                        label: 'Executing Query',
                        description: 'Skipped due to previous error',
                        status: 'pending',
                      },
                      {
                        id: 'format-results',
                        label: 'Formatting Results',
                        description: 'Skipped due to previous error',
                        status: 'pending',
                      },
                    ],
                    elapsedTime: Date.now() - startTime,
                  },
                });
                throw error;
              }

              // Step 2: Execute the SQL query
              let executionResult: any;
              try {
                executionResult = await executeEmployeeSearchSQL(sql, {
                  page: functionArgs.page || 1,
                  pageSize: functionArgs.pageSize || 25,
                  userId: userId,
                });

                // If no results and query looks like a name, try a more flexible name search
                if (executionResult.rows.length === 0 && functionArgs.query) {
                  const queryLower = functionArgs.query.toLowerCase().trim();
                  // Check if query looks like a person's name (contains common name patterns or is short)
                  const looksLikeName = queryLower.split(/\s+/).length <= 3 && 
                                       !queryLower.includes('developer') && 
                                       !queryLower.includes('engineer') && 
                                       !queryLower.includes('consultant') &&
                                       !queryLower.includes('skill') &&
                                       !queryLower.includes('location');
                  
                  if (looksLikeName) {
                    console.log('[Employee Search] No results found, trying flexible name search for:', functionArgs.query);
                    
                    // Try a more flexible name search
                    const nameParts = functionArgs.query.trim().split(/\s+/);
                    let fallbackSQL = `SELECT * FROM employees WHERE (`;
                    const conditions: string[] = [];
                    
                    // Search each name part in full_name
                    for (const part of nameParts) {
                      if (part.length > 2) { // Only search parts longer than 2 characters
                        conditions.push(`full_name ILIKE '%${part}%'`);
                      }
                    }
                    
                    // Also search the full query string
                    conditions.push(`full_name ILIKE '%${functionArgs.query}%'`);
                    conditions.push(`candidate_id ILIKE '%${functionArgs.query}%'`);
                    conditions.push(`email ILIKE '%${functionArgs.query}%'`);
                    
                    const fallbackOffset = ((functionArgs.page || 1) - 1) * (functionArgs.pageSize || 25);
                    fallbackSQL += conditions.join(' OR ') + `) LIMIT ${functionArgs.pageSize || 25} OFFSET ${fallbackOffset}`;
                    
                    try {
                      const fallbackResult = await executeEmployeeSearchSQL(fallbackSQL, {
                        page: functionArgs.page || 1,
                        pageSize: functionArgs.pageSize || 25,
                        userId: userId,
                      });
                      
                      if (fallbackResult.rows.length > 0) {
                        console.log('[Employee Search] Fallback search found', fallbackResult.rows.length, 'results');
                        executionResult = fallbackResult;
                      }
                    } catch (fallbackError) {
                      console.warn('[Employee Search] Fallback search failed:', fallbackError);
                      // Continue with original empty result
                    }
                  }
                }

                // Update progress: Query execution complete
                sendEvent('tool', {
                  type: 'tool-progress',
                  toolCallId: toolCallId,
                  toolName: functionName,
                  progress: {
                    id: `employee-search-${toolCallId}`,
                    role: 'state',
                    steps: [
                      {
                        id: 'generate-sql',
                        label: 'Generating SQL Query',
                        description: 'Translating your search into a database query',
                        status: 'completed',
                      },
                      {
                        id: 'execute-query',
                        label: 'Executing Query',
                        description: `Found ${executionResult.rows.length} employees`,
                        status: 'completed',
                      },
                      {
                        id: 'format-results',
                        label: 'Formatting Results',
                        description: 'Preparing results for display',
                        status: 'in-progress',
                      },
                    ],
                    elapsedTime: Date.now() - startTime,
                  },
                });
              } catch (error: any) {
                // Update progress: Query execution failed
                sendEvent('tool', {
                  type: 'tool-progress',
                  toolCallId: toolCallId,
                  toolName: functionName,
                  progress: {
                    id: `employee-search-${toolCallId}`,
                    role: 'state',
                    steps: [
                      {
                        id: 'generate-sql',
                        label: 'Generating SQL Query',
                        description: 'Translating your search into a database query',
                        status: 'completed',
                      },
                      {
                        id: 'execute-query',
                        label: 'Executing Query',
                        description: error.message || 'Failed to execute query',
                        status: 'failed',
                      },
                      {
                        id: 'format-results',
                        label: 'Formatting Results',
                        description: 'Skipped due to previous error',
                        status: 'pending',
                      },
                    ],
                    elapsedTime: Date.now() - startTime,
                  },
                });
                throw error;
              }

              // Step 3: Extract filters from SQL query for accurate display
              // Parse SQL to extract skill, location, and other filters
              const extractedFilters: { skill?: string; location?: string; stage?: string; status?: string; minCTC?: number; maxCTC?: number } = {};
              
              if (sql) {
                // Extract skill from SQL WHERE clauses (multiple patterns)
                const skillPatterns = [
                  /skill\s+ILIKE\s+['"]%([^%'"]+)%['"]/i,
                  /skill\s*=\s*['"]([^'"]+)['"]/i,
                  /skill\s+LIKE\s+['"]%([^%'"]+)%['"]/i,
                ];
                
                for (const pattern of skillPatterns) {
                  const match = sql.match(pattern);
                  if (match && match[1]) {
                    extractedFilters.skill = match[1].trim();
                    console.log('[Employee Search] Extracted skill from SQL:', extractedFilters.skill);
                    break;
                  }
                }
                
                // Extract location from SQL
                const locationPatterns = [
                  /(?:current_location|preferred_location)\s+ILIKE\s+['"]%([^%'"]+)%['"]/i,
                  /(?:current_location|preferred_location)\s*=\s*['"]([^'"]+)['"]/i,
                ];
                
                for (const pattern of locationPatterns) {
                  const match = sql.match(pattern);
                  if (match && match[1]) {
                    extractedFilters.location = match[1].trim();
                    console.log('[Employee Search] Extracted location from SQL:', extractedFilters.location);
                    break;
                  }
                }
                
                // Extract stage from SQL
                const stageMatch = sql.match(/stage\s+ILIKE\s+['"]%([^%'"]+)%['"]/i);
                if (stageMatch && stageMatch[1]) {
                  extractedFilters.stage = stageMatch[1].trim();
                  console.log('[Employee Search] Extracted stage from SQL:', extractedFilters.stage);
                }
                
                // Extract status from SQL
                const statusMatch = sql.match(/status\s+ILIKE\s+['"]%([^%'"]+)%['"]/i);
                if (statusMatch && statusMatch[1]) {
                  extractedFilters.status = statusMatch[1].trim();
                  console.log('[Employee Search] Extracted status from SQL:', extractedFilters.status);
                }
                
                // Extract min CTC from SQL
                const minCTCMatch = sql.match(/(?:expected_ctc_numeric|current_ctc_numeric)\s*>=\s*(\d+)/i);
                if (minCTCMatch && minCTCMatch[1]) {
                  extractedFilters.minCTC = parseInt(minCTCMatch[1], 10);
                  console.log('[Employee Search] Extracted min CTC from SQL:', extractedFilters.minCTC);
                }
              }
              
              // Fallback: Try to extract from natural language query if SQL extraction didn't work
              if (!extractedFilters.skill && functionArgs.query) {
                const queryLower = functionArgs.query.toLowerCase();
                // Look for common skill patterns in query
                const skillKeywords = ['java', 'python', 'react', 'node', 'angular', 'vue', 'sap', 'oracle', 'sql', 'javascript', 'typescript', 'aws', 'azure', 'gcp', 'docker', 'kubernetes'];
                for (const keyword of skillKeywords) {
                  if (queryLower.includes(keyword)) {
                    extractedFilters.skill = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                    console.log('[Employee Search] Extracted skill from query:', extractedFilters.skill);
                    break;
                  }
                }
              }
              
              console.log('[Employee Search] Extracted filters:', extractedFilters);
              console.log('[Employee Search] Results count:', executionResult.rows.length);
              
              // Step 4: Format results as Item Carousel with extracted filters
              const formatted = formatEmployeeSearchAsItemCarousel(
                executionResult.rows,
                functionArgs.query,
                Object.keys(extractedFilters).length > 0 ? extractedFilters : undefined
              );
              
              console.log('[Employee Search] Formatted carousel:', {
                title: formatted.title,
                description: formatted.description,
                itemsCount: formatted.items?.length || 0
              });

              // Update progress: Formatting complete
              sendEvent('tool', {
                type: 'tool-progress',
                toolCallId: toolCallId,
                toolName: functionName,
                progress: {
                  id: `employee-search-${toolCallId}`,
                  role: 'state',
                  steps: [
                    {
                      id: 'generate-sql',
                      label: 'Generating SQL Query',
                      description: 'Translating your search into a database query',
                      status: 'completed',
                    },
                    {
                      id: 'execute-query',
                      label: 'Executing Query',
                      description: `Found ${executionResult.rows.length} employees`,
                      status: 'completed',
                    },
                    {
                      id: 'format-results',
                      label: 'Formatting Results',
                      description: 'Preparing results for display',
                      status: 'completed',
                    },
                  ],
                  elapsedTime: Date.now() - startTime,
                  receipt: {
                    outcome: 'success',
                    summary: `Found ${executionResult.rows.length} employees`,
                    at: new Date().toISOString(),
                  },
                },
              });

              // Return the formatted ItemCarousel (extra fields like pagination/sql are ignored by schema)
              // The schema will validate the core ItemCarousel structure
              toolResult = formatted;
              
              // Log pagination and SQL for debugging (not included in result to avoid schema issues)
              console.log('[Employee Search] Pagination:', executionResult.pagination);
              console.log('[Employee Search] Generated SQL:', sql);
              console.log('[Employee Search] Formatted result type:', formatted.role);
              console.log('[Employee Search] Formatted result items count:', formatted.items?.length || 0);
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
          console.log('[Tool Result] Sending tool result for:', functionName, 'toolCallId:', toolCallId);
          console.log('[Tool Result] Result type:', toolResult?.role || typeof toolResult);
          console.log('[Tool Result] Result keys:', Object.keys(toolResult || {}));
          
          sendEvent('tool', {
            type: 'tool-result',
            toolCallId: toolCallId,
            toolName: functionName,
            result: toolResult
          });

          // Add tool result to conversation (Ollama format)
          currentMessages.push({
            role: 'tool',
            tool_name: functionName,
            content: JSON.stringify(toolResult)
          });
          }

          // Continue loop to get final response
          continue;
        }

      // No tool calls - text was already streamed during NDJSON parsing
      // Just send done event
      sendEvent('done', {});
      res.end();
      return;
      } catch (error: any) {
        console.error('Ollama API call error:', error);
        
        // Handle timeout errors
        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
          sendEvent('error', { 
            error: 'Request to Ollama timed out. Please ensure Ollama is running and the model is loaded.',
            details: 'Start Ollama with: `ollama serve` and preload the model with: `ollama pull ' + ollamaModel + '`'
          });
        } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
          sendEvent('error', { 
            error: 'Cannot connect to Ollama. Please ensure Ollama is running.',
            details: 'Start it with: `ollama serve`'
          });
        } else {
          sendEvent('error', { 
            error: 'Failed to get AI response',
            details: error.message || 'Unknown error'
          });
        }
        res.end();
        return;
      }
    }

    // Max iterations reached
    sendEvent('error', { error: 'Maximum iterations reached' });
    res.end();
  } catch (error: any) {
    console.error('Streaming chat error:', error);
    console.error('Streaming chat error stack:', error.stack);
    
    // Ensure headers are set before sending error
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ 
        error: error.message || 'Failed to process AI request',
        details: error.stack || 'Unknown error'
      })}\n\n`);
    } catch (writeError) {
      console.error('Failed to write error to response:', writeError);
    }
    
    try {
      res.end();
    } catch (endError) {
      console.error('Failed to end response:', endError);
    }
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
