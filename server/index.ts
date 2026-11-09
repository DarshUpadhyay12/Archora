import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb } from './db/connection';
import { runMigrations } from './db/migrator';
import { authRouter } from './routes/authRoutes';
import { projectRouter } from './routes/projectRoutes';
import { conversationRouter } from './routes/conversationRoutes';
import { savedOutputRouter } from './routes/savedOutputRoutes';
import { settingsRouter } from './routes/settingsRoutes';
import { aiRouter } from './routes/aiRoutes';
import { fileRouter } from './routes/fileRoutes';
import { exportRouter } from './routes/exportRoutes';
import { backupRouter } from './routes/backupRoutes';
import { googleDriveRouter } from './routes/googleDriveRoutes';
import { syncRouter } from './routes/syncRoutes';
import { vastuRouter } from './routes/vastuRoutes';
import { generalApiLimiter } from './middleware/rateLimiter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust resolution of frontend dist directory whether in server/ or server/dist/
let distPath = path.resolve(__dirname, '../dist');
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  distPath = path.resolve(__dirname, '../../dist');
}
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  distPath = path.resolve(process.cwd(), 'dist');
}

// Initialize SQLite database and execute any pending schema migrations
try {
  const db = initDb();
  const applied = runMigrations(db);
  if (applied.length > 0) {
    console.log(`[Archora DB] Initialized schema (${applied.length} migrations applied).`);
  } else {
    console.log(`[Archora DB] Database verified and up to date.`);
  }
} catch (e: any) {
  console.error('[Archora DB] Critical initialization failure:', e.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Trust reverse proxy headers (e.g. Render, Koyeb, Cloudflare, Nginx, Vercel)
app.set('trust proxy', 1);

// Security: Disable Express fingerprinting header
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Parse custom allowed origins from environment (comma-separated)
const customAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().toLowerCase())
  : [];

// Cross-Device & Universal Cloud CORS Middleware
app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow same-origin / mobile apps / server requests without Origin header
    if (!origin) {
      return callback(null, true);
    }

    const lower = origin.toLowerCase();

    // 2. Allow local development & desktop launcher loopbacks
    if (
      lower.startsWith('http://localhost:') ||
      lower.startsWith('http://127.0.0.1:') ||
      lower.startsWith('https://localhost:') ||
      lower.startsWith('https://127.0.0.1:')
    ) {
      return callback(null, true);
    }

    // 3. Allow local area network (LAN) private IPs for phone/tablet testing on Wi-Fi
    if (
      lower.startsWith('http://192.168.') ||
      lower.startsWith('http://10.') ||
      lower.startsWith('http://172.16.') ||
      lower.startsWith('http://172.31.')
    ) {
      return callback(null, true);
    }

    // 4. Check explicit cloud origin whitelist
    if (customAllowedOrigins.includes(lower) || customAllowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // 5. Allow standard cloud preview / deployment domains
    if (
      lower.includes('.vercel.app') ||
      lower.includes('.onrender.com') ||
      lower.includes('.koyeb.app') ||
      lower.includes('.trycloudflare.com') ||
      lower.includes('.netlify.app')
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Request logging (sanitized, zero secrets logged)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Mount General Rate Limiting across all public API routes
app.use('/api/', generalApiLimiter);

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/saved-outputs', savedOutputRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/files', fileRouter);
app.use('/api/export', exportRouter);
app.use('/api/backup', backupRouter);
app.use('/api/google', googleDriveRouter);
app.use('/api/sync', syncRouter);
app.use('/api/vastu', vastuRouter);

// Root health check endpoint (never exposes internal file paths or API keys)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Archora Architecture Studio Gateway & SQLite Database',
    timestamp: new Date().toISOString()
  });
});

// API Info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    service: 'Archora Architecture Studio API Gateway',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      projects: '/api/projects',
      ai: '/api/ai',
      conversations: '/api/conversations',
      savedOutputs: '/api/saved-outputs',
      settings: '/api/settings',
      files: '/api/files',
      export: '/api/export',
      backup: '/api/backup'
    }
  });
});

// Serve frontend static assets from dist/ if available
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Single Page Application (SPA) fallback & root handler for Express 5
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    return next();
  }

  // If an unmatched API route is requested, return 404 JSON instead of HTML
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: `API endpoint '${req.path}' not found on Archora backend server.`
    });
  }

  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  // Graceful fallback if dist is not yet built
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Archora Architecture Studio</title>
      <style>
        body { font-family: 'Georgia', serif; background: #F3E5CF; color: #241A14; padding: 40px; text-align: center; }
        .card { background: #FFF7EA; border: 1px solid #C9B49A; border-radius: 20px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        h1 { color: #482A18; font-size: 28px; margin-bottom: 10px; }
        p { color: #5E4E42; font-size: 15px; line-height: 1.6; }
        .badge { display: inline-block; padding: 6px 12px; background: #E6D1B5; border-radius: 999px; font-size: 12px; font-weight: bold; margin-bottom: 15px; color: #482A18; }
        code { background: #E8D4BA; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        a { color: #482A18; font-weight: bold; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">Archora Studio Server Active</span>
        <h1>🏛️ Archora Architecture Backend</h1>
        <p>The backend API server and SQLite database are fully operational on port <code>${PORT}</code>.</p>
        <p>To view the full interactive frontend, visit the active Vite development server or run <code>npm run build</code>.</p>
        <p><a href="/api/health">Check API Health (/api/health)</a> &bull; <a href="/api">API Directory (/api)</a></p>
      </div>
    </body>
    </html>
  `);
});

// Centralized Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]:', err.message);
  res.status(500).json({
    error: 'Internal architectural server error. Please retry.'
  });
});

app.listen(Number(PORT), HOST, () => {
  console.log(`===============================================`);
  console.log(`🏛️  Archora Architecture Backend running on http://${HOST}:${PORT}`);
  console.log(`🌐 Full Studio Web UI: http://${HOST}:${PORT}/`);
  console.log(`📡 Endpoints: /api/auth | /api/projects | /api/conversations | /api/ai`);
  console.log(`💾 SQLite Storage: Local AppData persistent database active`);
  console.log(`===============================================`);
});

export default app;
