import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Create axios instance with credentials enabled
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API service methods
const apiService = {
  // Authentication
  async checkAuthStatus() {
    const response = await api.get('/auth/status');
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // User pages
  async getUserPages() {
    const response = await api.get('/api/user/pages');
    return response.data;
  },

  async connectPage(pageId) {
    const response = await api.post('/api/user/pages/connect', { pageId });
    return response.data;
  },

  async disconnectPage(pageId) {
    const response = await api.post('/api/user/pages/disconnect', { pageId });
    return response.data;
  },

  // Page data
  async getPageForms(pageId) {
    const response = await api.get(`/api/pages/${pageId}/forms`);
    return response.data;
  },

  async getFormLeads(pageId, formId) {
    const response = await api.get(`/api/pages/${pageId}/forms/${formId}/leads`);
    return response.data;
  },

  async syncPageData(pageId) {
    const response = await api.post(`/api/pages/${pageId}/sync`);
    return response.data;
  }
};

export default apiService;
