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

// Sockets will be initialized only in non-vercel environments
// initSocket(httpServer); 

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins to prevent 'Failed to fetch' CORS opaque errors during development
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── CITIZEN / USER ROUTES ───────────────────────────────────────────
import citizenRoutes from './routes/citizen';
app.use('/api', citizenRoutes); // Maintains /api/auth, /api/complaints etc.

// ── ADMIN ROUTES ─────────────────────────────────────────────────────
import adminRoutes from './routes/admin';
app.use('/api/admin', adminRoutes);

// ── OFFICER / SUB-DEPARTMENT ROUTES ──────────────────────────────────
import officerRoutes from './routes/officer-complaints';
app.use('/api/officer', officerRoutes);

// ── DEPARTMENT ROUTES ─────────────────────────────────────────────────
import departmentRoutes from './routes/departments';
app.use('/api/departments', departmentRoutes);

// ── ANALYTICS ROUTES ─────────────────────────────────────────────────
import analyticsRoutes from './routes/analytics';
app.use('/api/analytics', analyticsRoutes);

// ── AUDIT ROUTES ──────────────────────────────────────────────────────
import auditRoutes from './routes/audit';
app.use('/api/audit', auditRoutes);

// ── SUPERADMIN ROUTES ─────────────────────────────────────────────────
import superadminRoutes from './routes/superadmin';
app.use('/api/superadmin', superadminRoutes);

// ── SLA ROUTES ────────────────────────────────────────────────────────
import slaRoutes from './routes/sla';
app.use('/api/sla', slaRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Connect & Start
if (!process.env.VERCEL) {
  connectDB().then(() => {
    // Only start socket and monitor on traditional servers
    initSocket(httpServer);
    startEscalationMonitor();

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Run this to free it:  npx kill-port ${PORT}`);
        console.error(`   Or:  netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F\n`);
        process.exit(1);
      } else {
        throw err;
      }
    });

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Routes: auth, complaints, users, notifications, admin, officer, departments, analytics, audit, superadmin, sla`);
    });
  });
} else {
  // Vercel Serverless Execution
  connectDB().catch(console.error);
}

export default app;
