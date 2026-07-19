import React, { useState, useEffect, useCallback } from 'react';
import analyticsService from '../services/analyticsService';
import { loadContentAreaUnits } from '../utils/contentAccessUnits';

// Clave con la que se agrupan los intentos en el backend (get_practice_stats_by_content_unit):
// para gen/cuad es el id crudo del practical_set (ver ExamService.start_practice); para
// ttesp/ttgen es '<area_id>:<theme_id>' (ver ExamService.start_theory_practice) -- distinto del
// unit.key de contentAccessUnits.js, que siempre usa el formato con prefijo de área.
const statsKeyFor = (area, unit) => {
  if (area.id === 'gen' || area.id === 'cuad') return unit.practicalSet?.id;
  if (area.id === 'ttesp' || area.id === 'ttgen') return unit.key;
  return null;
};

// Reutilizado tanto en el panel de admin como en el de profesor -- el alcance (todos los
// alumnos vs. solo los asignados) lo resuelve el backend según el rol de quien pregunta.
const TopFailuresPanel = () => {
  const [areas, setAreas] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [openAreas, setOpenAreas] = useState(() => new Set());
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [failuresByUnit, setFailuresByUnit] = useState({});
  const [failuresLoading, setFailuresLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ areas: loadedAreas }, practiceStats] = await Promise.all([
        loadContentAreaUnits(),
        analyticsService.getPracticeStats(),
      ]);
      setAreas(loadedAreas);
      setStats(practiceStats);
    } catch (error) {
      console.error('Error loading practice stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleArea = (areaId) => {
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const toggleUnit = async (area, unit) => {
    const unitKey = unit.key;
    if (expandedUnit === unitKey) {
      setExpandedUnit(null);
      return;
    }
    setExpandedUnit(unitKey);
    if (!failuresByUnit[unitKey]) {
      setFailuresLoading(true);
      try {
        const themeId = area.id === 'gen' ? '' : unit.theme?.id;
        const data = await analyticsService.getTopFailedQuestions(themeId, 20);
        setFailuresByUnit((prev) => ({ ...prev, [unitKey]: data }));
      } catch (error) {
        console.error('Error loading failures:', error);
      } finally {
        setFailuresLoading(false);
      }
    }
  };

  if (loading) {
    return <p className="text-center text-gray-500 py-8">Cargando...</p>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="top-failures-panel">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Refuerzo</h2>
      <p className="text-sm text-gray-500 mb-4">
        Nota media y nº de intentos de tus alumnos por unidad. Haz clic en un tema para ver sus preguntas más falladas.
      </p>

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {areas.map(({ area, units }) => {
          const isAreaOpen = openAreas.has(area.id);
          return (
            <div key={area.id}>
              <button
                type="button"
                onClick={() => toggleArea(area.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <span>{area.label}</span>
                <span className="text-gray-400">{isAreaOpen ? '▲' : '▼'}</span>
              </button>
              {isAreaOpen && (
                <div className="pb-2">
                  {units.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-400">Sin unidades en esta área.</p>
                  )}
                  {units.map((unit) => {
                    const statsKey = statsKeyFor(area, unit);
                    const unitStats = statsKey ? stats[statsKey] : null;
                    const isExpanded = expandedUnit === unit.key;
                    const failures = failuresByUnit[unit.key];
                    return (
                      <div key={unit.key} className="border-t border-gray-50 first:border-t-0">
                        <button
                          type="button"
                          onClick={() => toggleUnit(area, unit)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="text-sm text-gray-800 truncate">{unit.label}</span>
                          <span className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                            {unitStats ? (
                              <>
                                <span className="font-medium text-gray-700">
                                  {unitStats.avg_score != null ? `${unitStats.avg_score.toFixed(2)} / ${unitStats.scale || '?'}` : 'Sin nota'}
                                </span>
                                <span>{unitStats.attempts_count} intento{unitStats.attempts_count === 1 ? '' : 's'}</span>
                                <span>{unitStats.distinct_students} alumno{unitStats.distinct_students === 1 ? '' : 's'}</span>
                              </>
                            ) : (
                              <span className="text-gray-300">Sin intentos</span>
                            )}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3">
                            {failuresLoading && !failures ? (
                              <p className="text-xs text-gray-400 py-2">Cargando fallos...</p>
                            ) : !failures || failures.length === 0 ? (
                              <p className="text-xs text-gray-400 py-2">Todavía no hay fallos registrados aquí.</p>
                            ) : (
                              <div className="space-y-2 mt-2">
                                {failures.map((f, idx) => (
                                  <div key={f.question_id} className="border border-gray-100 rounded-md p-3">
                                    <div className="flex justify-between items-start gap-3">
                                      <p className="text-sm text-gray-900 flex-1">
                                        <span className="text-gray-400">#{idx + 1}</span> {f.question_text}
                                      </p>
                                      <div className="flex flex-col items-end flex-shrink-0">
                                        <span className="text-sm font-bold text-red-600">{f.failure_count}</span>
                                        <span className="text-[10px] text-gray-400">
                                          {f.distinct_students} alumno{f.distinct_students === 1 ? '' : 's'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      {f.choices.map((choice, i) => (
                                        <div
                                          key={i}
                                          className={`text-xs px-2 py-1 rounded ${i === f.correct_answer ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-500'}`}
                                        >
                                          {i === f.correct_answer && '✓ '}{choice}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopFailuresPanel;
