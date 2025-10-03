const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Joi = require('joi');
const { getDatabase } = require('../database/init');
const logger = require('../utils/logger');
const cloudVMService = require('../services/cloudVMService');

const router = express.Router();
const db = getDatabase();

// Validation schemas
const createVMSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  instanceType: Joi.string().valid('t3.medium', 't3.large', 't3.xlarge', 't3.2xlarge').required(),
  server_id: Joi.string().uuid().required()
});

const updateVMSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  status: Joi.string().valid('ready', 'initializing', 'error', 'running'),
  novnc_url: Joi.string().uri().allow(null),
  agent_url: Joi.string().uri().allow(null),
  chrome_version: Joi.string().allow(null),
  node_version: Joi.string().allow(null)
});

// Get all VMs
router.get('/', async (req, res) => {
  try {
    const vms = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM vms ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(vms);
  } catch (error) {
    logger.error('Error fetching VMs:', error);
    res.status(500).json({ error: 'Failed to fetch VMs' });
  }
});

// Get VM by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const vm = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vms WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!vm) {
      return res.status(404).json({ error: 'VM not found' });
    }

    res.json(vm);
  } catch (error) {
    logger.error('Error fetching VM:', error);
    res.status(500).json({ error: 'Failed to fetch VM' });
  }
});

// Create new VM
router.post('/', async (req, res) => {
  try {
    const { error, value } = createVMSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, instanceType, server_id } = value;
    const vmId = uuidv4();

    // Check if cloud VM service is available
    const isCloudAvailable = await cloudVMService.isCloudAvailable();
    if (!isCloudAvailable) {
      return res.status(503).json({ 
        error: 'No cloud VM servers available. Please add a VM server first.' 
      });
    }

    // Create VM record in database first
    const vm = {
      id: vmId,
      name,
      status: 'initializing',
      novnc_url: null, // Will be set after Docker container creation
      agent_url: null, // Will be set after Docker container creation
      public_ip: 'localhost',
      chrome_version: null,
      node_version: null,
      created_at: new Date().toISOString(),
      last_activity: null,
      metadata: JSON.stringify({ instanceType, server_id })
    };

    // Insert VM into database
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO vms (id, name, status, novnc_url, agent_url, public_ip, chrome_version, node_version, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [vm.id, vm.name, vm.status, vm.novnc_url, vm.agent_url, vm.public_ip, vm.chrome_version, vm.node_version, vm.created_at, vm.metadata],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

        // Create cloud VM asynchronously
        setImmediate(async () => {
          try {
            logger.info(`Creating cloud VM ${vmId}...`);
            const cloudResult = await cloudVMService.createVM(vmId, name, server_id);
            
            // Update VM with real URLs and status
            const updatedVM = {
              ...vm,
              status: 'ready',
              novnc_url: cloudResult.novncUrl,
              agent_url: cloudResult.agentUrl,
              chrome_version: '120.0.0.0',
              node_version: '18.19.0',
              last_activity: new Date().toISOString()
            };

            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE vms SET status = ?, novnc_url = ?, agent_url = ?, chrome_version = ?, node_version = ?, last_activity = ? WHERE id = ?',
                [updatedVM.status, updatedVM.novnc_url, updatedVM.agent_url, updatedVM.chrome_version, updatedVM.node_version, updatedVM.last_activity, vmId],
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            logger.info(`✅ VM ${vmId} created successfully on cloud server ${cloudResult.serverName}`);
          } catch (error) {
            logger.error(`Error creating cloud VM ${vmId}:`, error);
            
            // Mark VM as error
            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE vms SET status = ? WHERE id = ?',
                ['error', vmId],
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        });

    res.status(201).json(vm);
  } catch (error) {
    logger.error('Error creating VM:', error);
    res.status(500).json({ error: 'Failed to create VM' });
  }
});

// Update VM
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateVMSchema.validate(req.body);
    
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

    updateValues.push(id);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE vms SET ${updateFields.join(', ')}, last_activity = ? WHERE id = ?`,
        [...updateValues, new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('VM not found'));
          else resolve();
        }
      );
    });

    // Fetch updated VM
    const vm = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vms WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json(vm);
  } catch (error) {
    if (error.message === 'VM not found') {
      return res.status(404).json({ error: 'VM not found' });
    }
    logger.error('Error updating VM:', error);
    res.status(500).json({ error: 'Failed to update VM' });
  }
});

// Delete VM
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if VM exists
    const vm = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vms WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!vm) {
      return res.status(404).json({ error: 'VM not found' });
    }

    // In a real implementation, this would trigger VM termination
    // For now, we'll just delete from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM vms WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Also delete related script jobs
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM script_jobs WHERE vm_id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'VM deleted successfully' });
  } catch (error) {
    logger.error('Error deleting VM:', error);
    res.status(500).json({ error: 'Failed to delete VM' });
  }
});

// Register VM (called by VM when it starts up)
router.post('/register', async (req, res) => {
  try {
    const { vm_id, novnc_url, agent_url, status, public_ip } = req.body;

    if (!vm_id || !novnc_url || !agent_url) {
      return res.status(400).json({ error: 'vm_id, novnc_url, and agent_url are required' });
    }

    // Check if VM exists
    const existingVM = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vms WHERE id = ?', [vm_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingVM) {
      // Update existing VM
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE vms SET novnc_url = ?, agent_url = ?, status = ?, public_ip = ?, last_activity = ? WHERE id = ?',
          [novnc_url, agent_url, status || 'ready', public_ip, new Date().toISOString(), vm_id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      // Create new VM record
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO vms (id, name, status, novnc_url, agent_url, public_ip, created_at, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [vm_id, `VM-${vm_id}`, status || 'ready', novnc_url, agent_url, public_ip, new Date().toISOString(), new Date().toISOString()],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({ message: 'VM registered successfully' });
  } catch (error) {
    logger.error('Error registering VM:', error);
    res.status(500).json({ error: 'Failed to register VM' });
  }
});

// Run script on VM
router.post('/:id/run-script', async (req, res) => {
  try {
    const { id } = req.params;
    const { script, screenshot, selector, wait_time } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Script is required' });
    }

    // Get VM details
    const vm = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vms WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!vm) {
      return res.status(404).json({ error: 'VM not found' });
    }

    if (vm.status !== 'ready') {
      return res.status(400).json({ error: 'VM is not ready' });
    }

    // Create script job
    const jobId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO script_jobs (id, vm_id, script, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [jobId, id, script, 'pending', new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Update VM status
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE vms SET status = ?, last_activity = ? WHERE id = ?',
        ['running', new Date().toISOString(), id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Execute script on cloud VM
    try {
      const result = await cloudVMService.executeScript(id, script, screenshot || false);

      // Update script job with result
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE script_jobs SET status = ?, result = ?, screenshot_path = ?, selected_text = ?, completed_at = ? WHERE id = ?',
          ['completed', JSON.stringify(result.result), result.screenshot, result.selected_text, new Date().toISOString(), jobId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update VM status back to ready
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE vms SET status = ?, last_activity = ? WHERE id = ?',
          ['ready', new Date().toISOString(), id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json(result);
    } catch (error) {
      // Update script job with error
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE script_jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?',
          ['failed', error.message, new Date().toISOString(), jobId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update VM status back to ready
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE vms SET status = ?, last_activity = ? WHERE id = ?',
          ['ready', new Date().toISOString(), id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.error('Script execution error:', error);
      res.status(500).json({ error: 'Script execution failed', details: error.message });
    }
  } catch (error) {
    logger.error('Error running script:', error);
    res.status(500).json({ error: 'Failed to run script' });
  }
});

// Get VM script jobs
router.get('/:id/jobs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const jobs = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM script_jobs WHERE vm_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [id, parseInt(limit), parseInt(offset)],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json(jobs);
  } catch (error) {
    logger.error('Error fetching VM jobs:', error);
    res.status(500).json({ error: 'Failed to fetch VM jobs' });
  }
});

// Get VM logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get VM info
    const vm = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vms WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!vm) {
      return res.status(404).json({ error: 'VM not found' });
    }

    // For now, return sample logs
    // In a real implementation, you'd fetch from Docker logs or a log service
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `VM ${vm.name} is running`,
        service: 'chrome-vm-backend'
      },
      {
        timestamp: new Date(Date.now() - 1000).toISOString(),
        level: 'info',
        message: 'Chrome browser initialized successfully',
        service: 'chrome-agent'
      },
      {
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: 'info',
        message: 'NoVNC server started on port 6080',
        service: 'novnc'
      }
    ];

    res.json({ logs });
  } catch (error) {
    logger.error('Error fetching VM logs:', error);
    res.status(500).json({ error: 'Failed to fetch VM logs' });
  }
});

module.exports = router;
