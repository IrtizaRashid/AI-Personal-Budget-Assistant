// Application entry point.
//
// Wiring order matters:
//   1. Load env (config/env.js imports dotenv before anything reads process.env)
//   2. Global middleware (CORS, JSON parsing)
//   3. Routes (mounted under /api)
//   4. Error / 404 handlers (registered last)
import express from 'express';
import cors from 'cors';

import { config } from './config/env.js';
import { testConnection } from './database/db.js';
import healthRoutes from './routes/healthRoutes.js';
import setupRoutes from './routes/setupRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import statisticsRoutes from './routes/statisticsRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// ---- Global middleware ----
app.use(cors());            // Allow the React frontend to call this API
app.use(express.json());    // Parse incoming JSON request bodies

// ---- Routes ----
app.use('/api', healthRoutes);              // GET  /api/health
app.use('/api', setupRoutes);               // POST /api/setup-budget
app.use('/api/users', userRoutes);          // POST /api/users
app.use('/api/categories', categoryRoutes); // POST /api/categories, GET /api/categories/:userId
app.use('/api/expenses', expenseRoutes);    // POST /api/expenses,   GET /api/expenses/:userId
app.use('/api/dashboard', dashboardRoutes); // GET  /api/dashboard/:userId
app.use('/api/statistics', statisticsRoutes); // GET /api/statistics/:userId
app.use('/api/ai/recommendations', recommendationRoutes); // GET /api/ai/recommendations/:userId
app.use('/api', chatRoutes);                // POST /api/chat

// ---- Fallbacks ----
app.use(notFound);          // Unknown route -> 404
app.use(errorHandler);      // Any thrown error -> JSON error response

// ---- Start server ----
app.listen(config.port, async () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  await testConnection();   // Non-fatal MySQL connectivity check
});
