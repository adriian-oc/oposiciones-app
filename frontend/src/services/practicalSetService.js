import api from './api';

const practicalSetService = {
  // Get all practical sets
  getAll: async (skip = 0, limit = 50) => {
    try {
      const response = await api.get('/api/practical-sets/', {
        params: { skip, limit }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get practical set by ID
  getById: async (id) => {
    try {
      const response = await api.get(`/api/practical-sets/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get random practical set
  getRandom: async () => {
    try {
      const response = await api.get('/api/practical-sets/random/one');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create practical set (admin/curator only)
  create: async (practicalSetData) => {
    try {
      const response = await api.post('/api/practical-sets/', practicalSetData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Delete practical set
  delete: async (id) => {
    try {
      const response = await api.delete(`/api/practical-sets/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Editar/añadir/borrar una pregunta embebida (árbol de Gestionar Preguntas, ronda 5)
  updateQuestion: async (practicalSetId, questionId, data) => {
    try {
      const response = await api.put(`/api/practical-sets/${practicalSetId}/questions/${questionId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  addQuestion: async (practicalSetId, data) => {
    try {
      const response = await api.post(`/api/practical-sets/${practicalSetId}/questions`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  deleteQuestion: async (practicalSetId, questionId) => {
    try {
      const response = await api.delete(`/api/practical-sets/${practicalSetId}/questions/${questionId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

export default practicalSetService;
