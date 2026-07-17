import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import QuestionUpload from '../components/QuestionUpload';
import RosterTable from '../components/RosterTable';
import { themeService } from '../services/themeService';
import { questionService } from '../services/questionService';
import { adminService } from '../services/adminService';
import { accessRequestService } from '../services/accessRequestService';
import { openGmailCompose } from '../utils/gmailCompose';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'questions', 'themes', 'roster', 'requests'
  const [themes, setThemes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);

  // Roster (Fase 4)
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newStudent, setNewStudent] = useState({ email: '', display_name: '', role: 'student' });

  // Solicitudes de acceso (Fase 7)
  const [accessRequests, setAccessRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [convertingRequest, setConvertingRequest] = useState(null);

  // Form state for creating question
  const [newQuestion, setNewQuestion] = useState({
    theme_id: '',
    text: '',
    choices: ['', '', '', ''],
    correct_answer: 0,
    difficulty: 'MEDIUM',
    tags: [],
  });

  useEffect(() => {
    loadThemes();
  }, []);

  useEffect(() => {
    if (selectedTheme) {
      loadQuestions();
    }
  }, [selectedTheme]);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      const data = await adminService.listStudents();
      setRoster(data);
    } catch (error) {
      console.error('Error loading roster:', error);
    } finally {
      setRosterLoading(false);
    }
  }, []);

  const loadAccessRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await accessRequestService.list();
      setAccessRequests(data);
    } catch (error) {
      console.error('Error loading access requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'roster') {
      loadRoster();
    }
    if (activeTab === 'requests') {
      loadAccessRequests();
    }
  }, [activeTab, loadRoster, loadAccessRequests]);

  const handleConvertSave = async (displayName) => {
    const req = convertingRequest;
    try {
      await adminService.createStudent({ email: req.email, display_name: displayName, role: 'student' });
      await accessRequestService.updateStatus(req.id, 'converted');
      setConvertingRequest(null);
      alert('Alumno creado. Puedes enviarle un enlace de restablecimiento de contraseña desde "Alumnos".');
      loadAccessRequests();
    } catch (error) {
      alert('Error al convertir la solicitud: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDismissRequest = async (req) => {
    await accessRequestService.updateStatus(req.id, 'dismissed');
    loadAccessRequests();
  };

  const handleEmailRequest = (req) => {
    openGmailCompose({ to: req.email, subject: 'Sobre tu solicitud de acceso' });
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await adminService.createStudent(newStudent);
      alert('Usuario creado. Se puede enviar un enlace de restablecimiento de contraseña desde su fila.');
      setShowCreateStudent(false);
      setNewStudent({ email: '', display_name: '', role: 'student' });
      loadRoster();
    } catch (error) {
      alert('Error al crear usuario: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRevoke = async (u) => {
    if (!window.confirm(`¿Revocar el acceso de ${u.display_name}? No se borra la cuenta.`)) return;
    await adminService.revokeStudent(u.id);
    loadRoster();
  };

  const handleReactivate = async (u) => {
    await adminService.reactivateStudent(u.id);
    loadRoster();
  };

  const handleSendReset = async (u) => {
    try {
      await adminService.sendPasswordReset(u.id);
      alert(`Enlace de restablecimiento generado para ${u.email}.`);
    } catch (error) {
      alert('Error al generar el enlace: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleSaveEdit = async (update) => {
    await adminService.updateStudent(editingUser.id, update);
    setEditingUser(null);
    loadRoster();
  };

  const handleMarkReviewed = async (u) => {
    await adminService.markReviewed(u.id);
    loadRoster();
  };

  const loadThemes = async () => {
    try {
      const data = await themeService.getThemes();
      setThemes(data);
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await questionService.getQuestions(selectedTheme || null);
      setQuestions(data);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      await questionService.createQuestion(newQuestion);
      alert('Pregunta creada exitosamente');
      setShowCreateQuestion(false);
      setNewQuestion({
        theme_id: '',
        text: '',
        choices: ['', '', '', ''],
        correct_answer: 0,
        difficulty: 'MEDIUM',
        tags: [],
      });
      loadQuestions();
    } catch (error) {
      alert('Error al crear pregunta: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta pregunta?')) return;
    
    try {
      await questionService.deleteQuestion(questionId);
      alert('Pregunta eliminada');
      loadQuestions();
    } catch (error) {
      alert('Error al eliminar pregunta: ' + (error.response?.data?.detail || error.message));
    }
  };

  const updateChoice = (index, value) => {
    const newChoices = [...newQuestion.choices];
    newChoices[index] = value;
    setNewQuestion({ ...newQuestion, choices: newChoices });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="admin-heading">Panel de Administración</h1>
          <p className="mt-2 text-gray-600">Gestiona preguntas, temas y contenido</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-upload"
            >
              Subir Preguntas
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'questions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-questions"
            >
              Gestionar Preguntas
            </button>
            <button
              onClick={() => setActiveTab('themes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'themes'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-themes"
            >
              Ver Temas
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roster'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-roster"
            >
              Alumnos
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-requests"
            >
              Solicitudes
              {accessRequests.filter((r) => r.status === 'pending').length > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                  {accessRequests.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div data-testid="upload-section">
            <QuestionUpload onUploadSuccess={loadQuestions} />
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-6" data-testid="questions-section">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Preguntas</h2>
                <button
                  onClick={() => setShowCreateQuestion(!showCreateQuestion)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  data-testid="toggle-create-question"
                >
                  {showCreateQuestion ? 'Cancelar' : 'Nueva Pregunta'}
                </button>
              </div>

              {/* Filter by theme */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por tema</label>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  data-testid="theme-filter"
                >
                  <option value="">Todos los temas</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      [{theme.part}] {theme.code} - {theme.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Create Question Form */}
              {showCreateQuestion && (
                <form onSubmit={handleCreateQuestion} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200" data-testid="create-question-form">
                  <h3 className="text-lg font-medium mb-4">Nueva Pregunta</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tema *</label>
                      <select
                        required
                        value={newQuestion.theme_id}
                        onChange={(e) => setNewQuestion({ ...newQuestion, theme_id: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        data-testid="new-question-theme"
                      >
                        <option value="">Selecciona un tema</option>
                        {themes.map((theme) => (
                          <option key={theme.id} value={theme.id}>
                            [{theme.part}] {theme.code} - {theme.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pregunta *</label>
                      <textarea
                        required
                        value={newQuestion.text}
                        onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                        rows="3"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        data-testid="new-question-text"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Opciones *</label>
                      {newQuestion.choices.map((choice, index) => (
                        <div key={index} className="flex items-center space-x-2 mb-2">
                          <input
                            type="radio"
                            name="correct"
                            checked={newQuestion.correct_answer === index}
                            onChange={() => setNewQuestion({ ...newQuestion, correct_answer: index })}
                            className="mr-2"
                            data-testid={`correct-answer-${index}`}
                          />
                          <input
                            type="text"
                            required
                            value={choice}
                            onChange={(e) => updateChoice(index, e.target.value)}
                            placeholder={`Opción ${index + 1}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                            data-testid={`choice-${index}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Dificultad</label>
                      <select
                        value={newQuestion.difficulty}
                        onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="EASY">Fácil</option>
                        <option value="MEDIUM">Media</option>
                        <option value="HARD">Difícil</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      data-testid="submit-question"
                    >
                      Crear Pregunta
                    </button>
                  </div>
                </form>
              )}

              {/* Questions List */}
              <div className="space-y-4">
                {loading ? (
                  <p className="text-center text-gray-500">Cargando...</p>
                ) : questions.length === 0 ? (
                  <p className="text-center text-gray-500">No hay preguntas disponibles</p>
                ) : (
                  questions.map((question, index) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow" data-testid={`question-item-${index}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-2">{question.text}</p>
                          <div className="space-y-1">
                            {question.choices.map((choice, idx) => (
                              <div key={idx} className={`text-sm ${idx === question.correct_answer ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                {idx === question.correct_answer && '✓ '}{choice}
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Dificultad: {question.difficulty} | Tags: {question.tags.join(', ') || 'ninguno'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="ml-4 text-red-600 hover:text-red-800"
                          data-testid={`delete-question-${index}`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="themes-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Temas del Temario</h2>
            <p className="text-sm text-gray-600 mb-6">Total de temas: {themes.length}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* General Themes */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center justify-between">
                  <span>Temas Generales</span>
                  <span className="text-sm font-normal text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {themes.filter((t) => t.part === 'GENERAL').length} temas
                  </span>
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {themes
                    .filter((t) => t.part === 'GENERAL')
                    .sort((a, b) => a.order - b.order)
                    .map((theme) => (
                      <div key={theme.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200" data-testid={`theme-${theme.code}`}>
                        <div className="font-medium text-sm text-blue-900">{theme.code}</div>
                        <div className="text-sm text-gray-700">{theme.name}</div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Specific Themes */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center justify-between">
                  <span>Temas Específicos</span>
                  <span className="text-sm font-normal text-purple-600 bg-purple-100 px-2 py-1 rounded">
                    {themes.filter((t) => t.part === 'SPECIFIC').length} temas
                  </span>
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {themes
                    .filter((t) => t.part === 'SPECIFIC')
                    .sort((a, b) => a.order - b.order)
                    .map((theme) => (
                      <div key={theme.id} className="p-3 bg-purple-50 rounded-lg border border-purple-200" data-testid={`theme-${theme.code}`}>
                        <div className="font-medium text-sm text-purple-900">{theme.code}</div>
                        <div className="text-sm text-gray-700">{theme.name}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="roster-section">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Alumnos y Staff</h2>
              <button
                onClick={() => setShowCreateStudent(!showCreateStudent)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                {showCreateStudent ? 'Cancelar' : 'Nuevo Usuario'}
              </button>
            </div>

            {showCreateStudent && (
              <form onSubmit={handleCreateStudent} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre completo *</label>
                  <input
                    required
                    type="text"
                    value={newStudent.display_name}
                    onChange={(e) => setNewStudent({ ...newStudent, display_name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    required
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol</label>
                  <select
                    value={newStudent.role}
                    onChange={(e) => setNewStudent({ ...newStudent, role: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="student">Alumno</option>
                    <option value="profesor">Profesor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700">
                  Crear usuario
                </button>
              </form>
            )}

            {rosterLoading ? (
              <p className="text-center text-gray-500">Cargando...</p>
            ) : (
              <RosterTable
                users={roster}
                profesores={roster.filter((u) => u.role === 'profesor')}
                onRevoke={handleRevoke}
                onReactivate={handleReactivate}
                onSendReset={handleSendReset}
                onEditContent={setEditingUser}
                onMarkReviewed={handleMarkReviewed}
              />
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="requests-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Solicitudes de Acceso</h2>
            {requestsLoading ? (
              <p className="text-center text-gray-500">Cargando...</p>
            ) : accessRequests.length === 0 ? (
              <p className="text-sm text-gray-500">No hay solicitudes todavía.</p>
            ) : (
              <div className="space-y-4">
                {accessRequests.map((req) => (
                  <div key={req.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          {req.nombre}{' '}
                          <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              req.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : req.status === 'converted'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">{req.email} · {req.telefono || 'sin teléfono'}</div>
                        {req.mensaje && <p className="text-sm text-gray-700 mt-2">{req.mensaje}</p>}
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(req.created_at).toLocaleString('es-ES')}
                        </div>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setConvertingRequest(req)}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Convertir en alumno
                          </button>
                          <button
                            onClick={() => handleEmailRequest(req)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            ✉️ Responder
                          </button>
                          <button
                            onClick={() => handleDismissRequest(req)}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Descartar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          profesores={roster.filter((u) => u.role === 'profesor')}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveEdit}
        />
      )}

      {convertingRequest && (
        <ConvertRequestModal
          request={convertingRequest}
          onClose={() => setConvertingRequest(null)}
          onSave={handleConvertSave}
        />
      )}
    </Layout>
  );
};

const ConvertRequestModal = ({ request, onClose, onSave }) => {
  const [displayName, setDisplayName] = useState(request.nombre || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    onSave(displayName.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Convertir en alumno</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre completo para la nueva cuenta</label>
            <input
              autoFocus
              required
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">Email: {request.email}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700">
              Crear cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditUserModal = ({ user, profesores, onClose, onSave }) => {
  const [allowedContentText, setAllowedContentText] = useState(
    user.allowed_content ? user.allowed_content.join(', ') : ''
  );
  const [fullAccess, setFullAccess] = useState(user.allowed_content == null);
  const [assignedProfesorId, setAssignedProfesorId] = useState(user.assigned_profesor_id || '');
  const [paymentType, setPaymentType] = useState(user.payment_type || '');
  const [payments, setPayments] = useState(user.payments_received || []);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNote, setNewPaymentNote] = useState('');

  const addPayment = () => {
    if (!newPaymentAmount) return;
    setPayments([
      ...payments,
      { amount: parseFloat(newPaymentAmount), date: new Date().toISOString().slice(0, 10), note: newPaymentNote },
    ]);
    setNewPaymentAmount('');
    setNewPaymentNote('');
  };

  const removePayment = (idx) => setPayments(payments.filter((_, i) => i !== idx));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      allowed_content: fullAccess
        ? null
        : allowedContentText.split(',').map((s) => s.trim()).filter(Boolean),
      assigned_profesor_id: assignedProfesorId || null,
      payment_type: paymentType || null,
      payments_received: payments,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar acceso — {user.display_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={fullAccess} onChange={(e) => setFullAccess(e.target.checked)} />
              Acceso completo a todo el contenido
            </label>
            {!fullAccess && (
              <textarea
                value={allowedContentText}
                onChange={(e) => setAllowedContentText(e.target.value)}
                rows="2"
                placeholder="cuad_1, cuad_2, ttesp_5..."
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            )}
          </div>
          {user.role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Profesor asignado</label>
              <select
                value={assignedProfesorId}
                onChange={(e) => setAssignedProfesorId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Sin asignar</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de pago</label>
            <input
              type="text"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagos recibidos</label>
            {payments.length > 0 && (
              <ul className="text-sm text-gray-700 mb-2 space-y-1">
                {payments.map((p, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-gray-50 rounded px-2 py-1">
                    <span>{p.amount}€ — {p.date} {p.note && `(${p.note})`}</span>
                    <button type="button" onClick={() => removePayment(idx)} className="text-red-500 text-xs">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Importe"
                value={newPaymentAmount}
                onChange={(e) => setNewPaymentAmount(e.target.value)}
                className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Nota"
                value={newPaymentNote}
                onChange={(e) => setNewPaymentNote(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
              <button type="button" onClick={addPayment} className="px-2 py-1 bg-gray-200 rounded-md text-sm">+</button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Admin;
