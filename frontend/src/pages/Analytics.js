import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import analyticsService from '../services/analyticsService';

const Analytics = () => {
  const [studyPlan, setStudyPlan] = useState(null);
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [failuresData, studyPlanData] = await Promise.all([
        analyticsService.getFailureAnalytics(null, 15),
        analyticsService.generateStudyPlan(70, 10)
      ]);
      setFailures(failuresData);
      setStudyPlan(studyPlanData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateStudyPlan = async () => {
    try {
      setGenerating(true);
      const data = await analyticsService.generateStudyPlan(70, 10);
      setStudyPlan(data);
    } catch (error) {
      console.error('Error generating study plan:', error);
    } finally {
      setGenerating(false);
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 80) return 'bg-green-100 text-green-800';
    if (accuracy >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPriorityColor = (priority) => {
    if (priority === 1) return 'bg-red-100 text-red-800';
    if (priority <= 3) return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Cargando analíticas...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="analytics-heading">
            Analítica de Rendimiento
          </h1>
          <p className="mt-2 text-gray-600">
            Identifica tus áreas débiles y mejora tu preparación
          </p>
        </div>

        {/* Study Plan */}
        {studyPlan && studyPlan.weak_themes.length > 0 ? (
          <div className="bg-white rounded-lg shadow p-6" data-testid="study-plan-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Plan de Estudio Personalizado
              </h2>
              <button
                onClick={regenerateStudyPlan}
                disabled={generating}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                data-testid="regenerate-plan-button"
              >
                {generating ? 'Generando...' : 'Regenerar Plan'}
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Basado en tu rendimiento, te recomendamos enfocarte en estos {studyPlan.total_weak_areas} temas:
            </p>

            <div className="space-y-3">
              {studyPlan.weak_themes.map((theme) => (
                <div
                  key={theme.theme_id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                  data-testid={`study-plan-item-${theme.theme_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(theme.priority)}`}>
                          Prioridad {theme.priority}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {theme.theme_code}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">{theme.theme_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                          Precisión: <span className="font-medium">{theme.accuracy_rate.toFixed(1)}%</span>
                        </span>
                        <span>
                          Errores: <span className="font-medium">{theme.failure_count}</span>
                        </span>
                        <span className="text-blue-600 font-medium">
                          Practicar: {theme.recommended_practice_count} preguntas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <svg className="h-8 w-8 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-green-900">¡Excelente trabajo!</h3>
                <p className="text-green-700">No tienes áreas débiles significativas. Sigue practicando para mantener tu nivel.</p>
              </div>
            </div>
          </div>
        )}

        {/* Failure Analytics */}
        {failures.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="failure-analytics-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Estadísticas Detalladas por Tema
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tema
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Precisión
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Errores
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Total Intentos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {failures.map((failure) => (
                    <tr key={failure.theme_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{failure.theme_name}</div>
                          <div className="text-xs text-gray-500">{failure.theme_code}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAccuracyColor(failure.accuracy_rate)}`}>
                          {failure.accuracy_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-red-600">{failure.failure_count}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">{failure.total_attempts}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-blue-900">¿Listo para practicar?</h3>
              <p className="text-blue-700 mt-1">Crea un examen enfocado en tus áreas de mejora</p>
            </div>
            <Link
              to="/exams/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              data-testid="create-focused-exam-button"
            >
              Crear Examen
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
