const axios = require('axios');
const logger = require('../utils/logger');

class CloudVMService {
  constructor() {
    this.vmServers = new Map(); // Cache of available VM servers
  }

  async isCloudAvailable() {
    try {
      // Check if we have any registered VM servers
      const servers = await this.getAvailableServers();
      return servers.length > 0;
    } catch (error) {
      logger.error('Cloud VM service not available:', error);
      return false;
    }
  }

  async getAvailableServers() {
    try {
      const { getDatabase } = require('../database/init');
      const db = getDatabase();
      
      const servers = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM servers WHERE status = "active"', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Filter servers that are actually responding
      const availableServers = [];
      for (const server of servers) {
        try {
          const healthResponse = await axios.get(
            `https://${server.host}/health`,
            { timeout: 5000 }
          );
          if (healthResponse.data.status === 'healthy') {
            availableServers.push(server);
          }
        } catch (error) {
          logger.warn(`Server ${server.name} is not responding:`, error.message);
        }
      }

      return availableServers;
    } catch (error) {
      logger.error('Error getting available servers:', error);
      return [];
    }
  }

  async createVM(vmId, vmName, serverId = null) {
    try {
      const servers = await this.getAvailableServers();
      if (servers.length === 0) {
        throw new Error('No available VM servers');
      }

      // Use specified server or pick the first available
      let selectedServer = servers[0];
      if (serverId) {
        selectedServer = servers.find(s => s.id === serverId) || servers[0];
      }

      logger.info(`Creating VM ${vmId} on server ${selectedServer.name}`);

      // For now, we'll create a new VM server instance
      // In a real implementation, you'd have a VM pool or create new instances
      const vmServerUrl = `https://${selectedServer.host}`;
      
      // Test the server
      const healthResponse = await axios.get(`${vmServerUrl}/health`, { timeout: 5000 });
      
      if (healthResponse.data.status !== 'healthy') {
        throw new Error('Selected server is not healthy');
      }

      // Get VM info
      const infoResponse = await axios.get(`${vmServerUrl}/info`, { timeout: 5000 });
      
      return {
        containerId: `cloud-vm-${vmId}`,
        containerName: `cloud-vm-${vmId}`,
        novncPort: 6080, // Not used in cloud mode
        agentPort: 3000, // Not used in cloud mode
        novncUrl: `${vmServerUrl}/vnc`, // Placeholder for VNC interface
        agentUrl: vmServerUrl,
        status: 'ready',
        serverId: selectedServer.id,
        serverName: selectedServer.name
      };

    } catch (error) {
      logger.error(`Failed to create cloud VM ${vmId}:`, error);
      throw error;
    }
  }

  async deleteVM(vmId) {
    try {
      // In cloud mode, we don't actually delete the server
      // We just mark it as available for reuse
      logger.info(`VM ${vmId} marked for cleanup`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete cloud VM ${vmId}:`, error);
      throw error;
    }
  }

  async executeScript(vmId, script, screenshot = false) {
    try {
      const servers = await this.getAvailableServers();
      const server = servers.find(s => s.id === vmId.split('-')[0]); // Extract server ID from VM ID
      
      if (!server) {
        throw new Error('VM server not found');
      }

      const response = await axios.post(`https://${server.host}/run`, {
        job_id: `script-${Date.now()}`,
        script,
        screenshot
      }, { timeout: 30000 });

      return response.data;
    } catch (error) {
      logger.error(`Failed to execute script on VM ${vmId}:`, error);
      throw error;
    }
  }

  async navigateBrowser(vmId, url) {
    try {
      const servers = await this.getAvailableServers();
      const server = servers.find(s => s.id === vmId.split('-')[0]);
      
      if (!server) {
        throw new Error('VM server not found');
      }

      const response = await axios.post(`https://${server.host}/browser/navigate`, {
        url
      }, { timeout: 30000 });

      return response.data;
    } catch (error) {
      logger.error(`Failed to navigate browser on VM ${vmId}:`, error);
      throw error;
    }
  }
}

module.exports = new CloudVMService();
