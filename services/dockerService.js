const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class DockerService {
  constructor() {
    this.docker = new Docker();
    this.vmPorts = {
      novnc: 6080,
      agent: 3000
    };
    this.nextPort = 6082; // Start from 6082 for NoVNC (6081 is used by chrome-vm-1)
    this.nextAgentPort = 3003; // Start from 3003 for agent (3002 is used by chrome-vm-1)
  }

  async isDockerAvailable() {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.error('Docker is not available:', error.message);
      return false;
    }
  }

  async buildVMImage() {
    try {
      logger.info('Building Chrome VM Docker image...');
      
      const stream = await this.docker.buildImage({
        context: '/Users/docshay/chrome-vm-dashboard/docker-vm',
        src: ['Dockerfile', 'package.json', 'agent.js', 'start-desktop.sh', 'start.sh', 'supervisord.conf']
      }, {
        t: 'chrome-vm-dashboard-chrome-vm-1:latest'
      });

      return new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) {
            logger.error('Failed to build Docker image:', err);
            reject(err);
          } else {
            logger.info('✅ Chrome VM Docker image built successfully');
            resolve(res);
          }
        });
      });
    } catch (error) {
      logger.error('Error building Docker image:', error);
      throw error;
    }
  }

  async createVM(vmId, vmName) {
    try {
      const isAvailable = await this.isDockerAvailable();
      if (!isAvailable) {
        throw new Error('Docker is not available');
      }

      // Check if image exists, build if not
      try {
        await this.docker.getImage('chrome-vm-dashboard-chrome-vm-1:latest').inspect();
      } catch (error) {
        logger.info('Docker image not found, building...');
        await this.buildVMImage();
      }

      const containerName = `chrome-vm-${vmId}`;
      const novncPort = this.nextPort++;
      const agentPort = this.nextAgentPort++;

      const containerConfig = {
        Image: 'chrome-vm-dashboard-chrome-vm-1:latest',
        name: containerName,
        Env: [
          `VM_ID=${vmId}`,
          `DISPLAY=:1`,
          `NODE_ENV=production`
        ],
        ExposedPorts: {
          '6080/tcp': {},
          '3000/tcp': {}
        },
        PortBindings: {
          '6080/tcp': [{ HostPort: novncPort.toString() }],
          '3000/tcp': [{ HostPort: agentPort.toString() }]
        },
        HostConfig: {
          AutoRemove: false,
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          Binds: [
            `chrome-data-${vmId}:/home/chromeuser/.config/google-chrome`
          ]
        },
        Labels: {
          'chrome-vm-dashboard': 'true',
          'vm-id': vmId,
          'vm-name': vmName
        }
      };

      logger.info(`Creating Docker container for VM ${vmId}...`);
      const container = await this.docker.createContainer(containerConfig);
      
      await container.start();
      
      logger.info(`✅ VM ${vmId} created successfully`);
      
      return {
        containerId: container.id,
        containerName,
        novncPort,
        agentPort,
        novncUrl: `http://localhost:${novncPort}/vnc.html`,
        agentUrl: `http://localhost:${agentPort}`,
        status: 'starting'
      };

    } catch (error) {
      logger.error(`Failed to create VM ${vmId}:`, error);
      throw error;
    }
  }

  async deleteVM(vmId) {
    try {
      const containerName = `chrome-vm-${vmId}`;
      const container = this.docker.getContainer(containerName);
      
      await container.stop();
      await container.remove({ force: true });
      
      logger.info(`✅ VM ${vmId} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete VM ${vmId}:`, error);
      throw error;
    }
  }

  async getVMStatus(vmId) {
    try {
      const containerName = `chrome-vm-${vmId}`;
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();
      
      return {
        status: info.State.Running ? 'ready' : 'stopped',
        containerId: info.Id,
        createdAt: info.Created,
        state: info.State
      };
    } catch (error) {
      logger.error(`Failed to get status for VM ${vmId}:`, error);
      return { status: 'not_found' };
    }
  }

  async listVMs() {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['chrome-vm-dashboard=true']
        }
      });

      return containers.map(container => ({
        id: container.Labels['vm-id'],
        name: container.Labels['vm-name'],
        containerId: container.Id,
        status: container.State === 'running' ? 'ready' : 'stopped',
        created: container.Created,
        ports: container.Ports
      }));
    } catch (error) {
      logger.error('Failed to list VMs:', error);
      return [];
    }
  }

  async executeScript(vmId, script, options = {}) {
    try {
      const containerName = `chrome-vm-${vmId}`;
      const container = this.docker.getContainer(containerName);
      
      // Get the agent port from container info
      const info = await container.inspect();
      const agentPort = info.NetworkSettings.Ports['3000/tcp']?.[0]?.HostPort;
      
      if (!agentPort) {
        throw new Error('Agent port not found');
      }

      // Make HTTP request to the agent
      const axios = require('axios');
      const response = await axios.post(`http://localhost:${agentPort}/run`, {
        job_id: uuidv4(),
        script,
        ...options
      }, {
        timeout: 300000 // 5 minutes
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to execute script on VM ${vmId}:`, error);
      throw error;
    }
  }
}

module.exports = new DockerService();
