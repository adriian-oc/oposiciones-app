import api from './api';

export const contestService = {
  async getConfig() {
    const response = await api.get('/api/contest/config');
    return response.data;
  },

  async signup(nombre, email) {
    const response = await api.post('/api/contest/signup', { nombre, email });
    return response.data;
  },

  async getMyEntry() {
    const response = await api.get('/api/contest/my-entry');
    return response.data;
  },

  async getRanking() {
    const response = await api.get('/api/contest/ranking');
    return response.data;
  },

  async getAdminSummary() {
    const response = await api.get('/api/contest/admin');
    return response.data;
  },
};
