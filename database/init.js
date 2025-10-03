const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/chrome_vm.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create servers table
      db.run(`
        CREATE TABLE IF NOT EXISTS servers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER DEFAULT 3000,
          novnc_port INTEGER DEFAULT 6080,
          max_vms INTEGER DEFAULT 10,
          location TEXT DEFAULT 'Unknown',
          status TEXT NOT NULL DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_check DATETIME,
          health TEXT DEFAULT 'unknown'
        )
      `);

      // Create VMs table
      db.run(`
        CREATE TABLE IF NOT EXISTS vms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          server_id TEXT,
          status TEXT NOT NULL DEFAULT 'initializing',
          novnc_url TEXT,
          agent_url TEXT,
          public_ip TEXT,
          chrome_version TEXT,
          node_version TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME,
          metadata TEXT,
          FOREIGN KEY (server_id) REFERENCES servers (id)
        )
      `);

      // Create script jobs table
      db.run(`
        CREATE TABLE IF NOT EXISTS script_jobs (
          id TEXT PRIMARY KEY,
          vm_id TEXT NOT NULL,
          script TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          result TEXT,
          error TEXT,
          screenshot_path TEXT,
          selected_text TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME,
          completed_at DATETIME,
          FOREIGN KEY (vm_id) REFERENCES vms (id)
        )
      `);

      // Create scripts table (saved scripts)
      db.run(`
        CREATE TABLE IF NOT EXISTS scripts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          script TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT DEFAULT 'system'
        )
      `);

      // Create indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_vms_status ON vms (status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vms_created_at ON vms (created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_script_jobs_vm_id ON script_jobs (vm_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_script_jobs_status ON script_jobs (status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_script_jobs_created_at ON script_jobs (created_at)`);

      // Insert default scripts
      db.run(`
        INSERT OR IGNORE INTO scripts (id, name, description, script, category) VALUES 
        ('basic-nav', 'Basic Navigation', 'Navigate to a website and get basic info', 
         'await page.goto("https://example.com");\nconst title = await page.title();\nconst url = page.url();\nreturn { title, url };', 'navigation'),
        ('form-fill', 'Form Filling', 'Fill out a form with test data', 
         'await page.goto("https://example.com/form");\nawait page.type("#username", "testuser");\nawait page.type("#password", "testpass");\nawait page.click("#submit-btn");\nreturn { success: true };', 'forms'),
        ('data-extract', 'Data Extraction', 'Extract data from a page', 
         'await page.goto("https://example.com/products");\nconst products = await page.$$eval(".product", elements => \n  elements.map(el => ({\n    name: el.querySelector(".name")?.textContent,\n    price: el.querySelector(".price")?.textContent\n  }))\n);\nreturn { products };', 'extraction')
      `);

      resolve();
    });

    db.on('error', (err) => {
      reject(err);
    });
  });
};

const getDatabase = () => db;

module.exports = {
  initializeDatabase,
  getDatabase
};
