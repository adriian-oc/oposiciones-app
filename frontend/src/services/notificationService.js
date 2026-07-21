import api from './api';

export const notificationService = {
  async getUnread() {
    const response = await api.get('/api/notifications/unread');
    return response.data;
  },

  async markRead(notificationId) {
    await api.post(`/api/notifications/${notificationId}/read`);
  },

  async getRecent(limit = 50) {
    const response = await api.get('/api/notifications/recent', { params: { limit } });
    return response.data;
  },
};
