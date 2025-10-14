import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Import routes
import notificationRoutes from './routes/notification';
import statusRoutes from './routes/status';
import swaggerRoutes from './routes/swagger';

// Import middleware
import { apiKeyAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import notificationDaemon from './services/notificationDaemon';

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  logger.info('Created data directory for notification logs');
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
// TODO: figure out correct number of proxies
// see: https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues
app.set('trust proxy', true);

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // Secure HTTP headers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Serve raw Swagger JSON
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Expose raw OpenAPI JSON via dedicated routes
app.use('/', swaggerRoutes);

// Routes
app.use('/api/notification', apiKeyAuth, notificationRoutes); // Protected route
app.use('/api/status', statusRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop the notification daemon
  notificationDaemon.stop();
  
  logger.info('Shutting down notification service...');
  process.exit(0);
}

// Register signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (process.env.NODE_ENV !== 'test') {
  // Start server
  app.listen(PORT, () => {
    logger.info(`Notification Service is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    
    // Start the notification daemon
    if (process.env.ENABLE_DAEMON !== 'false') {
      notificationDaemon.start();
    } else {
      logger.info('Notification daemon is disabled (ENABLE_DAEMON=false)');
    }
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // Graceful shutdown
  gracefulShutdown('uncaughtException');
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Promise Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;
