const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initializeDatabase } = require('./database/init');
const logger = require('./utils/logger');

// Import routes
const vmsRouter = require('./routes/vms');
const serversRouter = require('./routes/servers');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://chrome-vm-frontend.vercel.app',
    'https://chrome-vm-frontend-1twfmig1s-manzely360-apps.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// Routes
app.use('/api/vms', vmsRouter);
app.use('/api/servers', serversRouter);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mock VNC endpoint
app.get('/vnc/:vmId', (req, res) => {
  const { vmId } = req.params;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chrome VM ${vmId}</title>
      <style>
        body { margin: 0; padding: 0; background: #000; }
        #noVNC_canvas { width: 100vw; height: 100vh; }
        .vm-info { 
          position: absolute; 
          top: 20px; 
          left: 20px; 
          color: white; 
          background: rgba(0,0,0,0.7); 
          padding: 10px; 
          border-radius: 5px;
          z-index: 1000;
        }
      </style>
    </head>
    <body>
      <div class="vm-info">
        <h2>Chrome VM ${vmId}</h2>
        <p>Status: Ready</p>
        <p>Chrome Version: 120.0.0.0</p>
        <p>Node Version: 18.19.0</p>
      </div>
      <div id="noVNC_canvas">
        <h1 style="color: white; text-align: center; margin-top: 50vh; transform: translateY(-50%);">
          Chrome VM ${vmId} - NoVNC Viewer
        </h1>
        <p style="color: #ccc; text-align: center;">
          VM is ready for connection. In a real implementation, this would show the actual NoVNC interface.
        </p>
      </div>
    </body>
    </html>
  `);
});

// Mock agent endpoint
app.get('/agent/:vmId', (req, res) => {
  const { vmId } = req.params;
  res.json({
    vm_id: vmId,
    status: 'ready',
    message: 'Chrome VM Agent is running',
    chrome_version: '120.0.0.0',
    node_version: '18.19.0',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Chrome VM Dashboard Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      vms: '/api/vms',
      servers: '/api/servers',
      vnc: '/vnc/:vmId',
      agent: '/agent/:vmId'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Chrome VM Backend running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
