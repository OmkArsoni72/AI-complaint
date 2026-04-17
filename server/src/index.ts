import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import connectDB from './config/db';
import { initSocket } from './socket';
import { startEscalationMonitor } from './services/escalationMonitor';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initSocket(httpServer);

// Middleware
const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean) as string[]
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── CITIZEN / USER ROUTES ───────────────────────────────────────────
import citizenRoutes from './routes/citizen';
app.use('/api', citizenRoutes); // Maintains /api/auth, /api/complaints etc.

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Connect & Start
connectDB().then(() => {
  startEscalationMonitor();
  httpServer.listen(PORT, () => {
    console.log(`🚀 CITIZEN-ONLY Server running on http://localhost:${PORT}`);
    console.log(`📋 Routes: auth, complaints, users, notifications`);
  });
});
