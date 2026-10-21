import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import config from './config/index.js';
import connectDB from './config/db.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import contractRoutes from './routes/contracts.js';
import photoRoutes from './routes/photos.js';
import disputeRoutes from './routes/disputes.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import errorHandler from './middleware/error.js';

// Connect to Database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// The server sits behind Render's proxy: trust the first hop so rate limiting
// and req.ip use the real client address.
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...config.clientUrl
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
];
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (no Origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true
  })
);

// Rate limiting.
// - General limit for the whole API: 300 requests / 15 min (production).
// - Stricter limit only for login + register: 20 attempts / 15 min (production).
// - Outside production both limits are effectively disabled for easy testing.
const isProduction = config.nodeEnv === 'production';
const rateLimitMessage = {
  success: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 300 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body Parsing & Sanitization
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

// NOTE: uploaded photos are deliberately NOT served as public static files.
// They are only available through the authenticated GET /api/photos/:id/file
// route, which checks that the caller is the contract's farmer, buyer or admin.

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Root route for health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`
  });
});

// Central Error Handler
app.use(errorHandler);

// Listen on configured port
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });
}

export default app;
