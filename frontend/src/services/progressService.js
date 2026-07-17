import api from './api';

export const progressService = {
  async getMyProgress() {
    const response = await api.get('/api/progress/me');
    return response.data;
  },
};
