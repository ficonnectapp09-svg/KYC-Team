import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { configureCloudinary } from './config/cloudinary';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/authRoutes';
import staffRoutes from './routes/staffRoutes';
import kycRoutes from './routes/kycRoutes';
import paymentRoutes from './routes/paymentRoutes';
import approvalRoutes from './routes/approvalRoutes';
import queryRoutes from './routes/queryRoutes';
import salaryRoutes from './routes/salaryRoutes';
import taskRoutes from './routes/taskRoutes';
import reportRoutes from './routes/reportRoutes';
import notificationRoutes from './routes/notificationRoutes';
import auditRoutes from './routes/auditRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import settingsRoutes from './routes/settingsRoutes';
import uploadRoutes from './routes/uploadRoutes';

dotenv.config();
configureCloudinary();

const app = express();
const PORT = process.env.PORT || 8007;

// Security & Parsing
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        frameSrc: ["'self'", 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'https://res.cloudinary.com', 'https://api.cloudinary.com']
      }
    }
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow development localhost origins and production frontends
      callback(null, true);
    },
    credentials: true
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'CONNECT APP CENTRALIZED BACKOFFICE',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Connect to DB and Start Listening
connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[Backoffice Server]: Running successfully on http://localhost:${PORT}`);
    console.log(`[Backoffice Server]: Port: ${PORT} | Environment: ${process.env.NODE_ENV}`);
  });
});

export default app;

