import React, { useState, useEffect, useCallback } from 'react';
import { draftQuestionService } from '../services/draftQuestionService';
import { themeService } from '../services/themeService';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const emptyEdit = (draft) => ({
  text: draft.text,
  choices: [...draft.choices],
  correct_answer: draft.correct_answer,
});

// Repositorio de preguntas generadas pero SIN publicar (p.ej. tras una novedad de temario) --
// admin y profesor las revisan/editan aquí y eligen lanzarlas como Cuadernillo (se añaden al
// cuadernillo ya existente del tema si lo hay) o como Supuesto nuevo (siempre standalone). Se usa
// tanto desde Admin.js como desde ProfesorDashboard.js -- por eso no asume ningún rol concreto.
const DraftQuestionsBank = () => {
  const [drafts, setDrafts] = useState([]);
  const [themeNames, setThemeNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [publishingTheme, setPublishingTheme] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [draftsData, specific, general] = await Promise.all([
        draftQuestionService.list(),
        themeService.getThemes('SPECIFIC'),
        themeService.getThemes('GENERAL'),
      ]);
      setDrafts(draftsData);
      const names = {};
      [...specific, ...general].forEach((t) => { names[t.id] = t.name; });
      setThemeNames(names);
    } catch (err) {
      console.error('Error loading draft questions:', err);
      setError('No se pudieron cargar las preguntas borrador.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (draft) => {
    setEditingId(draft.id);
    setEditForm(emptyEdit(draft));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (draftId) => {
    try {
      await draftQuestionService.update(draftId, editForm);
      cancelEdit();
      load();
    } catch (err) {
      alert('Error al guardar: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (draft) => {
    if (!window.confirm(`¿Descartar esta pregunta borrador?\n\n"${draft.text}"`)) return;
    try {
      await draftQuestionService.remove(draft.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(draft.id);
        return next;
      });
      load();
    } catch (err) {
      alert('Error al descartar: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handlePublish = async (themeId, target, ids) => {
    const label = target === 'cuadernillo' ? 'Cuadernillo' : 'Supuesto';
    if (!window.confirm(`¿Publicar ${ids.length} pregunta(s) seleccionada(s) como ${label}?`)) return;
    setPublishingTheme(themeId);
    try {
      const result = await draftQuestionService.publish({ questionIds: ids, themeId, target });
      if (target === 'cuadernillo') {
        alert(
          result.created_new
            ? `Cuadernillo nuevo creado con ${result.question_count} preguntas.`
            : `Se han añadido ${result.question_count} preguntas al Cuadernillo ya existente de este tema.`
        );
      } else {
        alert(`Supuesto nuevo creado con ${result.question_count} preguntas.`);
      }
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      load();
    } catch (err) {
      alert('Error al publicar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setPublishingTheme(null);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Cargando preguntas borrador...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (drafts.length === 0) {
    return <p className="text-sm text-gray-500">No hay preguntas sin publicar por ahora.</p>;
  }

  const grouped = {};
  drafts.forEach((d) => {
    if (!grouped[d.theme_id]) grouped[d.theme_id] = [];
    grouped[d.theme_id].push(d);
  });

  return (
    <div className="space-y-6" data-testid="draft-questions-bank">
      {Object.entries(grouped).map(([themeId, items]) => {
        const selectedIds = items.filter((d) => selected.has(d.id)).map((d) => d.id);
        return (
          <div key={themeId} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">
                {themeNames[themeId] || themeId} <span className="text-gray-400 font-normal">({items.length})</span>
              </h3>
              <div className="flex gap-2">
                <button
                  disabled={selectedIds.length === 0 || publishingTheme === themeId}
                  onClick={() => handlePublish(themeId, 'cuadernillo', selectedIds)}
                  className="px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-40"
                >
                  📗 Publicar como Cuadernillo ({selectedIds.length})
                </button>
                <button
                  disabled={selectedIds.length === 0 || publishingTheme === themeId}
                  onClick={() => handlePublish(themeId, 'supuesto', selectedIds)}
                  className="px-3 py-1.5 text-xs font-semibold bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-40"
                >
                  📋 Publicar como Supuesto nuevo ({selectedIds.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((draft) => (
                <div key={draft.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(draft.id)}
                      onChange={() => toggleSelected(draft.id)}
                      data-testid={`draft-checkbox-${draft.id}`}
                    />
                    <div className="flex-1">
                      {editingId === draft.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            rows={2}
                            value={editForm.text}
                            onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                          />
                          {editForm.choices.map((choice, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${draft.id}`}
                                checked={editForm.correct_answer === i}
                                onChange={() => setEditForm({ ...editForm, correct_answer: i })}
                              />
                              <span className="text-xs text-gray-500 w-4">{LETTERS[i]}</span>
                              <input
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                value={choice}
                                onChange={(e) => {
                                  const next = [...editForm.choices];
                                  next[i] = e.target.value;
                                  setEditForm({ ...editForm, choices: next });
                                }}
                              />
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(draft.id)}
                              className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                            >
                              Guardar
                            </button>
                            <button onClick={cancelEdit} className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-900">{draft.text}</p>
                          <ul className="mt-1 space-y-0.5">
                            {draft.choices.map((choice, i) => (
                              <li
                                key={i}
                                className={`text-xs pl-2 ${
                                  i === draft.correct_answer ? 'text-green-700 font-semibold' : 'text-gray-500'
                                }`}
                              >
                                {LETTERS[i]}) {choice} {i === draft.correct_answer && '✓'}
                              </li>
                            ))}
                          </ul>
                          {draft.explanation && (
                            <p className="mt-1 text-xs text-gray-400 italic">{draft.explanation}</p>
                          )}
                          <div className="mt-2 flex gap-3">
                            <button
                              onClick={() => startEdit(draft)}
                              className="text-xs text-primary-600 hover:text-primary-800"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleDelete(draft)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              🗑️ Descartar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraftQuestionsBank;
