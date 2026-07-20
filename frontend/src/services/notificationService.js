import api from './api';

export const notificationService = {
  async getUnread() {
    const response = await api.get('/api/notifications/unread');
    return response.data;
  },

  async markRead(notificationId) {
    await api.post(`/api/notifications/${notificationId}/read`);
  },
};
