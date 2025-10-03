const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Joi = require('joi');
const { getDatabase } = require('../database/init');
const logger = require('../utils/logger');

const router = express.Router();
const db = getDatabase();

// Validation schemas
const createServerSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  host: Joi.string().min(1).required(),
  port: Joi.number().port().default(3000),
  novnc_port: Joi.number().port().default(6080),
  max_vms: Joi.number().min(1).max(100).default(10),
  location: Joi.string().max(100).default('Unknown'),
  status: Joi.string().valid('active', 'inactive', 'maintenance').default('active')
});

const updateServerSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  host: Joi.string().min(1),
  port: Joi.number().port(),
  novnc_port: Joi.number().port(),
  max_vms: Joi.number().min(1).max(100),
  location: Joi.string().max(100),
  status: Joi.string().valid('active', 'inactive', 'maintenance')
});

// Get all servers
router.get('/', async (req, res) => {
  try {
    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM servers ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Check server health for each server
    const serversWithHealth = await Promise.all(
      servers.map(async (server) => {
        try {
          const healthResponse = await axios.get(
            `http://${server.host}:${server.port}/health`,
            { timeout: 5000 }
          );
          return {
            ...server,
            health: 'healthy',
            last_check: new Date().toISOString(),
            response_time: healthResponse.headers['x-response-time'] || 'unknown'
          };
        } catch (error) {
          return {
            ...server,
            health: 'unhealthy',
            last_check: new Date().toISOString(),
            error: error.message
          };
        }
      })
    );

    res.json(serversWithHealth);
  } catch (error) {
    logger.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get server by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const server = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM servers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Check server health
    try {
      const healthResponse = await axios.get(
        `http://${server.host}:${server.port}/health`,
        { timeout: 5000 }
      );
      server.health = 'healthy';
      server.last_check = new Date().toISOString();
    } catch (error) {
      server.health = 'unhealthy';
      server.last_check = new Date().toISOString();
      server.error = error.message;
    }

    res.json(server);
  } catch (error) {
    logger.error('Error fetching server:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Create new server
router.post('/', async (req, res) => {
  try {
    const { error, value } = createServerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, host, port, novnc_port, max_vms, location, status } = value;
    const serverId = uuidv4();

    // Test server connectivity
    try {
      const healthResponse = await axios.get(
        `http://${host}:${port}/health`,
        { timeout: 5000 }
      );
    } catch (error) {
      return res.status(400).json({ 
        error: 'Cannot connect to server', 
        details: error.message 
      });
    }

    const server = {
      id: serverId,
      name,
      host,
      port,
      novnc_port,
      max_vms,
      location,
      status,
      created_at: new Date().toISOString(),
      last_check: new Date().toISOString(),
      health: 'healthy'
    };

    // Insert server into database
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO servers (id, name, host, port, novnc_port, max_vms, location, status, created_at, last_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [server.id, server.name, server.host, server.port, server.novnc_port, server.max_vms, server.location, server.status, server.created_at, server.last_check],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.status(201).json(server);
  } catch (error) {
    logger.error('Error creating server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// Update server
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateServerSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updateFields = [];
    const updateValues = [];

    Object.keys(value).forEach(key => {
      updateFields.push(`${key} = ?`);
      updateValues.push(value[key]);
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE servers SET ${updateFields.join(', ')}, last_check = ? WHERE id = ?`,
        updateValues,
        function(err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Server not found'));
          else resolve();
        }
      );
    });

    // Fetch updated server
    const server = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM servers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json(server);
  } catch (error) {
    if (error.message === 'Server not found') {
      return res.status(404).json({ error: 'Server not found' });
    }
    logger.error('Error updating server:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// Delete server
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if server exists
    const server = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM servers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Check if server has VMs
    const vmCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM vms WHERE server_id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (vmCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete server with active VMs', 
        vm_count: vmCount 
      });
    }

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM servers WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    logger.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// Get server VMs
router.get('/:id/vms', async (req, res) => {
  try {
    const { id } = req.params;
    
    const vms = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM vms WHERE server_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(vms);
  } catch (error) {
    logger.error('Error fetching server VMs:', error);
    res.status(500).json({ error: 'Failed to fetch server VMs' });
  }
});

// Test server connection
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    const server = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM servers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    try {
      const startTime = Date.now();
      const healthResponse = await axios.get(
        `http://${server.host}:${server.port}/health`,
        { timeout: 10000 }
      );
      const responseTime = Date.now() - startTime;

      // Update last check time
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE servers SET last_check = ? WHERE id = ?',
          [new Date().toISOString(), id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({
        status: 'success',
        response_time: `${responseTime}ms`,
        health: healthResponse.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error testing server:', error);
    res.status(500).json({ error: 'Failed to test server' });
  }
});

module.exports = router;
