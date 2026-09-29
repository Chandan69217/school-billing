import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: 3000,
  databaseUrl: process.env.DATABASE_URL || 'mysql://school_user:SchoolPass123!@localhost:3306/school_management',
  jwtSecret: process.env.JWT_SECRET || 'edumanage_jwt_secret_production_key_2026_xyz',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'edumanage_refresh_secret_production_key_2026_abc',
  jwtExpiresIn: '24h',
  jwtRefreshExpiresIn: '7d',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_school_edu_2026',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_edu_2026',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    user: process.env.SMTP_USER || 'smtp_user_example',
    pass: process.env.SMTP_PASSWORD || 'smtp_password_example',
    fromEmail: process.env.SCHOOL_EMAIL || 'finance@pbps.edu.in',
  },
  storagePath: path.resolve(process.env.STORAGE_PATH || './uploads'),
};
