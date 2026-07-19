import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import ViewingBanner from '../components/ViewingBanner';
import { useAuth } from '../context/AuthContext';
import { progressService } from '../services/progressService';
import { adminService } from '../services/adminService';
import { examService } from '../services/examService';
import { notesService } from '../services/notesService';
import practicalSetService from '../services/practicalSetService';

const SUPUESTO_RE = /^Supuesto\s+(\d+)/i;
const CUADERNILLO_PREFIX = 'Cuadernillo';

const statColor = { blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-600', purple: 'text-purple-600' };
const pctColor = (pct) => (pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500');
const scoreColor = (score) => (score >= 12 ? 'bg-green-100 text-green-800' : score >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800');

const StatCard = ({ value, label, color }) => (
  <div className="text-center">
    <div className={`text-3xl font-bold ${statColor[color]}`}>{value}</div>
    <div className="text-sm text-gray-600 mt-1">{label}</div>
  </div>
);

const EXAM_TYPE_LABELS = {
  THEORY_TOPIC: 'Teoría por Tema',
  THEORY_MIXED: 'Teoría Mixta',
  PRACTICAL: 'Supuesto Práctico',
  SIMULACRO: 'Simulacro Completo',
};

// Umbrales por porcentaje, no por valor absoluto -- la puntuación se muestra en escalas
// distintas según el tipo (15 para Supuestos/Cuadernillos, 70/100 para teoría/simulacro), así
// que un score absoluto de 70 no significa lo mismo en todas las filas.
const historyScoreColor = (score, scale) => {
  const pct = scale ? (score / scale) * 100 : score;
  if (pct >= 70) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const formatDateTime = (dateString) =>
  new Date(dateString).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const TABS = [
  ['resumen', '📊 Resumen'],
  ['temas', '📚 Por tema'],
  ['generales', '📋 Supuestos Prácticos'],
  ['notas', '📝 Notas'],
  ['historial', '🗂 Historial'],
];

const Progress = () => {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isOther = !!routeUserId && routeUserId !== user?.id;
  const targetUserId = routeUserId || user?.id;

  const [tab, setTab] = useState(() => searchParams.get('tab') || 'resumen');
  const [loading, setLoading] = useState(true);
  const [viewedUser, setViewedUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [psById, setPsById] = useState({});
  const [cuadernillos, setCuadernillos] = useState([]);
  const [supuestos, setSupuestos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notesSearch, setNotesSearch] = useState('');
  const [examHistory, setExamHistory] = useState([]);
  const [openDetail, setOpenDetail] = useState(null);
  const [detailHistory, setDetailHistory] = useState({}); // content_unit_key -> [{score,total,date}]
  const [startingId, setStartingId] = useState(null);

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const [progressData, practicalSets, historyData] = await Promise.all([
        isOther ? progressService.getProgress(targetUserId) : progressService.getMyProgress(),
        practicalSetService.getAll(0, 100),
        isOther ? examService.getHistoryFor(targetUserId, 50) : examService.getHistory(50),
      ]);
      setProgress(progressData);
      setPsById(Object.fromEntries(practicalSets.map((ps) => [ps.id, ps])));
      setCuadernillos(practicalSets.filter((ps) => ps.title.startsWith(CUADERNILLO_PREFIX)));
      setSupuestos(
        practicalSets
          .filter((ps) => SUPUESTO_RE.test(ps.title))
          .sort((a, b) => parseInt(a.title.match(SUPUESTO_RE)[1], 10) - parseInt(b.title.match(SUPUESTO_RE)[1], 10))
      );
      setExamHistory(historyData.history || []);

      if (isOther) {
        const roster = await adminService.listStudents();
        setViewedUser(roster.find((u) => u.id === targetUserId) || null);
      } else {
        setNotes(await notesService.getAll());
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isOther]);

  useEffect(() => {
    load();
  }, [load]);

  const startPracticalSet = async (practicalSetId) => {
    setStartingId(practicalSetId);
    try {
      const attempt = await examService.startPractice(practicalSetId);
      navigate(`/exams/take/${attempt.id}`);
    } catch (error) {
      alert('Error al iniciar la práctica: ' + (error.response?.data?.detail || error.message));
    } finally {
      setStartingId(null);
    }
  };

  const toggleDetail = async (key) => {
    if (openDetail === key) {
      setOpenDetail(null);
      return;
    }
    setOpenDetail(key);
    if (!detailHistory[key]) {
      const h = await progressService.getPracticeHistory(targetUserId, key);
      setDetailHistory((prev) => ({ ...prev, [key]: h }));
    }
  };

  const renderDetail = (key, label) => {
    const hist = detailHistory[key];
    if (!hist) return <div className="text-xs text-gray-400 mt-2">Cargando...</div>;
    if (hist.length === 0) return <div className="text-xs text-gray-400 mt-2">Todavía no se ha practicado.</div>;
    return (
      <div className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-md p-2">
        <strong>{label}</strong> · Intentos:{' '}
        {hist.map((h, i) => (
          <span key={i}>
            {i > 0 && ' · '}#{i + 1}: {h.score}/{h.total} ({new Date(h.date).toLocaleDateString('es-ES')})
          </span>
        ))}
      </div>
    );
  };

  if (loading || !progress) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  const summary = progress.summary || { answered: 0, correct: 0, wrong: 0, pct: 0 };
  const weakSpots = Object.entries(progress.content_scores || {})
    .map(([key, score]) => ({ key, label: psById[key]?.title || key, pct: score.pct }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);
  const filteredNotes = notes.filter(
    (n) => (n.text || '').toLowerCase().includes(notesSearch.toLowerCase()) || (n.label || '').toLowerCase().includes(notesSearch.toLowerCase())
  );
  const tabs = TABS.filter(([key]) => key !== 'notas' || !isOther);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {isOther && <ViewingBanner label={viewedUser?.email || targetUserId} onExit={() => navigate('/admin')} />}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">📊 Mi Progreso</h1>

        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                tab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatCard value={summary.answered} label="Preguntas respondidas" color="blue" />
                <StatCard value={summary.correct} label="Aciertos totales" color="green" />
                <StatCard value={summary.wrong} label="Fallos totales" color="red" />
                <StatCard value={`${summary.pct}%`} label="Porcentaje aciertos" color="purple" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">🎯 Recomendado repasar</h2>
              <p className="text-sm text-gray-500 mb-4">Los peores resultados hasta ahora</p>
              {weakSpots.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  {isOther ? 'Este alumno todavía no ha practicado nada.' : 'Todavía no has practicado nada.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {weakSpots.map((w, i) => {
                    const pColor = w.pct >= 70 ? 'text-green-600' : w.pct >= 50 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <div key={w.key} className="flex items-center gap-3 border border-gray-100 rounded-md px-3 py-2">
                        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                          {i + 1}
                        </div>
                        <div className="flex-1 text-sm text-gray-800">{w.label}</div>
                        <div className={`text-sm font-semibold ${pColor}`}>{w.pct}%</div>
                        {!isOther && (
                          <button
                            onClick={() => startPracticalSet(w.key)}
                            disabled={startingId === w.key}
                            className="text-xs px-3 py-1 bg-red-50 text-red-700 rounded-md hover:bg-red-100 disabled:opacity-50"
                          >
                            {startingId === w.key ? 'Iniciando...' : 'Repasar'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'temas' && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">📊 Resultados por tema</h2>
            <p className="text-sm text-gray-500 mb-4">Cuadernillos de Ejercicios · Haz clic para ver tu evolución</p>
            {cuadernillos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Todavía no hay cuadernillos disponibles.</p>
            ) : (
              <div className="space-y-2">
                {cuadernillos.map((ps) => {
                  const score = progress.content_scores?.[ps.id];
                  const pct = score ? score.pct : 0;
                  return (
                    <div key={ps.id}>
                      <button onClick={() => toggleDetail(ps.id)} className="w-full flex items-center gap-3 text-left">
                        <span className="w-56 truncate text-sm text-gray-800" title={ps.title}>{ps.title}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          {score && <div className={`h-full ${pctColor(pct)}`} style={{ width: `${pct}%` }} />}
                        </div>
                        <span className="w-12 text-right text-xs text-gray-600">{score ? `${pct}%` : '—'}</span>
                      </button>
                      {openDetail === ps.id && renderDetail(ps.id, ps.title)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'generales' && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">📋 Supuestos Prácticos</h2>
            <p className="text-sm text-gray-500 mb-4">Puntuación sobre 15 · Haz clic en un supuesto para ver tu historial</p>
            {supuestos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Todavía no hay supuestos disponibles.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {supuestos.map((ps) => {
                    const score = progress.content_scores?.[ps.id];
                    const displayScore = score ? Math.round((score.pct / 100) * 15) : null;
                    return (
                      <button
                        key={ps.id}
                        onClick={() => toggleDetail(ps.id)}
                        className={`rounded-md p-2 text-center ${displayScore !== null ? scoreColor(displayScore) : 'bg-gray-100 text-gray-400'}`}
                        title={ps.title}
                      >
                        <div className="text-[10px] opacity-70">{ps.title.replace('Supuesto ', 'Sup ')}</div>
                        <div className="text-sm font-semibold">{displayScore !== null ? displayScore : '—'}</div>
                      </button>
                    );
                  })}
                </div>
                {openDetail && supuestos.some((s) => s.id === openDetail) && renderDetail(openDetail, supuestos.find((s) => s.id === openDetail).title)}
              </>
            )}
          </div>
        )}

        {tab === 'notas' && !isOther && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">📝 Notas de Estudio</h2>
            <p className="text-sm text-gray-500 mb-4">Tus apuntes guardados durante la práctica</p>
            <input
              type="text"
              value={notesSearch}
              onChange={(e) => setNotesSearch(e.target.value)}
              placeholder="🔍 Buscar en notas..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4"
            />
            {filteredNotes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay notas guardadas.</p>
            ) : (
              <div className="space-y-3">
                {filteredNotes.map((n) => (
                  <div key={`${n.content_unit_key}-${n.case_index}`} className="border border-gray-100 rounded-md p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-800">{n.label}</span>
                      <span className="text-xs text-gray-400">{new Date(n.updated_at).toLocaleDateString('es-ES')}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'historial' && (
          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            {examHistory.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900">No hay exámenes realizados</h3>
                {!isOther && (
                  <Link to="/cuadernos" className="mt-4 inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    Ir a Cuadernos
                  </Link>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Examen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Puntuación</th>
                    {!isOther && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {examHistory.map((attempt) => (
                    <tr key={attempt.attempt_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{attempt.exam_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {EXAM_TYPE_LABELS[attempt.exam_type] || attempt.exam_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDateTime(attempt.started_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {attempt.is_completed ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Completado</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">En progreso</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {attempt.is_completed && attempt.score !== null ? (
                          <span className={`text-sm font-bold ${historyScoreColor(attempt.score, attempt.scale)}`}>
                            {attempt.score.toFixed(2)}{attempt.scale ? ` / ${attempt.scale}` : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      {!isOther && (
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          {attempt.is_completed ? (
                            <Link to={`/exams/results/${attempt.attempt_id}`} className="text-primary-600 hover:text-primary-900">Ver Resultados</Link>
                          ) : (
                            <Link to={`/exams/take/${attempt.attempt_id}`} className="text-green-600 hover:text-green-900">Continuar</Link>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Progress;
