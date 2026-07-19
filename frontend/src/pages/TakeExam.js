import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { examService } from '../services/examService';
import { notesService } from '../services/notesService';
import ConfirmDialog from '../components/ConfirmDialog';
import AskTeacherButton from '../components/AskTeacherButton';
import { useExamGuard } from '../context/ExamGuardContext';

const TakeExam = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { setGuarded } = useExamGuard();
  const [exam, setExam] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [liveCorrection, setLiveCorrection] = useState(false);
  const [liveResults, setLiveResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerMinutesInput, setTimerMinutesInput] = useState(30);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Mientras este componente está montado, el examen se considera "en curso": Layout.js avisa
  // antes de dejar salir por el nav, y el navegador avisa antes de cerrar/recargar la pestaña.
  // Se desactiva solo al desmontar (navegar fuera de aquí), tanto si fue por confirmar la salida
  // como por terminar el examen normalmente.
  useEffect(() => {
    setGuarded(true);
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      setGuarded(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [setGuarded]);

  // Cronómetro de cuenta atrás opcional para simular las condiciones de un examen real. Cuenta
  // en negativo si se pasa el tiempo en vez de parar, para que el alumno vea cuánto se ha
  // excedido.
  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const startTimer = () => {
    const mins = parseInt(timerMinutesInput, 10);
    if (!mins || mins <= 0) return;
    setTimerSeconds(mins * 60);
    setTimerStarted(true);
    setTimerRunning(true);
  };
  const pauseResumeTimer = () => setTimerRunning((r) => !r);
  const resetTimer = () => {
    setTimerRunning(false);
    setTimerStarted(false);
    setTimerSeconds(0);
  };
  const formatTimer = (secs) => {
    const abs = Math.abs(secs);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return (secs < 0 ? '-' : '') + m + ':' + String(s).padStart(2, '0');
  };

  const loadAttempt = useCallback(async () => {
    try {
      const data = await examService.getAttemptResults(attemptId);
      const exam_data = await examService.getExam(data.exam_id);
      setExam(exam_data.exam || exam_data);
      setLiveCorrection(!!data.live_correction);

      // Restaura las respuestas ya guardadas del intento (antes leía exam_data.answers, que
      // nunca existe -- las respuestas viven en el attempt, no en el exam -- así que recargar
      // la página a mitad de examen no restauraba nada).
      if (data.answers) {
        setAnswers(data.answers);
      }
    } catch (error) {
      console.error('Error loading attempt:', error);
      alert('Error al cargar el examen');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  const handleAnswerSelect = async (questionId, answerIndex) => {
    // Un segundo click sobre la misma opción ya marcada la desmarca (deja la pregunta en
    // blanco); el botón explícito "Dejar en blanco" llama con answerIndex=null directamente.
    const newIndex = answerIndex === null || answers[questionId] === answerIndex ? null : answerIndex;
    const newAnswers = { ...answers, [questionId]: newIndex };
    setAnswers(newAnswers);

    // Save answer to backend
    try {
      const result = await examService.submitAnswer(attemptId, questionId, newIndex);
      setLiveResults((prev) => {
        if (newIndex === null || result.is_correct === undefined) {
          const next = { ...prev };
          delete next[questionId];
          return next;
        }
        return { ...prev, [questionId]: { isCorrect: result.is_correct, correctAnswer: result.correct_answer } };
      });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < (exam?.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const confirmFinish = async () => {
    setShowFinishConfirm(false);
    setSubmitting(true);
    try {
      await examService.finishAttempt(attemptId);
      navigate(`/exams/results/${attemptId}`);
    } catch (error) {
      alert('Error al finalizar el examen: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando examen...</div>
      </Layout>
    );
  }

  if (!exam || !exam.questions || exam.questions.length === 0) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Error: No se pudo cargar el examen</p>
        </div>
      </Layout>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  // question_positions en `cases` son 1-based y siguen el mismo orden que exam.questions.
  const currentCase = exam.cases?.find((c) =>
    c.question_positions.includes(currentQuestionIndex + 1)
  );

  const canTakeNotes = exam.mode === 'practice' && exam.content_unit_key && currentCase;

  const openNotes = async () => {
    setShowNotes(true);
    setNoteLoading(true);
    try {
      const note = await notesService.getOne(exam.content_unit_key, currentCase.position);
      setNoteText(note?.text || '');
    } catch (error) {
      setNoteText('');
    } finally {
      setNoteLoading(false);
    }
  };

  const saveNote = async () => {
    setNoteSaving(true);
    try {
      await notesService.save(exam.content_unit_key, currentCase.position, noteText, `${exam.name} · ${currentCase.title}`);
      setShowNotes(false);
    } catch (error) {
      alert('Error al guardar la nota: ' + (error.response?.data?.detail || error.message));
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900" data-testid="exam-title">
              {exam.name}
              {liveCorrection && (
                <span className="ml-2 align-middle text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Corrección en directo
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3">
              {!timerStarted ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={timerMinutesInput}
                    onChange={(e) => setTimerMinutesInput(e.target.value)}
                    className="w-14 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={startTimer}
                    className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                  >
                    ⏱ Iniciar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-sm font-mono font-semibold px-2 py-1.5 rounded-md ${
                      timerSeconds < 0
                        ? 'bg-red-100 text-red-700'
                        : timerSeconds < 300
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    ⏱ {formatTimer(timerSeconds)}
                  </span>
                  <button
                    onClick={pauseResumeTimer}
                    className="text-sm px-2 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    {timerRunning ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="text-sm px-2 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    ⏹
                  </button>
                </div>
              )}
              {canTakeNotes && (
                <button
                  onClick={openNotes}
                  className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100"
                >
                  📝 Notas
                </button>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>

        {/* Minisupuesto del caso actual (solo en modo práctica de Supuestos/Cuadernillos) --
            sin selector de casos: Anterior/Siguiente ya avanzan de caso al cruzar sus preguntas. */}
        {currentCase ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6" data-testid="current-case">
            <h3 className="text-sm font-semibold text-gray-800">{currentCase.title}</h3>
            {currentCase.description && (
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{currentCase.description}</p>
            )}
            <div className="text-xs text-gray-500 mt-3">
              Respondidas: {answeredCount} / {exam.questions.length}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 mb-2">
            Respondidas: {answeredCount} / {exam.questions.length}
          </div>
        )}

        {/* Question */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6" data-testid="question-card">
          <div className="mb-4">
            <span className="text-sm text-gray-600">
              Pregunta {currentQuestionIndex + 1} de {exam.questions.length}
            </span>
          </div>

          <h2 className="text-xl font-medium text-gray-900 mb-6" data-testid="question-text">
            {currentQuestion.text}
          </h2>

          <div className="space-y-3">
            {currentQuestion.choices.map((choice, index) => {
              const isSelected = answers[currentQuestion.question_id] === index;
              const liveResult = liveResults[currentQuestion.question_id];
              let colorClass = isSelected
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400 bg-white';
              if (liveResult) {
                if (index === liveResult.correctAnswer) {
                  colorClass = 'border-green-500 bg-green-50';
                } else if (isSelected && !liveResult.isCorrect) {
                  colorClass = 'border-red-500 bg-red-50';
                }
              }
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(currentQuestion.question_id, index)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${colorClass}`}
                  data-testid={`answer-option-${index}`}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                        isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-400'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-900">{choice}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3">
            {answers[currentQuestion.question_id] !== undefined && answers[currentQuestion.question_id] !== null ? (
              <button
                type="button"
                onClick={() => handleAnswerSelect(currentQuestion.question_id, null)}
                className="text-xs text-gray-500 hover:text-gray-700"
                data-testid="clear-answer-button"
              >
                Dejar en blanco
              </button>
            ) : (
              <span />
            )}
            {liveResults[currentQuestion.question_id] && !liveResults[currentQuestion.question_id].isCorrect && (
              <AskTeacherButton questionText={currentQuestion.text} />
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="previous-button"
            >
              ← Anterior
            </button>
            <button
              onClick={handleNext}
              disabled={currentQuestionIndex === exam.questions.length - 1}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="next-button"
            >
              Siguiente →
            </button>
          </div>

          <button
            onClick={() => setShowFinishConfirm(true)}
            disabled={submitting}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="finish-exam-button"
          >
            {submitting ? 'Finalizando...' : 'Finalizar Examen'}
          </button>
        </div>
      </div>

      {showFinishConfirm && (
        <ConfirmDialog
          message="¿Estás seguro de finalizar el examen?"
          confirmLabel="Finalizar"
          onConfirm={confirmFinish}
          onCancel={() => setShowFinishConfirm(false)}
        />
      )}

      {showNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">📝 Notas</h3>
            <p className="text-sm text-gray-500 mb-4">{currentCase?.title}</p>
            {noteLoading ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : (
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows="6"
                autoFocus
                placeholder="Escribe tu apunte sobre este caso..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            )}
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowNotes(false)}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={noteSaving || noteLoading}
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {noteSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TakeExam;
