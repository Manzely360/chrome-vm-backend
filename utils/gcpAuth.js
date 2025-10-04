const { GoogleAuth } = require('google-auth-library');
const logger = require('./logger');

class GCPAuth {
  constructor() {
    this.auth = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID;
    this.zone = process.env.GOOGLE_CLOUD_ZONE || process.env.GCP_ZONE || 'us-central1-a';
    
    logger.info(`GCP Auth initialized for project: ${this.projectId}, zone: ${this.zone}`);
  }

  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Initialize auth if not done
      if (!this.auth) {
        this.auth = new GoogleAuth({
          scopes: [
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/compute'
          ],
          projectId: this.projectId
        });
      }

      // Get access token
      const client = await this.auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      this.accessToken = accessTokenResponse.token;
      // Set expiry to 50 minutes (tokens typically last 1 hour)
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      
      logger.info('GCP access token refreshed successfully');
      return this.accessToken;
      
    } catch (error) {
      logger.error('Failed to get GCP access token:', error);
      
      // Fallback to environment variable if available
      if (process.env.GOOGLE_CLOUD_ACCESS_TOKEN) {
        logger.info('Using fallback access token from environment');
        this.accessToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
        this.tokenExpiry = Date.now() + (50 * 60 * 1000); // Assume 1 hour validity
        return this.accessToken;
      }
      
      throw new Error(`GCP authentication failed: ${error.message}`);
    }
  }

  async getAuthHeaders() {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  getProjectId() {
    return this.projectId;
  }

  getZone() {
    return this.zone;
  }

  isConfigured() {
    return !!(this.projectId && (this.auth || process.env.GOOGLE_CLOUD_ACCESS_TOKEN));
  }
}

module.exports = new GCPAuth();
