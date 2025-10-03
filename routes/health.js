const express = require('express');
const { getDatabase } = require('../database/init');
const os = require('os');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Test database connection
    const dbHealth = await new Promise((resolve) => {
      db.get('SELECT 1', (err) => {
        resolve({ status: err ? 'error' : 'healthy', error: err?.message });
      });
    });

    // Get system info
    const systemInfo = {
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage(),
        free: os.freemem(),
        total: os.totalmem()
      },
      cpu: {
        loadAverage: os.loadavg(),
        cpus: os.cpus().length
      },
      platform: os.platform(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };

    const health = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      database: dbHealth,
      system: systemInfo,
      version: '1.0.0'
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Database stats
    const dbStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          (SELECT COUNT(*) FROM vms) as vm_count,
          (SELECT COUNT(*) FROM script_jobs) as job_count,
          (SELECT COUNT(*) FROM scripts) as script_count,
          (SELECT COUNT(*) FROM vms WHERE status = 'ready') as ready_vms,
          (SELECT COUNT(*) FROM vms WHERE status = 'running') as running_vms,
          (SELECT COUNT(*) FROM vms WHERE status = 'error') as error_vms
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });

    // Recent activity
    const recentJobs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sj.*, v.name as vm_name 
        FROM script_jobs sj 
        LEFT JOIN vms v ON sj.vm_id = v.id 
        ORDER BY sj.created_at DESC 
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const detailedHealth = {
      status: 'healthy',
      database: dbStats,
      recentActivity: recentJobs,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: os.platform(),
        nodeVersion: process.version
      },
      timestamp: new Date().toISOString()
    };

    res.json(detailedHealth);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
