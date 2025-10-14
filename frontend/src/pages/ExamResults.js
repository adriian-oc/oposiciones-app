import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { examService } from '../services/examService';

const ExamResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [attemptId]);

  const loadResults = async () => {
    try {
      const data = await examService.getAttemptResults(attemptId);
      setAttempt(data);
    } catch (error) {
      console.error('Error loading results:', error);
      alert('Error al cargar los resultados');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando resultados...</div>
      </Layout>
    );
  }

  if (!attempt || !attempt.details) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Error: No se pudieron cargar los resultados</p>
        </div>
      </Layout>
    );
  }

  const { details } = attempt;
  const scorePercentage = (details.final_score / 70) * 100;
  const isPassed = scorePercentage >= 50; // Assuming 50% is pass threshold

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6 text-center" data-testid="results-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Resultados del Examen</h1>
          
          {/* Score */}
          <div className="mb-6">
            <div className={`text-6xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`} data-testid="final-score">
              {details.final_score.toFixed(2)} / 70
            </div>
            <div className="text-2xl text-gray-600 mt-2">
              {scorePercentage.toFixed(1)}%
            </div>
          </div>

          {/* Pass/Fail Badge */}
          <div className="mb-6">
            <span
              className={`inline-block px-6 py-2 rounded-full text-lg font-semibold ${
                isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
              data-testid="pass-fail-badge"
            >
              {isPassed ? '✓ Aprobado' : '✗ No Aprobado'}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600" data-testid="correct-count">{details.correct}</div>
              <div className="text-sm text-gray-600">Correctas</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-600" data-testid="incorrect-count">{details.incorrect}</div>
              <div className="text-sm text-gray-600">Incorrectas</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-600" data-testid="unanswered-count">{details.unanswered}</div>
              <div className="text-sm text-gray-600">Sin responder</div>
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalle de Respuestas</h2>
          
          <div className="space-y-4">
            {details.results.map((result, index) => (
              <div
                key={index}
                className={`border-l-4 p-4 rounded-r-lg ${
                  result.status === 'correct'
                    ? 'border-green-500 bg-green-50'
                    : result.status === 'incorrect'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-400 bg-gray-50'
                }`}
                data-testid={`result-item-${index}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Pregunta {index + 1}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      result.status === 'correct'
                        ? 'bg-green-200 text-green-800'
                        : result.status === 'incorrect'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {result.status === 'correct' ? 'Correcta' : result.status === 'incorrect' ? 'Incorrecta' : 'Sin responder'}
                  </span>
                </div>
                
                <p className="text-gray-900 mb-2">{result.question_text}</p>
                
                {result.selected_answer !== null && result.selected_answer !== undefined && (
                  <div className="text-sm">
                    <div className={`${result.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                      Tu respuesta: Opción {result.selected_answer + 1}
                    </div>
                    {!result.is_correct && (
                      <div className="text-green-700">
                        Respuesta correcta: Opción {result.correct_answer + 1}
                      </div>
                    )}
                  </div>
                )}
                
                {(result.selected_answer === null || result.selected_answer === undefined) && (
                  <div className="text-sm text-gray-600">
                    No respondida (Respuesta correcta: Opción {result.correct_answer + 1})
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => navigate('/exams/new')}
            className="px-6 py-3 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
            data-testid="new-exam-button"
          >
            Nuevo Examen
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300"
            data-testid="back-home-button"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default ExamResults;
