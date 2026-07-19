import React, { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { questionService } from '../services/questionService';
import practicalSetService from '../services/practicalSetService';
import { loadContentAreaUnits } from '../utils/contentAccessUnits';

// Fuente de las preguntas de cada área, ver backend/config/contentAreas.js:
//  - gen/cuad -> embebidas en un practical_set (Cuadernillos/Supuestos)
//  - ttesp/ttgen -> colección `questions` suelta, filtrada por content_area+theme_id
//  - tesp/esq/tgen -> sin banco de preguntas, son áreas solo-documento (ver pestaña
//    "Mis Documentos" del profesor / "Documentos" del admin)
const sourceForArea = (areaId) => {
  if (areaId === 'gen' || areaId === 'cuad') return 'practical_set';
  if (areaId === 'ttesp' || areaId === 'ttgen') return 'questions';
  return 'none';
};

const emptyChoices = ['', '', '', ''];

const QuestionForm = ({ initial, cases, onSave, onCancel }) => {
  const [text, setText] = useState(initial?.text || '');
  const [choices, setChoices] = useState(initial?.choices?.length ? initial.choices : emptyChoices);
  const [correctAnswer, setCorrectAnswer] = useState(initial?.correct_answer ?? 0);
  const [casePosition, setCasePosition] = useState('');
  const [saving, setSaving] = useState(false);

  const updateChoice = (i, v) => setChoices((cs) => cs.map((c, idx) => (idx === i ? v : c)));
  const addChoice = () => setChoices((cs) => [...cs, '']);
  const removeChoice = (i) => {
    setChoices((cs) => cs.filter((_, idx) => idx !== i));
    setCorrectAnswer((ca) => (ca >= i ? Math.max(0, ca - 1) : ca));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { text, choices, correct_answer: correctAnswer };
      if (cases && casePosition) payload.case_position = parseInt(casePosition, 10);
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-gray-50 border border-gray-200 rounded-md p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        rows={2}
        placeholder="Enunciado"
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
      />
      {choices.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" checked={correctAnswer === i} onChange={() => setCorrectAnswer(i)} />
          <input
            type="text"
            required
            value={c}
            onChange={(e) => updateChoice(i, e.target.value)}
            placeholder={`Opción ${i + 1}`}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
          />
          {choices.length > 2 && (
            <button type="button" onClick={() => removeChoice(i)} className="text-xs text-red-500">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addChoice} className="text-xs text-primary-600 hover:text-primary-800">
        + Añadir opción
      </button>
      {cases && cases.length > 0 && (
        <select
          value={casePosition}
          onChange={(e) => setCasePosition(e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="">Sin caso asociado</option>
          {cases.map((c) => (
            <option key={c.position} value={c.position}>{c.position}. {c.title}</option>
          ))}
        </select>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-1.5 px-3 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-1.5 px-3 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
};

const QuestionsManager = () => {
  const [loading, setLoading] = useState(true);
  const [areaUnits, setAreaUnits] = useState([]);
  const [openAreas, setOpenAreas] = useState(() => new Set());
  const [openUnits, setOpenUnits] = useState(() => new Set());
  const [questionsByUnit, setQuestionsByUnit] = useState({});
  const [casesByUnit, setCasesByUnit] = useState({});
  const [loadingUnit, setLoadingUnit] = useState(null);
  const [editingKey, setEditingKey] = useState(null); // `${unitKey}:${questionId}`
  const [addingUnit, setAddingUnit] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { areas } = await loadContentAreaUnits();
      setAreaUnits(areas);
    } catch (err) {
      console.error('Error loading Gestionar Preguntas:', err);
      setError('No se pudo cargar el contenido. Inténtalo de nuevo.');
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

  const practicalSetIdForUnit = (unit) => unit.practicalSet?.id || null;

  const loadUnitQuestions = useCallback(async (area, unit) => {
    const source = sourceForArea(area.id);
    setLoadingUnit(unit.key);
    setError('');
    try {
      if (source === 'questions') {
        const data = await questionService.getQuestions(unit.theme.id, 500, 0, area.id);
        setQuestionsByUnit((prev) => ({ ...prev, [unit.key]: data }));
      } else if (source === 'practical_set') {
        const psId = practicalSetIdForUnit(unit);
        if (!psId) {
          setQuestionsByUnit((prev) => ({ ...prev, [unit.key]: null }));
          return;
        }
        const detail = await practicalSetService.getById(psId);
        setQuestionsByUnit((prev) => ({ ...prev, [unit.key]: detail.questions }));
        setCasesByUnit((prev) => ({ ...prev, [unit.key]: detail.cases || [] }));
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar las preguntas de esta unidad');
    } finally {
      setLoadingUnit(null);
    }
  }, []);

  const toggleUnit = (area, unit) => {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit.key)) {
        next.delete(unit.key);
      } else {
        next.add(unit.key);
        if (!(unit.key in questionsByUnit)) loadUnitQuestions(area, unit);
      }
      return next;
    });
  };

  const handleSaveEdit = async (area, unit, question, data) => {
    const source = sourceForArea(area.id);
    try {
      if (source === 'questions') {
        await questionService.updateQuestion(question.id, data);
      } else {
        await practicalSetService.updateQuestion(practicalSetIdForUnit(unit), question.id, data);
      }
      setEditingKey(null);
      loadUnitQuestions(area, unit);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar la pregunta');
    }
  };

  const handleAddQuestion = async (area, unit, data) => {
    const source = sourceForArea(area.id);
    try {
      if (source === 'questions') {
        await questionService.createQuestion({
          theme_id: unit.theme.id,
          content_area: area.id,
          text: data.text,
          choices: data.choices,
          correct_answer: data.correct_answer,
          difficulty: 'MEDIUM',
          tags: [],
        });
      } else {
        await practicalSetService.addQuestion(practicalSetIdForUnit(unit), data);
      }
      setAddingUnit(null);
      loadUnitQuestions(area, unit);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la pregunta');
    }
  };

  const handleDeleteQuestion = (area, unit, question) => {
    const source = sourceForArea(area.id);
    setConfirmDialog({
      message: '¿Eliminar esta pregunta?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          if (source === 'questions') {
            await questionService.deleteQuestion(question.id);
          } else {
            await practicalSetService.deleteQuestion(practicalSetIdForUnit(unit), question.id);
          }
          loadUnitQuestions(area, unit);
        } catch (err) {
          setError(err.response?.data?.detail || 'Error al eliminar la pregunta');
        }
      },
    });
  };

  const renderQuestionRow = (area, unit, question) => {
    const key = `${unit.key}:${question.id}`;
    if (editingKey === key) {
      return (
        <QuestionForm
          key={key}
          initial={question}
          cases={casesByUnit[unit.key]}
          onSave={(data) => handleSaveEdit(area, unit, question, data)}
          onCancel={() => setEditingKey(null)}
        />
      );
    }
    return (
      <div key={question.id} className="border border-gray-200 rounded-md p-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{question.text}</p>
            <div className="mt-1 space-y-0.5">
              {question.choices.map((c, idx) => (
                <div key={idx} className={`text-xs ${idx === question.correct_answer ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                  {idx === question.correct_answer && '✓ '}{c}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => setEditingKey(key)}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Editar
            </button>
            <button
              onClick={() => handleDeleteQuestion(area, unit, question)}
              className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderUnitContent = (area, unit) => {
    if (loadingUnit === unit.key) {
      return <p className="text-sm text-gray-400 px-1 py-2">Cargando...</p>;
    }
    const questions = questionsByUnit[unit.key];
    const source = sourceForArea(area.id);

    if (source === 'practical_set' && !practicalSetIdForUnit(unit)) {
      return (
        <p className="text-sm text-gray-400 px-1 py-2">
          Todavía no hay ningún Cuadernillo subido para este tema (súbelo desde "Subir Preguntas").
        </p>
      );
    }

    return (
      <div className="space-y-2 px-1 py-2">
        {(questions || []).length === 0 && addingUnit !== unit.key && (
          <p className="text-sm text-gray-400">Sin preguntas todavía.</p>
        )}
        {(questions || []).map((q) => renderQuestionRow(area, unit, q))}
        {addingUnit === unit.key ? (
          <QuestionForm
            cases={casesByUnit[unit.key]}
            onSave={(data) => handleAddQuestion(area, unit, data)}
            onCancel={() => setAddingUnit(null)}
          />
        ) : (
          <button
            onClick={() => setAddingUnit(unit.key)}
            className="text-xs px-2 py-1.5 bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
          >
            + Añadir pregunta
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="text-center text-gray-500 py-8">Cargando...</p>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="questions-manager">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Gestionar Preguntas</h2>
      <p className="text-sm text-gray-500 mb-4">
        Mismo árbol que Cuadernos: despliega un área y un tema para ver, editar, añadir o borrar
        sus preguntas.
      </p>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{error}</div>}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {areaUnits.map(({ area, units }) => {
          const isAreaOpen = openAreas.has(area.id);
          const source = sourceForArea(area.id);
          return (
            <div key={area.id} className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleArea(area.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <span>{area.label}</span>
                <span className="text-gray-400">{isAreaOpen ? '▲' : '▼'}</span>
              </button>
              {isAreaOpen && (
                <div className="px-2 pb-3">
                  {source === 'none' ? (
                    <p className="text-sm text-gray-400 px-2 py-2">
                      Esta área no tiene banco de preguntas propio -- se gestiona como documento
                      (ver pestaña "Documentos").
                    </p>
                  ) : units.length === 0 ? (
                    <p className="text-sm text-gray-400 px-2 py-2">Todavía no hay temas en esta parte.</p>
                  ) : (
                    units.map((unit) => {
                      const isUnitOpen = openUnits.has(unit.key);
                      return (
                        <div key={unit.key} className="ml-2 mb-1">
                          <button
                            type="button"
                            onClick={() => toggleUnit(area, unit)}
                            className="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                          >
                            <span>{unit.label}</span>
                            <span className="text-gray-400 text-xs">{isUnitOpen ? '▲' : '▼'}</span>
                          </button>
                          {isUnitOpen && renderUnitContent(area, unit)}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default QuestionsManager;
