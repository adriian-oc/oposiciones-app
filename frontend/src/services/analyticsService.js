import api from './api';

const analyticsService = {
  // Get failure analytics
  getFailureAnalytics: async (themeId = null, top = 10) => {
    try {
      const params = new URLSearchParams();
      if (themeId) params.append('theme_id', themeId);
      params.append('top', top);
      
      const response = await api.get(`/api/analytics/failures?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Generate study plan
  generateStudyPlan: async (threshold = 70.0, maxThemes = 10) => {
    try {
      const response = await api.get('/api/analytics/study-plan', {
        params: { threshold, max_themes: maxThemes }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get overall statistics
  getOverallStats: async () => {
    try {
      const response = await api.get('/api/analytics/overall-stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Panel de refuerzo (admin/profesor): preguntas más falladas. themeId='' filtra a Supuestos
  // Prácticos (sin tema real); themeId=null/undefined = sin filtro (todos los temas).
  getTopFailedQuestions: async (themeId = null, limit = 20) => {
    try {
      const params = new URLSearchParams();
      if (themeId !== null && themeId !== undefined) params.append('theme_id', themeId);
      params.append('limit', limit);
      const response = await api.get(`/api/analytics/top-failures?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Panel de refuerzo (admin/profesor): nota media + intentos por unidad de contenido
  getPracticeStats: async () => {
    try {
      const response = await api.get('/api/analytics/practice-stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default analyticsService;
