import api from './api';

export const contentUnitService = {
  async getByArea(areaId) {
    const response = await api.get('/api/content-units/', { params: { area_id: areaId } });
    return response.data;
  },
};
