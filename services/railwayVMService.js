const axios = require('axios');
const logger = require('../utils/logger');

class RailwayVMService {
  constructor() {
    this.railwayApiUrl = process.env.RAILWAY_API_URL || 'https://chrome-vm-backend-production.up.railway.app';
    this.railwayApiKey = process.env.RAILWAY_API_KEY;
    
    // VM registry to track running VMs
    this.runningVMs = new Map();
  }

  async isAvailable() {
    try {
      // Test Railway API access
      const response = await axios.get(`${this.railwayApiUrl}/health`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Chrome-VM-Dashboard/1.0'
        }
      });
      
      return response.status === 200;
    } catch (error) {
      logger.warn('Railway service not available:', error.message);
      return true; // Allow testing with mock VMs
    }
  }

  async createVM(vmId, name, serverId, instanceType = 't3.medium') {
    try {
      logger.info(`Creating Railway VM ${vmId} with name ${name}`);
      
      // Check if service is available
      const serviceAvailable = await this.isAvailable();
      
      if (!serviceAvailable) {
        // Fallback to mock VM for now
        return await this.createMockVM(vmId, name, serverId, 'Railway service not available');
      }

      // For now, create a mock VM that simulates Railway
      // In production, this would create a real Railway container
      return await this.createMockVM(vmId, name, serverId, 'Railway VM (Mock)');

    } catch (error) {
      logger.error(`Failed to create VM ${vmId} on Railway:`, error);
      // Fallback to mock VM if Railway fails
      return await this.createMockVM(vmId, name, serverId, error.message);
    }
  }

  async getVMStatus(vmId) {
    try {
      const vm = this.runningVMs.get(vmId);
      if (!vm) {
        return { status: 'not_found' };
      }

      return { status: vm.status };
    } catch (error) {
      logger.error(`Failed to get VM status ${vmId}:`, error);
      return { status: 'error', error: error.message };
    }
  }

  async deleteVM(vmId) {
    try {
      const vm = this.runningVMs.get(vmId);
      if (!vm) {
        throw new Error('VM not found');
      }

      // Remove from registry
      this.runningVMs.delete(vmId);
      
      logger.info(`✅ VM ${vmId} deleted successfully from Railway`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to delete VM ${vmId}:`, error);
      throw error;
    }
  }

  // Mock VM creation for fallback
  async createMockVM(vmId, name, serverId, errorMessage = 'Railway service unavailable') {
    logger.info(`Creating mock Railway VM ${vmId} due to: ${errorMessage}`);
    const mockVM = {
      containerId: `mock-railway-${vmId}`,
      containerName: `mock-railway-vm-${vmId}`,
      novncPort: 6080,
      agentPort: 3000,
      novncUrl: `https://chrome-vm-workers.mgmt-5e1.workers.dev/vms/${vmId}/novnc`,
      agentUrl: `https://chrome-vm-workers.mgmt-5e1.workers.dev/vms/${vmId}/agent`,
      status: 'ready',
      serverId: serverId || 'default-railway-server',
      serverName: 'Railway VM Hosting (Mock)',
      publicIp: 'mock-railway-ip',
      region: 'railway-cloud',
      createdVia: 'railway-mock',
      error: errorMessage,
      vmId: vmId
    };
    this.runningVMs.set(vmId, mockVM);
    return mockVM;
  }

  // Get all running VMs
  async getAllVMs() {
    try {
      // Return mock VMs for now
      return Array.from(this.runningVMs.values());
    } catch (error) {
      logger.error('Failed to get all VMs from Railway:', error);
      return [];
    }
  }
}

module.exports = new RailwayVMService();
