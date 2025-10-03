const axios = require('axios');
const logger = require('../utils/logger');

class GoogleCloudVMService {
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'chrome-vm-dashboard';
    this.zone = process.env.GOOGLE_CLOUD_ZONE || 'us-central1-a';
    this.region = process.env.GOOGLE_CLOUD_REGION || 'us-central1';
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    this.accessToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
    
    // VM registry to track running VMs
    this.runningVMs = new Map();
  }

  async isAvailable() {
    try {
      // Check if Google Cloud credentials are available
      if (!this.accessToken && !this.apiKey) {
        logger.warn('Google Cloud credentials not available');
        return false;
      }
      
      // Test Google Cloud API access
      const response = await axios.get(`https://compute.googleapis.com/compute/v1/projects/${this.projectId}/zones/${this.zone}/instances`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      logger.warn('Google Cloud service not available:', error.message);
      return false;
    }
  }

  async createVM(vmId, name, serverId, instanceType = 'e2-medium') {
    try {
      logger.info(`Creating Google Cloud VM ${vmId} with name ${name}`);
      
      // Check if service is available
      const serviceAvailable = await this.isAvailable();
      
      if (!serviceAvailable) {
        // Fallback to mock VM for now
        return await this.createMockVM(vmId, name, serverId, 'Google Cloud service not configured');
      }

      // Create VM on Google Cloud
      const instanceName = `chrome-vm-${vmId}`;
      const machineType = this.getMachineType(instanceType);
      
      const instanceConfig = {
        name: instanceName,
        machineType: `zones/${this.zone}/machineTypes/${machineType}`,
        disks: [{
          boot: true,
          autoDelete: true,
          initializeParams: {
            sourceImage: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts',
            diskSizeGb: '20'
          }
        }],
        networkInterfaces: [{
          accessConfigs: [{
            type: 'ONE_TO_ONE_NAT',
            name: 'External NAT'
          }],
          network: 'global/networks/default'
        }],
        metadata: {
          items: [{
            key: 'startup-script',
            value: this.getStartupScript()
          }]
        },
        tags: {
          items: ['chrome-vm', 'browser-automation']
        }
      };

      const response = await axios.post(
        `https://compute.googleapis.com/compute/v1/projects/${this.projectId}/zones/${this.zone}/instances`,
        instanceConfig,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.status === 200) {
        const instance = response.data;
        
        // Store VM info
        const realVM = {
          containerId: instance.id,
          containerName: instanceName,
          novncPort: 6080,
          agentPort: 3000,
          novncUrl: `https://${instance.networkInterfaces[0].accessConfigs[0].natIP}:6080/vnc.html`,
          agentUrl: `https://${instance.networkInterfaces[0].accessConfigs[0].natIP}:3000`,
          status: 'initializing',
          serverId: serverId || 'default-google-cloud-server',
          serverName: 'Google Cloud VM Hosting',
          publicIp: instance.networkInterfaces[0].accessConfigs[0].natIP,
          region: this.region,
          createdVia: 'google-cloud',
          vmId: vmId,
          instanceId: instance.id
        };

        this.runningVMs.set(vmId, realVM);
        logger.info(`✅ VM ${vmId} created successfully on Google Cloud`);
        logger.info(`NoVNC URL: ${realVM.novncUrl}, Agent URL: ${realVM.agentUrl}`);

        return realVM;
      } else {
        throw new Error(`Failed to create VM: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      logger.error(`Failed to create VM ${vmId} on Google Cloud:`, error);
      // Fallback to mock VM if Google Cloud fails
      return await this.createMockVM(vmId, name, serverId, error.message);
    }
  }

  getMachineType(instanceType) {
    const typeMap = {
      'e2-micro': 'e2-micro',
      'e2-small': 'e2-small', 
      'e2-medium': 'e2-medium',
      'e2-standard-2': 'e2-standard-2',
      'e2-standard-4': 'e2-standard-4',
      'e2-standard-8': 'e2-standard-8'
    };
    return typeMap[instanceType] || 'e2-medium';
  }

  getStartupScript() {
    return `#!/bin/bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Chrome and dependencies
apt-get update
apt-get install -y wget gnupg
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install NoVNC
apt-get install -y xvfb x11vnc
git clone https://github.com/novnc/noVNC.git /opt/novnc
git clone https://github.com/novnc/websockify.git /opt/novnc/utils/websockify

# Start services
export DISPLAY=:1
Xvfb :1 -screen 0 1920x1080x24 &
x11vnc -display :1 -nopw -listen localhost -xkb -ncache 10 -ncache_cr -forever &
/opt/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &

# Start Chrome
google-chrome --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9222 &
`;
  }

  async getVMStatus(vmId) {
    try {
      const vm = this.runningVMs.get(vmId);
      if (!vm) {
        return { status: 'not_found' };
      }

      // Check Google Cloud instance status
      const response = await axios.get(
        `https://compute.googleapis.com/compute/v1/projects/${this.projectId}/zones/${this.zone}/instances/${vm.instanceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        const instance = response.data;
        const status = instance.status.toLowerCase();
        
        // Update VM status based on instance status
        vm.status = status === 'running' ? 'ready' : 'initializing';
        this.runningVMs.set(vmId, vm);
        
        return { status: vm.status, instance: instance };
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

      // Delete instance from Google Cloud
      await axios.delete(
        `https://compute.googleapis.com/compute/v1/projects/${this.projectId}/zones/${this.zone}/instances/${vm.instanceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Remove from registry
      this.runningVMs.delete(vmId);
      
      logger.info(`✅ VM ${vmId} deleted successfully from Google Cloud`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to delete VM ${vmId}:`, error);
      throw error;
    }
  }

  // Mock VM creation for fallback
  async createMockVM(vmId, name, serverId, errorMessage = 'Google Cloud service unavailable') {
    logger.info(`Creating mock Google Cloud VM ${vmId} due to: ${errorMessage}`);
    const mockVM = {
      containerId: `mock-gcp-${vmId}`,
      containerName: `mock-gcp-vm-${vmId}`,
      novncPort: 6080,
      agentPort: 3000,
      novncUrl: `https://mock-google-cloud-vm.up.railway.app/vms/${vmId}/novnc`,
      agentUrl: `https://mock-google-cloud-vm.up.railway.app/vms/${vmId}/agent`,
      status: 'ready',
      serverId: serverId || 'default-google-cloud-server',
      serverName: 'Google Cloud VM Hosting (Mock)',
      publicIp: 'mock-gcp-ip',
      region: 'us-central1',
      createdVia: 'google-cloud-mock',
      error: errorMessage,
      vmId: vmId
    };
    this.runningVMs.set(vmId, mockVM);
    return mockVM;
  }

  // Get all running VMs
  async getAllVMs() {
    try {
      const response = await axios.get(
        `https://compute.googleapis.com/compute/v1/projects/${this.projectId}/zones/${this.zone}/instances`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        return response.data.items || [];
      }
      return [];
    } catch (error) {
      logger.error('Failed to get all VMs from Google Cloud:', error);
      return [];
    }
  }
}

module.exports = new GoogleCloudVMService();
