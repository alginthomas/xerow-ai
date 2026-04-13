/**
 * Cart Routes
 * Shopping cart operations
 */

import express from 'express';
import { query, getClient } from '../database/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// All cart routes require authentication
router.use(authenticate);

/**
 * GET /api/cart
 * Get user's cart
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    // Get or create cart
    let cartResult = await query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.userId]
    );

    let cartId: string;
    if (cartResult.rows.length === 0) {
      const newCart = await query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
        [req.userId]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Get cart items with product details
    const itemsResult = await query(
      `SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.price,
        p.name,
        p.description,
        p.image,
        p.category
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    const items = itemsResult.rows.map(item => ({
      productId: item.product_id,
      quantity: item.quantity,
      price: item.price,
      product: {
        id: item.product_id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: item.category
      }
    }));

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      cart: {
        id: cartId,
        items,
        total
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

/**
 * POST /api/cart/items
 * Add item to cart
 */
router.post('/items', async (req: AuthRequest, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Get product
    const productResult = await query(
      'SELECT id, price FROM products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get or create cart
    let cartResult = await query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.userId]
    );

    let cartId: string;
    if (cartResult.rows.length === 0) {
      const newCart = await query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
        [req.userId]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Check if item already exists in cart
    const existingItem = await query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, productId]
    );

    if (existingItem.rows.length > 0) {
      // Update quantity
      await query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2',
        [quantity, existingItem.rows[0].id]
      );
    } else {
      // Add new item
      await query(
        'INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [cartId, productId, quantity, product.price]
      );
    }

    // Update cart updated_at
    await query(
      'UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [cartId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

/**
 * PUT /api/cart/items/:productId
 * Update cart item quantity
 */
router.put('/items/:productId', async (req: AuthRequest, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    // Get cart
    const cartResult = await query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const cartId = cartResult.rows[0].id;

    if (quantity <= 0) {
      // Remove item
      await query(
        'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
        [cartId, productId]
      );
    } else {
      // Update quantity
      await query(
        'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3',
        [quantity, cartId, productId]
      );
    }

    // Update cart updated_at
    await query(
      'UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [cartId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

/**
 * DELETE /api/cart
 * Clear cart
 */
router.delete('/', async (req: AuthRequest, res) => {
  try {
    const cartResult = await query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.userId]
    );

    if (cartResult.rows.length > 0) {
      const cartId = cartResult.rows[0].id;
      await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export { router as cartRoutes };
