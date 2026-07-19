import api from './api';

export const progressService = {
  async getMyProgress() {
    const response = await api.get('/api/progress/me');
    return response.data;
  },

  async getProgress(userId) {
    const response = await api.get(`/api/progress/${userId}`);
    return response.data;
  },

  async getPracticeHistory(userId, contentUnitKey) {
    const response = await api.get(`/api/progress/${userId}/history/${contentUnitKey}`);
    return response.data;
  },
};
