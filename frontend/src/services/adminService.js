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

  async getEmailActivity() {
    const response = await api.get('/api/admin/email-activity');
    return response.data;
  },

  async sendContentUpdateAnnouncement() {
    const response = await api.post('/api/admin/content-updates/temario-novedad-2026');
    return response.data;
  },

  async sendRecruitmentEmail(email) {
    const response = await api.post('/api/admin/send-recruitment-email', { email });
    return response.data;
  },

  async uploadAvatar(userId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/api/admin/students/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
