import api from './api';

export const examService = {
  async generateExam(examData) {
    const response = await api.post('/api/exams/generate', examData);
    return response.data;
  },

  async getExam(examId) {
    const response = await api.get(`/api/exams/${examId}`);
    return response.data;
  },

  async startAttempt(examId, liveCorrection = false) {
    const response = await api.post('/api/exams/start', { exam_id: examId, live_correction: liveCorrection });
    return response.data;
  },

  async startPractice(practicalSetId, liveCorrection = false) {
    const response = await api.post(`/api/exams/practice/${practicalSetId}/start`, null, {
      params: { live_correction: liveCorrection },
    });
    return response.data;
  },

  async startTheoryPractice(areaId, themeId, liveCorrection = false) {
    const response = await api.post(`/api/exams/theory/${areaId}/${themeId}/start`, null, {
      params: { live_correction: liveCorrection },
    });
    return response.data;
  },

  async submitAnswer(attemptId, questionId, selectedAnswer) {
    const response = await api.post(`/api/exams/attempts/${attemptId}/answer`, {
      question_id: questionId,
      selected_answer: selectedAnswer,
    });
    return response.data;
  },

  async finishAttempt(attemptId) {
    const response = await api.post(`/api/exams/attempts/${attemptId}/finish`);
    return response.data;
  },

  async getAttemptResults(attemptId) {
    const response = await api.get(`/api/exams/attempts/${attemptId}/results`);
    return response.data;
  },

  async getAttemptProgress(attemptId) {
    const response = await api.get(`/api/exams/attempts/${attemptId}/progress`);
    return response.data;
  },

  async retryFailures(attemptId) {
    const response = await api.post(`/api/exams/attempts/${attemptId}/retry-failures`);
    return response.data;
  },

  async getHistory(limit = 50) {
    const response = await api.get(`/api/exams/history?limit=${limit}`);
    return response.data;
  },

  async getHistoryFor(userId, limit = 50) {
    const response = await api.get(`/api/exams/history/${userId}?limit=${limit}`);
    return response.data;
  },
};
