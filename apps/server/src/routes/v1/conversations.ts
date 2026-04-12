/**
 * Conversation API Routes - v1
 * Persistent chat storage (replaces localStorage)
 */

import express from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { query } from '../../database/connection.js';

const router = express.Router();

/**
 * GET /api/v1/conversations
 * List user's conversations for sidebar
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT c.*,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at ASC LIMIT 1) as first_message,
        (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [req.userId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/conversations
 * Create a new conversation
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title, metadata } = req.body;
    const result = await query(
      `INSERT INTO conversations (user_id, title, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.userId, title || null, JSON.stringify(metadata || {})]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/conversations/:id/messages
 * Load messages for a conversation
 */
router.get('/:id/messages', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/conversations/:id/messages
 * Save a message to a conversation
 */
router.post('/:id/messages', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { role, content, tool_calls, tool_results } = req.body;
    const result = await query(
      `INSERT INTO messages (conversation_id, role, content, tool_calls, tool_results)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.params.id,
        role,
        content || null,
        tool_calls ? JSON.stringify(tool_calls) : null,
        tool_results ? JSON.stringify(tool_results) : null,
      ]
    );

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/conversations/:id
 * Delete a conversation and its messages
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/conversations/:id
 * Update conversation title
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title } = req.body;
    const result = await query(
      `UPDATE conversations SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [title, req.params.id, req.userId]
    );
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export { router as conversationRoutes };
