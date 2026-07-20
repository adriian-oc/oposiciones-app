import api from './api';

const TOKEN_KEY = 'token';

export const authService = {
  async login({ email, password }) {
    const response = await api.post('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, response.data.access_token);
    return authService.getCurrentUser();
  },

  async getCurrentUser() {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  async updateOwnProfile(data) {
    const response = await api.patch('/api/auth/me', data);
    return response.data;
  },

  async uploadOwnAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async switchAccount() {
    const response = await api.post('/api/auth/switch');
    localStorage.setItem(TOKEN_KEY, response.data.access_token);
    return authService.getCurrentUser();
  },

  async logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async resetPassword(token, newPassword) {
    await api.post('/api/auth/reset-password', { token, new_password: newPassword });
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
};
