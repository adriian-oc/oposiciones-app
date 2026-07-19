import api from './api';

export const notesService = {
  async getAll() {
    const response = await api.get('/api/notes/');
    return response.data;
  },

  async getOne(contentUnitKey, caseIndex) {
    const response = await api.get(`/api/notes/${contentUnitKey}/${caseIndex}`);
    return response.data;
  },

  async save(contentUnitKey, caseIndex, text, label) {
    const response = await api.put(`/api/notes/${contentUnitKey}/${caseIndex}`, { text, label });
    return response.data;
  },
};
