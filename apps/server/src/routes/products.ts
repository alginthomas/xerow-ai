/**
 * Product Routes
 * CRUD operations for products
 */

import express from 'express';
import { query } from '../database/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  stock: z.number().int().nonnegative(),
  image: z.string().url().optional(),
  images: z.array(z.string()).optional()
});

/**
 * GET /api/products
 * Get all products (with optional filtering)
 */
router.get('/', async (req, res) => {
  try {
    const { category, sellerId } = req.query;
    
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (category) {
      sql += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (sellerId) {
      sql += ` AND seller_id = $${paramCount}`;
      params.push(sellerId);
      paramCount++;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 * Get product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * POST /api/products
 * Create a new product (Seller/Admin only)
 */
router.post('/', authenticate, requireRole('seller', 'admin'), async (req: AuthRequest, res) => {
  try {
    const productData = productSchema.parse(req.body);

    const result = await query(
      `INSERT INTO products (name, description, price, category, stock, seller_id, image, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        productData.name,
        productData.description || null,
        productData.price,
        productData.category,
        productData.stock,
        req.userId,
        productData.image || null,
        productData.images ? JSON.stringify(productData.images) : null
      ]
    );

    res.status(201).json({ product: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/products/:id
 * Update product (Owner/Admin only)
 */
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check if product exists
    const productResult = await query(
      'SELECT seller_id FROM products WHERE id = $1',
      [req.params.id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Check permissions
    if (product.seller_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only update your own products' });
    }

    const productData = productSchema.partial().parse(req.body);

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (productData.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(productData.name);
    }
    if (productData.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(productData.description);
    }
    if (productData.price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      params.push(productData.price);
    }
    if (productData.category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      params.push(productData.category);
    }
    if (productData.stock !== undefined) {
      updates.push(`stock = $${paramCount++}`);
      params.push(productData.stock);
    }
    if (productData.image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      params.push(productData.image);
    }
    if (productData.images !== undefined) {
      updates.push(`images = $${paramCount++}`);
      params.push(JSON.stringify(productData.images));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE products SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      params
    );

    res.json({ product: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete product (Owner/Admin only)
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check if product exists
    const productResult = await query(
      'SELECT seller_id FROM products WHERE id = $1',
      [req.params.id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Check permissions
    if (product.seller_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own products' });
    }

    await query('DELETE FROM products WHERE id = $1', [req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export { router as productRoutes };
