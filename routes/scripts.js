const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { getDatabase } = require('../database/init');
const logger = require('../utils/logger');

const router = express.Router();
const db = getDatabase();

// Validation schemas
const createScriptSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500),
  script: Joi.string().min(1).required(),
  category: Joi.string().valid('general', 'navigation', 'forms', 'extraction', 'testing').default('general')
});

const updateScriptSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(500),
  script: Joi.string().min(1),
  category: Joi.string().valid('general', 'navigation', 'forms', 'extraction', 'testing')
});

// Get all scripts
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM scripts';
    const params = [];

    const conditions = [];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR script LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const scripts = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(scripts);
  } catch (error) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// Get script by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const script = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM scripts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    res.json(script);
  } catch (error) {
    logger.error('Error fetching script:', error);
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

// Create new script
router.post('/', async (req, res) => {
  try {
    const { error, value } = createScriptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, script, category } = value;
    const scriptId = uuidv4();

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO scripts (id, name, description, script, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [scriptId, name, description, script, category, new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const newScript = {
      id: scriptId,
      name,
      description,
      script,
      category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'system'
    };

    res.status(201).json(newScript);
  } catch (error) {
    logger.error('Error creating script:', error);
    res.status(500).json({ error: 'Failed to create script' });
  }
});

// Update script
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateScriptSchema.validate(req.body);
    
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

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE scripts SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
        function(err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Script not found'));
          else resolve();
        }
      );
    });

    // Fetch updated script
    const script = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM scripts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json(script);
  } catch (error) {
    if (error.message === 'Script not found') {
      return res.status(404).json({ error: 'Script not found' });
    }
    logger.error('Error updating script:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// Delete script
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if script exists
    const script = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM scripts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM scripts WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Script deleted successfully' });
  } catch (error) {
    logger.error('Error deleting script:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

// Get script categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT category, COUNT(*) as count FROM scripts GROUP BY category ORDER BY category', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(categories);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Duplicate script
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required for duplicated script' });
    }

    // Get original script
    const originalScript = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM scripts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!originalScript) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const scriptId = uuidv4();

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO scripts (id, name, description, script, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [scriptId, name, originalScript.description, originalScript.script, originalScript.category, new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const newScript = {
      id: scriptId,
      name,
      description: originalScript.description,
      script: originalScript.script,
      category: originalScript.category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'system'
    };

    res.status(201).json(newScript);
  } catch (error) {
    logger.error('Error duplicating script:', error);
    res.status(500).json({ error: 'Failed to duplicate script' });
  }
});

module.exports = router;
