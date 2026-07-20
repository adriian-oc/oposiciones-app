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

  async getUnreadSummary() {
    const response = await api.get('/api/messages/unread/summary');
    return response.data;
  },

  async getUnreadThreads() {
    const response = await api.get('/api/messages/unread/threads');
    return response.data;
  },

  async listThreads() {
    const response = await api.get('/api/messages/threads');
    return response.data;
  },

  async getCounterpart(studentId) {
    const response = await api.get(`/api/messages/${studentId}/counterpart`);
    return response.data;
  },
};
