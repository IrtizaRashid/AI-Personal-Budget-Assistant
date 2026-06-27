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
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// ---- Global middleware ----
app.use(cors());            // Allow the React frontend to call this API
app.use(express.json());    // Parse incoming JSON request bodies

// ---- Routes ----
app.use('/api', healthRoutes);   // -> GET /api/health

// ---- Fallbacks ----
app.use(notFound);          // Unknown route -> 404
app.use(errorHandler);      // Any thrown error -> JSON error response

// ---- Start server ----
app.listen(config.port, async () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  await testConnection();   // Non-fatal MySQL connectivity check
});
