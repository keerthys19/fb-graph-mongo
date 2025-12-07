const axios = require('axios');

class FacebookOAuthService {
  constructor() {
    this.appId = process.env.FACEBOOK_APP_ID;
    this.appSecret = process.env.FACEBOOK_APP_SECRET || process.env.APP_SECRET;
    this.redirectUri = process.env.OAUTH_REDIRECT_URI;
    this.graphApiVersion = '20.0';
  }

  /**
   * Generate Facebook OAuth URL for user login
   * @param {string} state - CSRF protection state parameter
   * @returns {string} OAuth URL
   */
  getAuthorizationUrl(state) {
    const scopes = [
      'pages_show_list',
      'pages_manage_metadata',
      'leads_retrieval',
      'pages_read_engagement'
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      state: state,
      response_type: 'code'
    });

    return `https://www.facebook.com/v${this.graphApiVersion}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from Facebook
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v${this.graphApiVersion}/oauth/access_token`,
        {
          params: {
            client_id: this.appId,
            client_secret: this.appSecret,
            redirect_uri: this.redirectUri,
            code: code
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Get user profile information
   * @param {string} accessToken - User access token
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(accessToken) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v${this.graphApiVersion}/me`,
        {
          params: {
            fields: 'id,name,email',
            access_token: accessToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error.response?.data || error.message);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Get user's Facebook pages
   * @param {string} accessToken - User access token
   * @returns {Promise<Array>} List of pages
   */
  async getUserPages(accessToken) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v${this.graphApiVersion}/me/accounts`,
        {
          params: {
            access_token: accessToken
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching user pages:', error.response?.data || error.message);
      throw new Error('Failed to fetch user pages');
    }
  }

  /**
   * Subscribe a page to webhooks
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @param {Array<string>} subscribedFields - Fields to subscribe to (default: leadgen)
   * @returns {Promise<Object>} Subscription result
   */
  async subscribePageToWebhooks(pageId, pageAccessToken, subscribedFields = ['leadgen']) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v${this.graphApiVersion}/${pageId}/subscribed_apps`,
        {},
        {
          params: {
            access_token: pageAccessToken,
            subscribed_fields: subscribedFields.join(',')
          }
        }
      );

      console.log(`✅ Successfully subscribed page ${pageId} to webhooks`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error subscribing page ${pageId} to webhooks:`, error.response?.data || error.message);
      throw new Error('Failed to subscribe page to webhooks');
    }
  }

  /**
   * Unsubscribe a page from webhooks
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribePageFromWebhooks(pageId, pageAccessToken) {
    try {
      const response = await axios.delete(
        `https://graph.facebook.com/v${this.graphApiVersion}/${pageId}/subscribed_apps`,
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      console.log(`✅ Successfully unsubscribed page ${pageId} from webhooks`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error unsubscribing page ${pageId} from webhooks:`, error.response?.data || error.message);
      throw new Error('Failed to unsubscribe page from webhooks');
    }
  }

  /**
   * Get lead forms for a page
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @returns {Promise<Array>} List of lead forms
   */
  async getPageLeadForms(pageId, pageAccessToken) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v${this.graphApiVersion}/${pageId}/leadgen_forms`,
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching lead forms:', error.response?.data || error.message);
      throw new Error('Failed to fetch lead forms');
    }
  }

  /**
   * Get leads for a specific form
   * @param {string} formId - Lead form ID
   * @param {string} pageAccessToken - Page access token
   * @returns {Promise<Array>} List of leads
   */
  async getFormLeads(formId, pageAccessToken) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v${this.graphApiVersion}/${formId}/leads`,
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching leads:', error.response?.data || error.message);
      throw new Error('Failed to fetch leads');
    }
  }
}

module.exports = new FacebookOAuthService();
