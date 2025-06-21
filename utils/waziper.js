const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Get API details from environment variables with fallbacks
const BASE_URL = process.env.WAZIPER_API_URL || 'https://waziper.com/api';
const ACCESS_TOKEN = process.env.WAZIPER_ACCESS_TOKEN || '685334261fcbe';

/**
 * Waziper API Client
 */
class WaziperClient {
  constructor(accessToken = ACCESS_TOKEN) {
    this.accessToken = accessToken;
    this.axios = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });
    
    // Add request interceptor for logging
    this.axios.interceptors.request.use(request => {
      console.log(`Waziper API Request: ${request.method.toUpperCase()} ${request.baseURL}${request.url}`);
      return request;
    });
    
    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      response => {
        console.log(`Waziper API Response: Status ${response.status}`);
        return response;
      },
      error => {
        console.error('Waziper API Error:', error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new WhatsApp instance
   * @returns {Promise} API response
   */
  async createInstance() {
    try {
      console.log('Creating new WhatsApp instance');
      return await this.axios.post(`/create_instance?access_token=${this.accessToken}`);
    } catch (error) {
      console.error('Error creating instance:', error.message);
      throw error;
    }
  }

  /**
   * Get QR code for an instance
   * @param {string} instanceId - The instance ID
   * @returns {Promise} API response with QR code
   */
  async getQRCode(instanceId) {
    try {
      console.log(`Getting QR code for instance: ${instanceId}`);
      const response = await this.axios.post(`/get_qrcode?instance_id=${instanceId}&access_token=${this.accessToken}`);
      
      // Enhanced debugging
      if (response.data) {
        if (response.data.status === 'success') {
          console.log('QR code retrieved successfully');
          
          // Check where the QR code is in the response
          if (response.data.qrcode) {
            console.log('QR code found in response.data.qrcode');
          } else if (response.data.data && response.data.data.qrcode) {
            console.log('QR code found in response.data.data.qrcode');
          } else {
            console.log('No QR code found in response, but status is success');
            console.log('Response structure:', JSON.stringify(response.data));
          }
        } else {
          console.log('API returned non-success status:', response.data.status);
          console.log('Response:', JSON.stringify(response.data));
        }
      }
      
      return response;
    } catch (error) {
      console.error(`Error getting QR code for instance ${instanceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Set webhook URL for receiving updates
   * @param {string} instanceId - The instance ID
   * @param {string} webhookUrl - The webhook URL
   * @param {boolean} enable - Whether to enable the webhook
   * @returns {Promise} API response
   */
  async setWebhook(instanceId, webhookUrl, enable = true) {
    try {
      console.log(`Setting webhook for instance ${instanceId} to ${webhookUrl}`);
      return await this.axios.post(
        `/set_webhook?webhook_url=${encodeURIComponent(webhookUrl)}&enable=${enable}&instance_id=${instanceId}&access_token=${this.accessToken}`
      );
    } catch (error) {
      console.error(`Error setting webhook for instance ${instanceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Reboot an instance
   * @param {string} instanceId - The instance ID
   * @returns {Promise} API response
   */
  async rebootInstance(instanceId) {
    try {
      console.log(`Rebooting instance ${instanceId}`);
      return await this.axios.post(`/reboot?instance_id=${instanceId}&access_token=${this.accessToken}`);
    } catch (error) {
      console.error(`Error rebooting instance ${instanceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Reset an instance
   * @param {string} instanceId - The instance ID
   * @returns {Promise} API response
   */
  async resetInstance(instanceId) {
    try {
      console.log(`Resetting instance ${instanceId}`);
      return await this.axios.post(`/reset_instance?instance_id=${instanceId}&access_token=${this.accessToken}`);
    } catch (error) {
      console.error(`Error resetting instance ${instanceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Reconnect an instance
   * @param {string} instanceId - The instance ID
   * @returns {Promise} API response
   */
  async reconnectInstance(instanceId) {
    try {
      console.log(`Reconnecting instance ${instanceId}`);
      return await this.axios.post(`/reconnect?instance_id=${instanceId}&access_token=${this.accessToken}`);
    } catch (error) {
      console.error(`Error reconnecting instance ${instanceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Send a text message
   * @param {string} instanceId - The instance ID
   * @param {string} number - The recipient's phone number
   * @param {string} message - The message text
   * @returns {Promise} API response
   */
  async sendTextMessage(instanceId, number, message) {
    try {
      console.log(`Sending text message to ${number} using instance ${instanceId}`);
      return await this.axios.post('/send', {
        number,
        type: 'text',
        message,
        instance_id: instanceId,
        access_token: this.accessToken,
      });
    } catch (error) {
      console.error(`Error sending text message to ${number}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate a public QR code URL from text
   * @param {string} text - The text to encode in the QR code
   * @returns {string} The QR code URL
   */
  generatePublicQRUrl(text) {
    // Use a public QR code generation service
    return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
  }

  /**
   * Send a media message
   * @param {string} instanceId - The instance ID
   * @param {string} number - The recipient's phone number
   * @param {string} message - The message text
   * @param {string} mediaUrl - The URL of the media to send
   * @param {string} [filename] - Optional filename for documents
   * @returns {Promise} API response
   */
  async sendMediaMessage(instanceId, number, message, mediaUrl, filename) {
    try {
      // Check if mediaUrl is a data URL (starts with "data:")
      if (mediaUrl.startsWith('data:')) {
        console.log('Converting data URL to a publicly accessible URL');
        
        // For data URLs, we need to use a publicly accessible URL
        // First, send the text message
        await this.sendTextMessage(instanceId, number, message);
        
        // Then use a public QR code service to generate a QR code
        const publicQrUrl = this.generatePublicQRUrl(number);
        console.log(`Generated public QR URL: ${publicQrUrl}`);
        
        // Send the QR code as a separate message
        const payload = {
          number,
          type: 'media',
          message: 'Here is your QR code:',
          media_url: publicQrUrl,
          instance_id: instanceId,
          access_token: this.accessToken,
        };
        
        if (filename) {
          payload.filename = filename;
        }
        
        return await this.axios.post('/send', payload);
      }
      
      console.log(`Sending media message to ${number} using instance ${instanceId}`);
      console.log(`Media URL: ${mediaUrl}`);
      
      const payload = {
        number,
        type: 'media',
        message,
        media_url: mediaUrl,
        instance_id: instanceId,
        access_token: this.accessToken,
      };
      
      if (filename) {
        payload.filename = filename;
      }
      
      return await this.axios.post('/send', payload);
    } catch (error) {
      console.error(`Error sending media message to ${number}:`, error.message);
      throw error;
    }
  }

  /**
   * Send a text message to a group
   * @param {string} instanceId - The instance ID
   * @param {string} groupId - The group ID
   * @param {string} message - The message text
   * @returns {Promise} API response
   */
  async sendGroupTextMessage(instanceId, groupId, message) {
    try {
      console.log(`Sending text message to group ${groupId} using instance ${instanceId}`);
      return await this.axios.post('/send_group', {
        group_id: groupId,
        type: 'text',
        message,
        instance_id: instanceId,
        access_token: this.accessToken,
      });
    } catch (error) {
      console.error(`Error sending text message to group ${groupId}:`, error.message);
      throw error;
    }
  }

  /**
   * Send a media message to a group
   * @param {string} instanceId - The instance ID
   * @param {string} groupId - The group ID
   * @param {string} message - The message text
   * @param {string} mediaUrl - The URL of the media to send
   * @param {string} [filename] - Optional filename for documents
   * @returns {Promise} API response
   */
  async sendGroupMediaMessage(instanceId, groupId, message, mediaUrl, filename) {
    try {
      console.log(`Sending media message to group ${groupId} using instance ${instanceId}`);
      
      const payload = {
        group_id: groupId,
        type: 'media',
        message,
        media_url: mediaUrl,
        instance_id: instanceId,
        access_token: this.accessToken,
      };
      
      if (filename) {
        payload.filename = filename;
      }
      
      return await this.axios.post('/send_group', payload);
    } catch (error) {
      console.error(`Error sending media message to group ${groupId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get instance status
   * @param {string} instanceId - The instance ID
   * @returns {Promise} API response
   */
  async getInstanceStatus(instanceId) {
    try {
      console.log(`Getting status for instance ${instanceId}`);
      // First try the dedicated status endpoint
      try {
        const response = await this.axios.get(`/instance_status?instance_id=${instanceId}&access_token=${this.accessToken}`);
        return response;
      } catch (error) {
        console.log(`Direct status endpoint failed: ${error.message}, trying info endpoint`);
        // If that fails, try the info endpoint as fallback
        return await this.axios.get(`/instance_info?instance_id=${instanceId}&access_token=${this.accessToken}`);
      }
    } catch (error) {
      console.error(`Error getting status for instance ${instanceId}:`, error.message);
      throw error;
    }
  }
}

// Create and export a singleton instance
const waziper = new WaziperClient();
module.exports = waziper; 