import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { examService } from '../services/examService';

const ExamHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await examService.getHistory(50);
      setHistory(data.history || []);
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Error al cargar el historial de exámenes');
    } finally {
      setLoading(false);
    }
  };

  const getExamTypeLabel = (type) => {
    const labels = {
      'THEORY_TOPIC': 'Teoría por Tema',
      'THEORY_MIXED': 'Teoría Mixta',
      'PRACTICAL': 'Supuesto Práctico',
      'SIMULACRO': 'Simulacro Completo'
    };
    return labels[type] || type;
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Cargando historial...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="history-heading">
            Historial de Exámenes
          </h1>
          <Link
            to="/exams/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            data-testid="new-exam-button"
          >
            Nuevo Examen
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {history.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No hay exámenes realizados</h3>
            <p className="mt-2 text-gray-600">Comienza creando tu primer examen</p>
            <Link
              to="/exams/new"
              className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              data-testid="start-first-exam-button"
            >
              Crear Primer Examen
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre del Examen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Puntuación
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((attempt) => (
                  <tr key={attempt.attempt_id} className="hover:bg-gray-50" data-testid={`exam-row-${attempt.attempt_id}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{attempt.exam_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {getExamTypeLabel(attempt.exam_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(attempt.started_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {attempt.is_completed ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Completado
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          En progreso
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {attempt.is_completed && attempt.score !== null ? (
                        <span className={`text-lg font-bold ${getScoreColor(attempt.score)}`}>
                          {attempt.score.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {attempt.is_completed ? (
                        <Link
                          to={`/exams/results/${attempt.attempt_id}`}
                          className="text-blue-600 hover:text-blue-900"
                          data-testid={`view-results-${attempt.attempt_id}`}
                        >
                          Ver Resultados
                        </Link>
                      ) : (
                        <Link
                          to={`/exams/take/${attempt.attempt_id}`}
                          className="text-green-600 hover:text-green-900"
                          data-testid={`continue-exam-${attempt.attempt_id}`}
                        >
                          Continuar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ExamHistory;
