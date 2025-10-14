import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { examService } from '../services/examService';

const TakeExam = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAttempt();
  }, [attemptId]);

  const loadAttempt = async () => {
    try {
      const data = await examService.getAttemptResults(attemptId);
      setAttempt(data);
      setExam(data.exam || data);
      
      // Initialize answers from saved state
      if (data.answers) {
        setAnswers(data.answers);
      }
    } catch (error) {
      console.error('Error loading attempt:', error);
      alert('Error al cargar el examen');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = async (questionId, answerIndex) => {
    const newAnswers = { ...answers, [questionId]: answerIndex };
    setAnswers(newAnswers);
    
    // Save answer to backend
    try {
      await examService.submitAnswer(attemptId, questionId, answerIndex);
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

  const handleJumpToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const handleFinish = async () => {
    if (!window.confirm('¿Estás seguro de finalizar el examen?')) return;

    setSubmitting(true);
    try {
      const result = await examService.finishAttempt(attemptId);
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900" data-testid="exam-title">{exam.name}</h1>
            <div className="text-sm text-gray-600">
              Respondidas: {answeredCount} / {exam.questions.length}
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
            {currentQuestion.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(currentQuestion.question_id, index)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  answers[currentQuestion.question_id] === index
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                }`}
                data-testid={`answer-option-${index}`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                      answers[currentQuestion.question_id] === index
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-400'
                    }`}
                  >
                    {answers[currentQuestion.question_id] === index && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-900">{choice}</span>
                </div>
              </button>
            ))}
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

          {/* Question Grid */}
          <div className="grid grid-cols-10 gap-2 mb-4">
            {exam.questions.map((q, index) => (
              <button
                key={index}
                onClick={() => handleJumpToQuestion(index)}
                className={`w-10 h-10 rounded-md text-sm font-medium ${
                  index === currentQuestionIndex
                    ? 'bg-primary-600 text-white'
                    : answers[q.question_id] !== undefined
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
                data-testid={`question-nav-${index}`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <button
            onClick={handleFinish}
            disabled={submitting}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="finish-exam-button"
          >
            {submitting ? 'Finalizando...' : 'Finalizar Examen'}
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default TakeExam;
