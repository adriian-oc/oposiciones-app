import api from './api';

export const themeService = {
  async getThemes(part = null) {
    const params = {};
    if (part) params.part = part;
    const response = await api.get('/api/themes', { params });
    return response.data;
  },

  async getThemeById(themeId) {
    const response = await api.get(`/api/themes/${themeId}`);
    return response.data;
  },

  async createTheme(themeData) {
    const response = await api.post('/api/themes', themeData);
    return response.data;
  },
};
