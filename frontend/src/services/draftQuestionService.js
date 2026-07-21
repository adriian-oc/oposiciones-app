import api from './api';

export const draftQuestionService = {
  async list(themeId) {
    const response = await api.get('/api/draft-questions/', { params: themeId ? { theme_id: themeId } : {} });
    return response.data;
  },

  async create(data) {
    const response = await api.post('/api/draft-questions/', data);
    return response.data;
  },

  async update(draftId, data) {
    const response = await api.patch(`/api/draft-questions/${draftId}`, data);
    return response.data;
  },

  async remove(draftId) {
    await api.delete(`/api/draft-questions/${draftId}`);
  },

  async publish({ questionIds, themeId, target, title, description }) {
    const response = await api.post('/api/draft-questions/publish', {
      question_ids: questionIds,
      theme_id: themeId,
      target,
      title,
      description,
    });
    return response.data;
  },
};
