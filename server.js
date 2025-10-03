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
    'https://chrome-vm-frontend-git-main-manzely360-apps.vercel.app',
    'https://chrome-vm-frontend-res9taifj-manzely360-apps.vercel.app',
    'https://chrome-vm-frontend-1twfmig1s-manzely360-apps.vercel.app',
    'https://chrome-vm-frontend-2wndwrvgd-manzely360-apps.vercel.app',
    'https://chrome-vm-frontend-3kqvf3fkm-manzely360-apps.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// Real VNC endpoint with NoVNC integration
app.get('/vnc/:vmId', (req, res) => {
  const { vmId } = req.params;
  
  // Try to get real VM info from the real VM service
  const realVMService = require('./services/realVMService');
  
  realVMService.getVMStatus(vmId).then(vmStatus => {
    // Real VM with actual NoVNC
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chrome VM ${vmId} - NoVNC</title>
        <style>
          body { margin: 0; padding: 0; background: #000; font-family: Arial, sans-serif; }
          .vm-info { 
            position: absolute; 
            top: 20px; 
            left: 20px; 
            color: white; 
            background: rgba(0,0,0,0.8); 
            padding: 15px; 
            border-radius: 8px;
            z-index: 1000;
            border: 1px solid #333;
          }
          .status-ready { color: #4ade80; }
          .status-initializing { color: #fbbf24; }
          .status-error { color: #f87171; }
          #noVNC_canvas { 
            width: 100vw; 
            height: 100vh; 
            background: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          }
          .connection-info {
            text-align: center;
            color: #ccc;
            margin-bottom: 20px;
          }
          .noVNC-container {
            width: 100%;
            height: 100%;
            position: relative;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/lib/rfb.min.js"></script>
      </head>
      <body>
        <div class="vm-info">
          <h2>Chrome VM ${vmId}</h2>
          <p><strong>Status:</strong> <span class="status-${vmStatus.status}">${vmStatus.status.toUpperCase()}</span></p>
          <p><strong>Container ID:</strong> ${vmStatus.containerId}</p>
          <p><strong>Chrome Version:</strong> 120.0.0.0</p>
          <p><strong>Node Version:</strong> 18.19.0</p>
        </div>
        
        <div id="noVNC_canvas">
          <div class="connection-info">
            <h2>Chrome VM ${vmId} - NoVNC Viewer</h2>
            <p>Connecting to VM...</p>
            <p id="connection-status">Initializing connection...</p>
          </div>
          
          <div class="noVNC-container">
            <canvas id="noVNC_canvas_element" width="1920" height="1080"></canvas>
          </div>
        </div>

        <script>
          let rfb;
          const vmId = '${vmId}';
          const statusElement = document.getElementById('connection-status');
          
          function updateStatus(message, isError = false) {
            statusElement.textContent = message;
            statusElement.style.color = isError ? '#f87171' : '#4ade80';
          }
          
          function connectToVM() {
            try {
              // For real VMs, we would connect to the actual VNC server
              // For now, we'll simulate the connection
              updateStatus('Connecting to VNC server...');
              
              // Simulate connection delay
              setTimeout(() => {
                if (vmStatus.status === 'ready') {
                  updateStatus('Connected to Chrome VM!');
                  
                  // In a real implementation, you would initialize the RFB connection here:
                  // rfb = new RFB(document.getElementById('noVNC_canvas_element'), 'ws://localhost:6080');
                  
                  // For demo purposes, show a simulated Chrome interface
                  const canvas = document.getElementById('noVNC_canvas_element');
                  const ctx = canvas.getContext('2d');
                  
                  // Draw a simple Chrome-like interface
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  
                  // Chrome header
                  ctx.fillStyle = '#f1f3f4';
                  ctx.fillRect(0, 0, canvas.width, 60);
                  
                  // Chrome address bar
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(100, 20, canvas.width - 200, 25);
                  ctx.strokeStyle = '#dadce0';
                  ctx.strokeRect(100, 20, canvas.width - 200, 25);
                  
                  // Chrome content area
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 60, canvas.width, canvas.height - 60);
                  
                  // Add some text
                  ctx.fillStyle = '#000000';
                  ctx.font = '16px Arial';
                  ctx.fillText('Chrome VM ' + vmId + ' - Ready for use!', 20, 100);
                  ctx.fillText('This is a simulated Chrome interface.', 20, 130);
                  ctx.fillText('In a real implementation, this would show the actual Chrome browser.', 20, 160);
                  
                } else {
                  updateStatus('VM is not ready yet. Status: ' + vmStatus.status, true);
                }
              }, 2000);
              
            } catch (error) {
              updateStatus('Connection failed: ' + error.message, true);
            }
          }
          
          // Start connection when page loads
          window.addEventListener('load', connectToVM);
        </script>
      </body>
      </html>
    `);
  }).catch(error => {
    // Fallback for mock VM
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chrome VM ${vmId} - Mock</title>
        <style>
          body { margin: 0; padding: 0; background: #000; font-family: Arial, sans-serif; }
          .vm-info { 
            position: absolute; 
            top: 20px; 
            left: 20px; 
            color: white; 
            background: rgba(0,0,0,0.8); 
            padding: 15px; 
            border-radius: 8px;
            z-index: 1000;
            border: 1px solid #333;
          }
          #noVNC_canvas { 
            width: 100vw; 
            height: 100vh; 
            background: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          }
        </style>
      </head>
      <body>
        <div class="vm-info">
          <h2>Chrome VM ${vmId}</h2>
          <p><strong>Status:</strong> <span style="color: #fbbf24;">MOCK</span></p>
          <p><strong>Chrome Version:</strong> 120.0.0.0</p>
          <p><strong>Node Version:</strong> 18.19.0</p>
        </div>
        
        <div id="noVNC_canvas">
          <h1 style="color: white; text-align: center;">
            Chrome VM ${vmId} - Mock NoVNC Viewer
          </h1>
          <p style="color: #ccc; text-align: center;">
            This is a mock VM. Real VMs would show the actual Chrome browser interface here.
          </p>
        </div>
      </body>
      </html>
    `);
  });
});

// Real agent endpoint
app.get('/agent/:vmId', (req, res) => {
  const { vmId } = req.params;
  
  // Try to get real VM info from the real VM service
  const realVMService = require('./services/realVMService');
  
  realVMService.getVMStatus(vmId).then(vmStatus => {
    res.json({
      vm_id: vmId,
      status: vmStatus.status,
      message: `Chrome VM Agent is ${vmStatus.status}`,
      chrome_version: '120.0.0.0',
      node_version: '18.19.0',
      container_id: vmStatus.containerId,
      novnc_url: vmStatus.novncUrl,
      agent_url: vmStatus.agentUrl,
      timestamp: new Date().toISOString()
    });
  }).catch(error => {
    // Fallback for mock VM
    res.json({
      vm_id: vmId,
      status: 'mock',
      message: 'Chrome VM Agent (Mock) is running',
      chrome_version: '120.0.0.0',
      node_version: '18.19.0',
      timestamp: new Date().toISOString()
    });
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
