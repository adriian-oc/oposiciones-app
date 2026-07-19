import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { examService } from '../services/examService';

const AttemptProgress = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const progress = await examService.getAttemptProgress(attemptId);
      setData(progress);
    } catch (error) {
      console.error('Error loading attempt progress:', error);
      alert('Error al cargar el progreso del intento');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Error: no se pudo cargar el intento</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.exam.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Intento todavía en progreso — así vas hasta ahora</p>
            </div>
            <Link
              to={`/exams/take/${attemptId}`}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
            >
              Continuar examen
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-700">{data.answered}/{data.total_questions}</div>
              <div className="text-xs text-gray-500">Respondidas</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{data.correct}</div>
              <div className="text-xs text-gray-500">Correctas</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{data.incorrect}</div>
              <div className="text-xs text-gray-500">Fallos</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-500">{data.unanswered}</div>
              <div className="text-xs text-gray-500">Sin responder</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalle</h2>
          <div className="space-y-3">
            {data.results.map((r, index) => (
              <div
                key={r.question_id}
                className={`border-l-4 p-4 rounded-r-lg ${
                  !r.answered ? 'border-gray-300 bg-gray-50' : r.is_correct ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Pregunta {index + 1}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      !r.answered
                        ? 'bg-gray-200 text-gray-700'
                        : r.is_correct
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {!r.answered ? 'Todavía sin responder' : r.is_correct ? 'Correcta' : 'Incorrecta'}
                  </span>
                </div>
                <p className="text-gray-900">{r.question_text}</p>
                {r.answered && !r.is_correct && Array.isArray(r.choices) && r.choices.length > 0 && (
                  <p className="text-sm text-green-700 mt-2">
                    Respuesta correcta: {r.choices[r.correct_answer]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Link
            to={`/exams/take/${attemptId}`}
            className="px-6 py-3 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
          >
            Continuar examen
          </Link>
          <button
            onClick={() => navigate('/progreso?tab=historial')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300"
          >
            Volver a Mi Progreso
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default AttemptProgress;
