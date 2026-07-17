import api from './api';

export const adminService = {
  async listStudents() {
    const response = await api.get('/api/admin/students');
    return response.data;
  },

  async createStudent(data) {
    const response = await api.post('/api/admin/students', data);
    return response.data;
  },

  async updateStudent(userId, update) {
    const response = await api.patch(`/api/admin/students/${userId}`, update);
    return response.data;
  },

  async revokeStudent(userId) {
    const response = await api.post(`/api/admin/students/${userId}/revoke`);
    return response.data;
  },

  async reactivateStudent(userId) {
    const response = await api.post(`/api/admin/students/${userId}/reactivate`);
    return response.data;
  },

  async sendPasswordReset(userId) {
    const response = await api.post(`/api/admin/students/${userId}/send-password-reset`);
    return response.data;
  },

  async markReviewed(userId) {
    const response = await api.post(`/api/admin/students/${userId}/mark-reviewed`);
    return response.data;
  },
};
