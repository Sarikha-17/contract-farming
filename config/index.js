import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/contract_farming',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_change_this',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Comma-separated list of allowed browser origins (e.g. your Vercel URL)
  clientUrl: process.env.CLIENT_URL || '',
  // When true, new registrations are marked verified automatically (demo mode)
  autoVerifyUsers: String(process.env.AUTO_VERIFY_USERS || 'false').toLowerCase() === 'true'
};

export default config;
