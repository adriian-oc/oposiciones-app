import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { themeService } from '../services/themeService';
import { examService } from '../services/examService';

const ExamGenerator = () => {
  const navigate = useNavigate();
  const [themes, setThemes] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'THEORY_TOPIC',
    theme_ids: [],
    question_count: 10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      const data = await themeService.getThemes();
      setThemes(data);
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  };

  const handleThemeToggle = (themeId) => {
    const newThemeIds = formData.theme_ids.includes(themeId)
      ? formData.theme_ids.filter((id) => id !== themeId)
      : [...formData.theme_ids, themeId];
    
    setFormData({ ...formData, theme_ids: newThemeIds });
  };

  const handleSelectAllGeneral = () => {
    const generalIds = themes.filter((t) => t.part === 'GENERAL').map((t) => t.id);
    setFormData({ ...formData, theme_ids: generalIds });
  };

  const handleSelectAllSpecific = () => {
    const specificIds = themes.filter((t) => t.part === 'SPECIFIC').map((t) => t.id);
    setFormData({ ...formData, theme_ids: specificIds });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.theme_ids.length === 0) {
      setError('Selecciona al menos un tema');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const exam = await examService.generateExam(formData);
      // Start attempt immediately
      const attempt = await examService.startAttempt(exam.id);
      navigate(`/exams/take/${attempt.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al generar examen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="exam-generator-heading">Generar Examen</h1>
          <p className="mt-2 text-gray-600">Configura tu examen personalizado</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6" data-testid="exam-generator-form">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded" data-testid="error-message">
              {error}
            </div>
          )}

          {/* Exam Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del examen</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Examen Temas 1-5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              data-testid="exam-name-input"
            />
          </div>

          {/* Exam Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de examen</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              data-testid="exam-type-select"
            >
              <option value="THEORY_TOPIC">Teoría por tema</option>
              <option value="THEORY_MIXED">Teoría mixta</option>
            </select>
          </div>

          {/* Question Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de preguntas: {formData.question_count}
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={formData.question_count}
              onChange={(e) => setFormData({ ...formData, question_count: parseInt(e.target.value) })}
              className="w-full"
              data-testid="question-count-slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          {/* Theme Selection */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Seleccionar temas ({formData.theme_ids.length} seleccionados)
              </label>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllGeneral}
                  className="text-sm text-primary-600 hover:text-primary-700 underline"
                  data-testid="select-all-general"
                >
                  Todos Generales
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllSpecific}
                  className="text-sm text-primary-600 hover:text-primary-700 underline"
                  data-testid="select-all-specific"
                >
                  Todos Específicos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {themes.map((theme) => (
                <label
                  key={theme.id}
                  className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.theme_ids.includes(theme.id)
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}
                  data-testid={`theme-checkbox-${theme.code}`}
                >
                  <input
                    type="checkbox"
                    checked={formData.theme_ids.includes(theme.id)}
                    onChange={() => handleThemeToggle(theme.id)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                        theme.part === 'GENERAL' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {theme.code}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mt-1">{theme.name}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="generate-exam-button"
            >
              {loading ? 'Generando examen...' : 'Generar y Comenzar Examen'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default ExamGenerator;
