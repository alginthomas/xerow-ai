import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const app = new Hono();

// Initialize Supabase admin client for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Helper function to get authenticated user from request
const getAuthenticatedUser = async (c: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    console.log('No Authorization header found');
    return { user: null, error: 'No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    console.log('No token in Authorization header');
    return { user: null, error: 'No token provided' };
  }

  console.log('Validating token with service role...');
  
  try {
    // Use admin client to verify the JWT - this properly validates tokens
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error) {
      console.log('Token validation error:', error.message);
      return { user: null, error: error.message };
    }

    if (!user) {
      console.log('No user found from token');
      return { user: null, error: 'Invalid token' };
    }

    console.log('User authenticated successfully:', user.email);
    return { user, error: null };
  } catch (err) {
    console.log('Exception during token validation:', err);
    return { user: null, error: 'Token validation failed' };
  }
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-bffba348/health", (c) => {
  return c.json({ status: "ok", version: "2024-12-27-v2", supabaseConfigured: !!Deno.env.get('SUPABASE_URL') });
});

// ==================== AUTH ROUTES ====================

// Sign up endpoint
app.post("/make-server-bffba348/auth/signup", async (c) => {
  try {
    const { email, password, name, role = 'customer' } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Validate role
    const validRoles = ['customer', 'seller', 'admin'];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Invalid role. Must be customer, seller, or admin" }, 400);
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Signup error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Create user profile in KV store immediately after signup
    if (data.user) {
      const userData = {
        id: data.user.id,
        email: data.user.email,
        name: name,
        role: role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await kv.set(`user:${data.user.id}`, userData);
      console.log(`User profile created in KV store for ${email} with role ${role}`);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Signup exception: ${error}`);
    return c.json({ error: "Internal server error during signup" }, 500);
  }
});

// ==================== PRODUCT ROUTES ====================

// Get all products (with optional filtering)
app.get("/make-server-bffba348/products", async (c) => {
  try {
    const category = c.req.query('category');
    const sellerId = c.req.query('sellerId');
    
    const products = await kv.getByPrefix('product:');
    let filteredProducts = products;

    if (category) {
      filteredProducts = filteredProducts.filter((p: any) => p.category === category);
    }
    if (sellerId) {
      filteredProducts = filteredProducts.filter((p: any) => p.sellerId === sellerId);
    }

    return c.json({ products: filteredProducts });
  } catch (error) {
    console.log(`Error fetching products: ${error}`);
    return c.json({ error: "Failed to fetch products" }, 500);
  }
});

// Get product by ID
app.get("/make-server-bffba348/products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const product = await kv.get(`product:${id}`);
    
    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    return c.json({ product });
  } catch (error) {
    console.log(`Error fetching product: ${error}`);
    return c.json({ error: "Failed to fetch product" }, 500);
  }
});

// Create product (Seller only)
app.post("/make-server-bffba348/products", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'seller' && userData?.role !== 'admin') {
      return c.json({ error: "Only sellers can create products" }, 403);
    }

    const productData = await c.req.json();
    const productId = crypto.randomUUID();
    
    const product = {
      id: productId,
      ...productData,
      sellerId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`product:${productId}`, product);
    return c.json({ product });
  } catch (error) {
    console.log(`Error creating product: ${error}`);
    return c.json({ error: "Failed to create product" }, 500);
  }
});

// Update product (Seller only - own products)
app.put("/make-server-bffba348/products/:id", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const productId = c.req.param('id');
    const existingProduct = await kv.get(`product:${productId}`);
    
    if (!existingProduct) {
      return c.json({ error: "Product not found" }, 404);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (existingProduct.sellerId !== user.id && userData?.role !== 'admin') {
      return c.json({ error: "You can only update your own products" }, 403);
    }

    const updates = await c.req.json();
    const updatedProduct = {
      ...existingProduct,
      ...updates,
      id: productId,
      sellerId: existingProduct.sellerId,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`product:${productId}`, updatedProduct);
    return c.json({ product: updatedProduct });
  } catch (error) {
    console.log(`Error updating product: ${error}`);
    return c.json({ error: "Failed to update product" }, 500);
  }
});

// Delete product (Seller only - own products)
app.delete("/make-server-bffba348/products/:id", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const productId = c.req.param('id');
    const existingProduct = await kv.get(`product:${productId}`);
    
    if (!existingProduct) {
      return c.json({ error: "Product not found" }, 404);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (existingProduct.sellerId !== user.id && userData?.role !== 'admin') {
      return c.json({ error: "You can only delete your own products" }, 403);
    }

    await kv.del(`product:${productId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting product: ${error}`);
    return c.json({ error: "Failed to delete product" }, 500);
  }
});

// ==================== CART ROUTES ====================

// Get user's cart
app.get("/make-server-bffba348/cart", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    return c.json({ cart });
  } catch (error) {
    console.log(`Error fetching cart: ${error}`);
    return c.json({ error: "Failed to fetch cart" }, 500);
  }
});

// Add item to cart
app.post("/make-server-bffba348/cart/items", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { productId, quantity = 1 } = await c.req.json();
    const product = await kv.get(`product:${productId}`);
    
    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    const existingItemIndex = cart.items.findIndex((item: any) => item.productId === productId);

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, product });
    }

    cart.updatedAt = new Date().toISOString();
    await kv.set(`cart:${user.id}`, cart);
    
    return c.json({ cart });
  } catch (error) {
    console.log(`Error adding to cart: ${error}`);
    return c.json({ error: "Failed to add to cart" }, 500);
  }
});

// Update cart item quantity
app.put("/make-server-bffba348/cart/items/:productId", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const productId = c.req.param('productId');
    const { quantity } = await c.req.json();

    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    const itemIndex = cart.items.findIndex((item: any) => item.productId === productId);

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }
      cart.updatedAt = new Date().toISOString();
      await kv.set(`cart:${user.id}`, cart);
    }

    return c.json({ cart });
  } catch (error) {
    console.log(`Error updating cart: ${error}`);
    return c.json({ error: "Failed to update cart" }, 500);
  }
});

// Clear cart
app.delete("/make-server-bffba348/cart", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await kv.del(`cart:${user.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error clearing cart: ${error}`);
    return c.json({ error: "Failed to clear cart" }, 500);
  }
});

// ==================== ORDER ROUTES ====================

// Create order from cart
app.post("/make-server-bffba348/orders", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const cart = await kv.get(`cart:${user.id}`);
    if (!cart || cart.items.length === 0) {
      return c.json({ error: "Cart is empty" }, 400);
    }

    const orderId = crypto.randomUUID();
    const order = {
      id: orderId,
      userId: user.id,
      items: cart.items,
      status: 'pending',
      total: cart.items.reduce((sum: number, item: any) => 
        sum + (item.product.price * item.quantity), 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`order:${orderId}`, order);
    await kv.del(`cart:${user.id}`);

    // Add to user's order list
    const userOrders = await kv.get(`userOrders:${user.id}`) || [];
    userOrders.push(orderId);
    await kv.set(`userOrders:${user.id}`, userOrders);

    return c.json({ order });
  } catch (error) {
    console.log(`Error creating order: ${error}`);
    return c.json({ error: "Failed to create order" }, 500);
  }
});

// Get user's orders
app.get("/make-server-bffba348/orders", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const orderIds = await kv.get(`userOrders:${user.id}`) || [];
    const orders = await kv.mget(orderIds.map((id: string) => `order:${id}`));

    return c.json({ orders });
  } catch (error) {
    console.log(`Error fetching orders: ${error}`);
    return c.json({ error: "Failed to fetch orders" }, 500);
  }
});

// Get order by ID
app.get("/make-server-bffba348/orders/:id", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const orderId = c.req.param('id');
    const order = await kv.get(`order:${orderId}`);
    
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (order.userId !== user.id && userData?.role !== 'admin') {
      return c.json({ error: "Unauthorized to view this order" }, 403);
    }

    return c.json({ order });
  } catch (error) {
    console.log(`Error fetching order: ${error}`);
    return c.json({ error: "Failed to fetch order" }, 500);
  }
});

// Update order status (Admin only)
app.put("/make-server-bffba348/orders/:id/status", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') {
      return c.json({ error: "Only admins can update order status" }, 403);
    }

    const orderId = c.req.param('id');
    const { status } = await c.req.json();
    const order = await kv.get(`order:${orderId}`);
    
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    await kv.set(`order:${orderId}`, order);

    return c.json({ order });
  } catch (error) {
    console.log(`Error updating order status: ${error}`);
    return c.json({ error: "Failed to update order status" }, 500);
  }
});

// ==================== USER ROUTES ====================

// Get/Update user profile
app.get("/make-server-bffba348/user/profile", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let userData = await kv.get(`user:${user.id}`);
    
    // If user data doesn't exist in KV, create it from auth metadata
    if (!userData) {
      userData = {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'customer',
        name: user.user_metadata?.name
      };
      // Persist to KV store
      await kv.set(`user:${user.id}`, userData);
    }

    return c.json({ user: userData });
  } catch (error) {
    console.log(`Error fetching profile: ${error}`);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

app.put("/make-server-bffba348/user/profile", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const updates = await c.req.json();
    const userData = await kv.get(`user:${user.id}`) || { id: user.id, email: user.email };
    
    const updatedUser = { ...userData, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`user:${user.id}`, updatedUser);

    return c.json({ user: updatedUser });
  } catch (error) {
    console.log(`Error updating profile: ${error}`);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// Get all users (Admin only)
app.get("/make-server-bffba348/admin/users", async (c) => {
  try {
    const { user, error } = await getAuthenticatedUser(c);
    
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') {
      return c.json({ error: "Admin access required" }, 403);
    }

    const users = await kv.getByPrefix('user:');
    return c.json({ users });
  } catch (error) {
    console.log(`Error fetching users: ${error}`);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// ==================== CHAT ROUTES ====================

// Save chat message
app.post("/make-server-bffba348/chat/messages", async (c) => {
  try {
    const { sessionId, message, sender } = await c.req.json();
    
    const chatHistory = await kv.get(`chat:${sessionId}`) || { messages: [] };
    chatHistory.messages.push({
      id: crypto.randomUUID(),
      message,
      sender,
      timestamp: new Date().toISOString()
    });

    await kv.set(`chat:${sessionId}`, chatHistory);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error saving chat message: ${error}`);
    return c.json({ error: "Failed to save message" }, 500);
  }
});

// Get chat history
app.get("/make-server-bffba348/chat/messages/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const chatHistory = await kv.get(`chat:${sessionId}`) || { messages: [] };
    return c.json({ messages: chatHistory.messages });
  } catch (error) {
    console.log(`Error fetching chat history: ${error}`);
    return c.json({ error: "Failed to fetch chat history" }, 500);
  }
});

// AI Chat endpoint - uses OpenAI API
app.post("/make-server-bffba348/chat/ai", async (c) => {
  try {
    const { message, conversationHistory = [], products = [] } = await c.req.json();
    
    if (!message) {
      return c.json({ error: "Message is required" }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('OpenAI API key not configured');
      return c.json({ error: "AI service not configured" }, 500);
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
      console.log(`OpenAI API error: ${response.status} - ${errorData}`);
      return c.json({ 
        error: "Failed to get AI response",
        details: errorData 
      }, response.status);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return c.json({ 
      response: aiResponse,
      usage: data.usage
    });
  } catch (error) {
    console.log(`Error in AI chat endpoint: ${error}`);
    return c.json({ error: "Failed to process AI request" }, 500);
  }
});

// ==================== SEED DATA ====================

// Initialize sample products (for demo purposes)
app.post("/make-server-bffba348/seed", async (c) => {
  try {
    const sampleProducts = [
      {
        id: crypto.randomUUID(),
        name: "MacBook Pro 16\"",
        description: "Powerful laptop with M3 Pro chip, 32GB RAM, perfect for professionals",
        price: 2499,
        category: "Electronics",
        stock: 15,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "iPhone 15 Pro",
        description: "Latest smartphone with titanium design and advanced camera system",
        price: 999,
        category: "Electronics",
        stock: 50,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Sony WH-1000XM5",
        description: "Premium noise-canceling headphones with exceptional sound quality",
        price: 399,
        category: "Electronics",
        stock: 30,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Nike Air Max 270",
        description: "Comfortable running shoes with great cushioning and style",
        price: 150,
        category: "Fashion",
        stock: 100,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Levi's 501 Jeans",
        description: "Classic straight-fit jeans that never go out of style",
        price: 89,
        category: "Fashion",
        stock: 75,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "IKEA KALLAX Shelf",
        description: "Versatile storage unit, perfect for any room",
        price: 79,
        category: "Home",
        stock: 40,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Dyson V15 Vacuum",
        description: "Cordless vacuum with laser detection and powerful suction",
        price: 649,
        category: "Home",
        stock: 20,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Peloton Bike",
        description: "Interactive fitness bike with live and on-demand classes",
        price: 1445,
        category: "Sports",
        stock: 10,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Atomic Habits",
        description: "Best-selling book on building good habits and breaking bad ones",
        price: 16,
        category: "Books",
        stock: 200,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: "Canon EOS R6",
        description: "Professional mirrorless camera with 20MP sensor",
        price: 2499,
        category: "Electronics",
        stock: 12,
        sellerId: "demo-seller",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const product of sampleProducts) {
      await kv.set(`product:${product.id}`, product);
    }

    return c.json({ success: true, count: sampleProducts.length });
  } catch (error) {
    console.log(`Error seeding data: ${error}`);
    return c.json({ error: "Failed to seed data" }, 500);
  }
});

// Create dummy test accounts
app.post("/make-server-bffba348/seed/accounts", async (c) => {
  try {
    const testAccounts = [
      {
        email: "customer@xerow.ai",
        password: "customer123",
        name: "Test Customer",
        role: "customer"
      },
      {
        email: "seller@xerow.ai",
        password: "seller123",
        name: "Test Seller",
        role: "seller"
      },
      {
        email: "admin@xerow.ai",
        password: "admin123",
        name: "Test Admin",
        role: "admin"
      }
    ];

    const createdAccounts = [];
    const errors = [];

    for (const account of testAccounts) {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users?.some(u => u.email === account.email);

        if (userExists) {
          console.log(`User ${account.email} already exists, skipping...`);
          createdAccounts.push({ ...account, status: 'already_exists', password: account.password });
          continue;
        }

        // Create user in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          user_metadata: { name: account.name, role: account.role },
          email_confirm: true
        });

        if (error) {
          console.log(`Error creating ${account.email}: ${error.message}`);
          errors.push({ email: account.email, error: error.message });
          continue;
        }

        // Create user profile in KV store
        if (data.user) {
          const userData = {
            id: data.user.id,
            email: data.user.email,
            name: account.name,
            role: account.role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await kv.set(`user:${data.user.id}`, userData);

          createdAccounts.push({
            email: account.email,
            password: account.password,
            role: account.role,
            name: account.name,
            status: 'created'
          });

          console.log(`Created test account: ${account.email} with role ${account.role}`);
        }
      } catch (err) {
        console.log(`Exception creating ${account.email}: ${err}`);
        errors.push({ email: account.email, error: String(err) });
      }
    }

    return c.json({ 
      success: true, 
      accounts: createdAccounts,
      errors: errors.length > 0 ? errors : undefined,
      message: "Test accounts created successfully"
    });
  } catch (error) {
    console.log(`Error seeding accounts: ${error}`);
    return c.json({ error: "Failed to seed accounts" }, 500);
  }
});

Deno.serve(app.fetch);