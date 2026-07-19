import api from './api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const documentService = {
  async submit(areaId, themeId, file) {
    const formData = new FormData();
    formData.append('area_id', areaId);
    formData.append('theme_id', themeId);
    formData.append('file', file);
    const response = await api.post('/api/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async listPending() {
    const response = await api.get('/api/documents/pending');
    return response.data;
  },

  async listMine() {
    const response = await api.get('/api/documents/mine');
    return response.data;
  },

  async getApprovedMine() {
    const response = await api.get('/api/documents/approved-mine');
    return response.data;
  },

  async review(docId, newStatus) {
    const response = await api.patch(`/api/documents/${docId}`, { status: newStatus });
    return response.data;
  },

  // file_path se guarda relativo ("documents/<uuid>.pdf"), servido desde /uploads -- ver
  // StaticFiles mount en backend/server.py (solo desarrollo, ver nota en el servicio backend).
  fileUrl(doc) {
    return `${API_BASE_URL}/uploads/${doc.file_path}`;
  },
};

export default documentService;
