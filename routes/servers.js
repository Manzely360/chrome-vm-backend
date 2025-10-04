const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

// Predefined VM providers
const PREDEFINED_SERVERS = [
  {
    id: 'default-cloudflare-server',
    name: 'Cloudflare Workers (Mock VMs)',
    host: 'chrome-vm-workers.mgmt-5e1.workers.dev',
    port: 443,
    novnc_port: 6080,
    max_vms: 10,
    location: 'Global Edge',
    status: 'active',
    health: 'healthy',
    created_at: new Date().toISOString(),
    last_check: new Date().toISOString(),
    capabilities: ['mock-vms', 'fast-deployment', 'serverless', 'edge-computing']
  },
  {
    id: 'default-google-cloud-server',
    name: 'Google Cloud Platform (Real VMs)',
    host: 'compute.googleapis.com',
    port: 443,
    novnc_port: 6080,
    max_vms: 5,
    location: 'Global',
    status: 'active',
    health: 'healthy',
    created_at: new Date().toISOString(),
    last_check: new Date().toISOString(),
    capabilities: ['real-vms', 'docker', 'chrome-automation', 'persistent-storage']
  }
];

// Get all servers
router.get('/', async (req, res) => {
  try {
    logger.info('Fetching predefined VM servers');
    res.json(PREDEFINED_SERVERS);
  } catch (error) {
    logger.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get server by ID
router.get('/:id', async (req, res) => {
  try {
    const server = PREDEFINED_SERVERS.find(s => s.id === req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json(server);
  } catch (error) {
    logger.error(`Error fetching server ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Create server (for compatibility - returns predefined servers)
router.post('/', async (req, res) => {
  try {
    logger.info('Server creation requested - returning predefined servers');
    // For now, just return the predefined servers
    // In the future, this could add custom servers
    res.status(201).json({
      message: 'Server management is handled by predefined providers',
      available_servers: PREDEFINED_SERVERS
    });
  } catch (error) {
    logger.error('Error in server creation:', error);
    res.status(500).json({ error: 'Failed to process server request' });
  }
});

// Delete server (for compatibility)
router.delete('/:id', async (req, res) => {
  try {
    logger.info(`Server deletion requested for ${req.params.id}`);
    res.status(200).json({
      message: 'Predefined servers cannot be deleted',
      available_servers: PREDEFINED_SERVERS
    });
  } catch (error) {
    logger.error(`Error in server deletion for ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to process server deletion' });
  }
});

module.exports = router;