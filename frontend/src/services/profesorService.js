import api from './api';

export const profesorService = {
  async listMyStudents() {
    const response = await api.get('/api/profesor/students');
    return response.data;
  },
};
