import api from './api';

export const accessRequestService = {
  async create(data) {
    // Público: no requiere sesión, así que se llama a la API directamente (sin el interceptor
    // de auth, que no rompe nada si no hay usuario, simplemente no añade Authorization).
    const response = await api.post('/api/access-requests/', data);
    return response.data;
  },

  async list() {
    const response = await api.get('/api/access-requests/');
    return response.data;
  },

  async updateStatus(id, statusValue) {
    const response = await api.patch(`/api/access-requests/${id}`, { status: statusValue });
    return response.data;
  },

  async convert(id, displayName) {
    const response = await api.post(`/api/access-requests/${id}/convert`, { display_name: displayName });
    return response.data;
  },
};
