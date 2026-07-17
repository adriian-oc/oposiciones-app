import api from './api';

export const messageService = {
  async getThread(studentId) {
    const response = await api.get(`/api/messages/${studentId}`);
    return response.data;
  },

  async sendMessage(studentId, text) {
    const response = await api.post(`/api/messages/${studentId}`, { text });
    return response.data;
  },
};
