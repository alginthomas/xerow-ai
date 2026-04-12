/**
 * Xerow.ai Backend Server
 * Express + PostgreSQL + JWT Authentication
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { query } from './database/connection.js';

// v1 API Routes - Xerow AI Industrial Platform
import { assetRoutes } from './routes/v1/assets.js';
import { anomalyRoutes } from './routes/v1/anomalies.js';
import { ticketRoutes } from './routes/v1/tickets.js';
import { conversationRoutes } from './routes/v1/conversations.js';
import { agentRoutes } from './routes/v1/agents.js';
import { shiftRoutes } from './routes/v1/shift.js';
import { errorHandler } from './middleware/error-handler.js';
import { runMigrations } from './database/migrate.js';
import { anomalySimulator } from './services/anomaly-simulator.js';
import { ticketService } from './services/ticket.service.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    database: 'PostgreSQL'
  });
});

// Auth + User routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// v1 API Routes - Xerow AI Industrial Platform
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/anomalies', anomalyRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/shift', shiftRoutes);

// Centralized error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Test database connection on startup
async function startServer() {
  try {
    // Test database connection
    await query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL database');

    // Run pending migrations
    await runMigrations();
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL database:', error);
    console.error('Please check your database configuration in .env file');
    process.exit(1);
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: PostgreSQL`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Start background services
    anomalySimulator.start(5 * 60 * 1000); // Generate anomalies every 5 minutes

    // SLA breach checker - runs every minute
    setInterval(async () => {
      try {
        const breached = await ticketService.checkSlaBreaches();
        if (breached > 0) console.log(`[SLA] Auto-escalated ${breached} breached ticket(s)`);
      } catch (err) {
        console.error('[SLA] Breach check error:', err);
      }
    }, 60 * 1000);
  });
}

startServer();

export default app;
