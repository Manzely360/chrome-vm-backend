const express = require('express');
const axios = require('axios');
const logger = require('../utils/logger');

const router = express.Router();

// Cloudflare Workers URL for VM management
const CLOUDFLARE_WORKERS_URL = process.env.CLOUDFLARE_WORKERS_URL || 'https://chrome-vm-workers.mgmt-5e1.workers.dev';

// Get all VMs - proxy to Cloudflare Workers
router.get('/', async (req, res) => {
  try {
    logger.info('Fetching VMs from Cloudflare Workers');
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms`);
    res.json(response.data.vms || []);
  } catch (error) {
    logger.error('Error fetching VMs from Cloudflare Workers:', error);
    res.status(500).json({ error: 'Failed to fetch VMs' });
  }
});

// Create VM - proxy to Cloudflare Workers
router.post('/', async (req, res) => {
  try {
    logger.info('Creating VM via Cloudflare Workers:', req.body);
    const response = await axios.post(`${CLOUDFLARE_WORKERS_URL}/vms`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    logger.error('Error creating VM via Cloudflare Workers:', error);
    res.status(500).json({ error: 'Failed to create VM' });
  }
});

// Get VM by ID - proxy to Cloudflare Workers
router.get('/:id', async (req, res) => {
  try {
    logger.info(`Fetching VM ${req.params.id} from Cloudflare Workers`);
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error fetching VM ${req.params.id} from Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to fetch VM' });
  }
});

// Delete VM - proxy to Cloudflare Workers
router.delete('/:id', async (req, res) => {
  try {
    logger.info(`Deleting VM ${req.params.id} via Cloudflare Workers`);
    const response = await axios.delete(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error deleting VM ${req.params.id} via Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to delete VM' });
  }
});

// VM Management - proxy to Cloudflare Workers
router.post('/:id/start', async (req, res) => {
  try {
    logger.info(`Starting VM ${req.params.id} via Cloudflare Workers`);
    const response = await axios.post(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/start`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error starting VM ${req.params.id} via Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to start VM' });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    logger.info(`Stopping VM ${req.params.id} via Cloudflare Workers`);
    const response = await axios.post(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/stop`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error stopping VM ${req.params.id} via Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to stop VM' });
  }
});

router.post('/:id/restart', async (req, res) => {
  try {
    logger.info(`Restarting VM ${req.params.id} via Cloudflare Workers`);
    const response = await axios.post(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/restart`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error restarting VM ${req.params.id} via Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to restart VM' });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    logger.info(`Getting status for VM ${req.params.id} from Cloudflare Workers`);
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/status`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error getting status for VM ${req.params.id} from Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to get VM status' });
  }
});

// Script Execution - proxy to Cloudflare Workers
router.post('/:id/scripts', async (req, res) => {
  try {
    logger.info(`Executing script on VM ${req.params.id} via Cloudflare Workers`);
    const response = await axios.post(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/scripts`, req.body);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error executing script on VM ${req.params.id} via Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to execute script' });
  }
});

router.get('/:id/scripts', async (req, res) => {
  try {
    logger.info(`Fetching scripts for VM ${req.params.id} from Cloudflare Workers`);
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/scripts`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error fetching scripts for VM ${req.params.id} from Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// Metrics and Monitoring - proxy to Cloudflare Workers
router.get('/:id/metrics', async (req, res) => {
  try {
    logger.info(`Fetching metrics for VM ${req.params.id} from Cloudflare Workers`);
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/metrics`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error fetching metrics for VM ${req.params.id} from Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.post('/:id/metrics', async (req, res) => {
  try {
    logger.info(`Recording metrics for VM ${req.params.id} via Cloudflare Workers`);
    const response = await axios.post(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/metrics`, req.body);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error recording metrics for VM ${req.params.id} via Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
});

// Events and Logs - proxy to Cloudflare Workers
router.get('/:id/events', async (req, res) => {
  try {
    logger.info(`Fetching events for VM ${req.params.id} from Cloudflare Workers`);
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/events`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error fetching events for VM ${req.params.id} from Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    logger.info(`Fetching logs for VM ${req.params.id} from Cloudflare Workers`);
    const response = await axios.get(`${CLOUDFLARE_WORKERS_URL}/vms/${req.params.id}/logs`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error fetching logs for VM ${req.params.id} from Cloudflare Workers:`, error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;