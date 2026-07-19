import api from './api';

export const studyCalendarService = {
  async getPreferences() {
    const response = await api.get('/api/study-calendar/preferences');
    return response.data;
  },

  async setPreferences(hoursPerDay) {
    const response = await api.put('/api/study-calendar/preferences', { hours_per_day: hoursPerDay });
    return response.data;
  },

  async getCalendar(days = 14) {
    const response = await api.get(`/api/study-calendar/?days=${days}`);
    return response.data;
  },

  async getCalendarFor(userId, days = 14) {
    const response = await api.get(`/api/study-calendar/${userId}`, { params: { days } });
    return response.data;
  },

  async completeEntry(entryId) {
    const response = await api.post(`/api/study-calendar/entries/${entryId}/complete`);
    return response.data;
  },

  async regenerate() {
    const response = await api.post('/api/study-calendar/regenerate');
    return response.data;
  },

  async getPreferencesFor(userId) {
    const response = await api.get(`/api/study-calendar/${userId}/preferences`);
    return response.data;
  },

  async setPreferencesFor(userId, hoursPerDay) {
    const response = await api.put(`/api/study-calendar/${userId}/preferences`, { hours_per_day: hoursPerDay });
    return response.data;
  },

  async completeEntryFor(userId, entryId) {
    const response = await api.post(`/api/study-calendar/${userId}/entries/${entryId}/complete`);
    return response.data;
  },
};
