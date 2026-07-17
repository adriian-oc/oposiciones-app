import React, { useState, useEffect, useCallback } from 'react';
import analyticsService from '../services/analyticsService';
import { themeService } from '../services/themeService';

// Reutilizado tanto en el panel de admin como en el de profesor -- el alcance (todos los
// alumnos vs. solo los asignados) lo resuelve el backend según el rol de quien pregunta.
const TopFailuresPanel = () => {
  const [failures, setFailures] = useState([]);
  const [themes, setThemes] = useState([]);
  const [themeFilter, setThemeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analyticsService.getTopFailedQuestions(themeFilter || null, 20);
      setFailures(data);
    } catch (error) {
      console.error('Error loading top failures:', error);
    } finally {
      setLoading(false);
    }
  }, [themeFilter]);

  useEffect(() => {
    themeService.getThemes().then(setThemes).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="top-failures-panel">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Preguntas con más fallos</h2>
        <select
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Todos los temas</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>[{t.part}] {t.code} - {t.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Cargando...</p>
      ) : failures.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Todavía no hay fallos registrados para este filtro.</p>
      ) : (
        <div className="space-y-3">
          {failures.map((f, idx) => (
            <div key={f.question_id} className="border border-gray-200 rounded-lg p-4">
              <div
                className="flex justify-between items-start cursor-pointer"
                onClick={() => setExpandedId(expandedId === f.question_id ? null : f.question_id)}
              >
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">
                    #{idx + 1} · [{f.theme_code}] {f.theme_name}
                  </div>
                  <p className="font-medium text-gray-900">{f.question_text}</p>
                </div>
                <div className="flex flex-col items-end ml-4 flex-shrink-0">
                  <span className="text-lg font-bold text-red-600">{f.failure_count}</span>
                  <span className="text-xs text-gray-500">{f.distinct_students} alumno{f.distinct_students === 1 ? '' : 's'}</span>
                </div>
              </div>
              {expandedId === f.question_id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {f.choices.map((choice, i) => (
                    <div
                      key={i}
                      className={`text-sm px-2 py-1 rounded ${i === f.correct_answer ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-600'}`}
                    >
                      {i === f.correct_answer && '✓ '}{choice}
                    </div>
                  ))}
                  {f.last_failed_at && (
                    <div className="text-xs text-gray-400 pt-1">
                      Último fallo: {new Date(f.last_failed_at).toLocaleString('es-ES')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopFailuresPanel;
