/**
 * Order Routes
 * Order management
 */

import express from 'express';
import { query, getClient } from '../database/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// All order routes require authentication
router.use(authenticate);

/**
 * POST /api/orders
 * Create order from cart
 */
router.post('/', async (req: AuthRequest, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // Get cart with items
    const cartResult = await client.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.userId]
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const cartId = cartResult.rows[0].id;

    // Get cart items
    const itemsResult = await client.query(
      `SELECT ci.product_id, ci.quantity, ci.price
       FROM cart_items ci
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = itemsResult.rows;
    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total)
       VALUES ($1, 'pending', $2)
       RETURNING *`,
      [req.userId, total]
    );

    const order = orderResult.rows[0];

    // Create order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    await client.query('COMMIT');

    res.status(201).json({ order });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/orders
 * Get user's orders
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const ordersResult = await query(
      `SELECT o.*, 
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.userId]
    );

    // Get product details for each order
    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const itemsResult = await query(
          `SELECT oi.*, p.name, p.description, p.image
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [order.id]
        );

        return {
          ...order,
          items: itemsResult.rows.map(item => ({
            product: {
              id: item.product_id,
              name: item.name,
              description: item.description,
              image: item.image,
              price: item.price
            },
            quantity: item.quantity,
            price: item.price
          }))
        };
      })
    );

    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/:id
 * Get order by ID
 */
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check permissions
    if (order.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view this order' });
    }

    // Get order items
    const itemsResult = await query(
      `SELECT oi.*, p.name, p.description, p.image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    res.json({
      order: {
        ...order,
        items: itemsResult.rows.map(item => ({
          product: {
            id: item.product_id,
            name: item.name,
            description: item.description,
            image: item.image,
            price: item.price
          },
          quantity: item.quantity,
          price: item.price
        }))
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * PUT /api/orders/:id/status
 * Update order status (Admin only)
 */
router.put('/:id/status', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export { router as orderRoutes };
