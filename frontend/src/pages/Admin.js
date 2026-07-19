import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import QuestionUpload from '../components/QuestionUpload';
import QuestionsManager from '../components/QuestionsManager';
import RosterTable from '../components/RosterTable';
import TopFailuresPanel from '../components/TopFailuresPanel';
import ContentAccessChecklist from '../components/ContentAccessChecklist';
import ConfirmDialog from '../components/ConfirmDialog';
import { adminService } from '../services/adminService';
import { accessRequestService } from '../services/accessRequestService';
import documentService from '../services/documentService';
import { openGmailCompose } from '../utils/gmailCompose';

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'questions', 'roster', 'requests', 'failures', 'documents'

  // Roster (Fase 4)
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [profileEditingUser, setProfileEditingUser] = useState(null);
  const [expiryEditingUser, setExpiryEditingUser] = useState(null);
  const [newStudent, setNewStudent] = useState({
    email: '',
    display_name: '',
    role: 'student',
    duration_days: '30',
    allowed_content: null,
  });

  // Solicitudes de acceso (Fase 7)
  const [accessRequests, setAccessRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [convertingRequest, setConvertingRequest] = useState(null);

  // Documentos PDF de profesor pendientes de aprobación (ronda 5)
  const [pendingDocs, setPendingDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

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

  const loadPendingDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await documentService.listPending();
      setPendingDocs(data);
    } catch (error) {
      console.error('Error loading pending documents:', error);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'roster') {
      loadRoster();
    }
    if (activeTab === 'requests') {
      loadAccessRequests();
    }
    if (activeTab === 'documents') {
      loadPendingDocs();
    }
  }, [activeTab, loadRoster, loadAccessRequests, loadPendingDocs]);

  const handleReviewDocument = (doc, newStatus) => {
    if (newStatus === 'rejected') {
      setConfirmDialog({
        message: `¿Rechazar el documento "${doc.original_filename}"?`,
        danger: true,
        onConfirm: async () => {
          setConfirmDialog(null);
          await documentService.review(doc.id, 'rejected');
          loadPendingDocs();
        },
      });
      return;
    }
    documentService.review(doc.id, 'approved').then(loadPendingDocs);
  };

  const handleConvertSave = async (displayName) => {
    const req = convertingRequest;
    const isProfesor = req.tipo === 'profesor';
    try {
      await adminService.createStudent({
        email: req.email,
        display_name: displayName,
        role: isProfesor ? 'profesor' : 'student',
        profile: isProfesor
          ? null
          : {
              full_name: displayName,
              birth_date: req.nacimiento || null,
              prep_time: req.tiempo_prep || null,
              prep_with: req.con_quien || null,
              weak_points: req.puntos_debiles || null,
            },
      });
      await accessRequestService.updateStatus(req.id, 'converted');
      setConvertingRequest(null);
      alert(`${isProfesor ? 'Profesor' : 'Alumno'} creado. Puedes enviarle un enlace de restablecimiento de contraseña desde "Alumnos".`);
      loadAccessRequests();
    } catch (error) {
      alert('Error al convertir la solicitud: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleCopyRegistrationLink = () => {
    const link = `${window.location.origin}/solicitar-acceso`;
    navigator.clipboard.writeText(link);
    alert('Enlace copiado:\n' + link);
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
    const { duration_days, ...rest } = newStudent;
    const payload = {
      ...rest,
      expires_at:
        rest.role === 'student' && duration_days !== 'unlimited'
          ? new Date(Date.now() + parseInt(duration_days, 10) * 86400000).toISOString()
          : null,
    };
    try {
      await adminService.createStudent(payload);
      alert('Usuario creado. Se puede enviar un enlace de restablecimiento de contraseña desde su fila.');
      setShowCreateStudent(false);
      setNewStudent({ email: '', display_name: '', role: 'student', duration_days: '30', allowed_content: null });
      loadRoster();
    } catch (error) {
      alert('Error al crear usuario: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRevoke = (u) => {
    setConfirmDialog({
      message: `¿Revocar el acceso de ${u.display_name}? No se borra la cuenta.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        await adminService.revokeStudent(u.id);
        loadRoster();
      },
    });
  };

  const handleReactivate = async (u) => {
    await adminService.reactivateStudent(u.id);
    loadRoster();
  };

  const handleSendReset = async (u) => {
    try {
      const { reset_link: resetLink } = await adminService.sendPasswordReset(u.id);
      navigator.clipboard.writeText(resetLink);
      alert(`Enlace de restablecimiento para ${u.email} (copiado, válido 24h):\n${resetLink}`);
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

  const handleAssignProfesor = async (u, profesorId) => {
    await adminService.updateStudent(u.id, { assigned_profesor_id: profesorId });
    loadRoster();
  };

  const handleSaveExpiry = async (expiresAt) => {
    await adminService.updateStudent(expiryEditingUser.id, { expires_at: expiresAt });
    setExpiryEditingUser(null);
    loadRoster();
  };

  const handleSaveProfile = async (profile) => {
    await adminService.updateStudent(profileEditingUser.id, { profile });
    setProfileEditingUser(null);
    loadRoster();
  };

  const handleViewProgress = (u) => {
    navigate(`/progreso/${u.id}`);
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
            <button
              onClick={() => setActiveTab('failures')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'failures'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-failures"
            >
              Refuerzo
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-documents"
            >
              Documentos
              {pendingDocs.length > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                  {pendingDocs.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div data-testid="upload-section">
            <QuestionUpload />
          </div>
        )}

        {activeTab === 'questions' && (
          <div data-testid="questions-section">
            <QuestionsManager />
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
                {newStudent.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Duración del acceso</label>
                      <select
                        value={newStudent.duration_days}
                        onChange={(e) => setNewStudent({ ...newStudent, duration_days: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="15">15 días</option>
                        <option value="30">1 mes (30 días)</option>
                        <option value="90">3 meses (90 días)</option>
                        <option value="365">365 días</option>
                        <option value="unlimited">Sin límite</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contenido disponible para este alumno
                      </label>
                      <ContentAccessChecklist
                        value={newStudent.allowed_content}
                        onChange={(allowed_content) => setNewStudent({ ...newStudent, allowed_content })}
                      />
                    </div>
                  </>
                )}
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
                onAssignProfesor={handleAssignProfesor}
                onEditExpiry={setExpiryEditingUser}
                onViewProgress={handleViewProgress}
                onEditProfile={setProfileEditingUser}
              />
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="requests-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Solicitudes de Acceso</h2>
              <button
                onClick={handleCopyRegistrationLink}
                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                🔗 Copiar enlace
              </button>
            </div>
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
                            className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                              req.tipo === 'profesor' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {req.tipo === 'profesor' ? 'Profesor' : 'Alumno'}
                          </span>{' '}
                          <span
                            className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
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
                        {req.tipo === 'profesor' && (
                          <div className="text-sm text-gray-600 mt-1">
                            {req.especialidad && <div>Especialidad: {req.especialidad}</div>}
                            {req.experiencia && <div>Experiencia: {req.experiencia}</div>}
                            {req.disponibilidad && <div>Disponibilidad: {req.disponibilidad}</div>}
                          </div>
                        )}
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
                            {req.tipo === 'profesor' ? 'Convertir en profesor' : 'Convertir en alumno'}
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

        {activeTab === 'failures' && <TopFailuresPanel />}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="documents-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Documentos pendientes de aprobación</h2>
            {docsLoading ? (
              <p className="text-center text-gray-500">Cargando...</p>
            ) : pendingDocs.length === 0 ? (
              <p className="text-sm text-gray-500">No hay documentos pendientes.</p>
            ) : (
              <div className="space-y-4">
                {pendingDocs.map((doc) => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{doc.original_filename}</div>
                        <div className="text-sm text-gray-600">
                          {doc.area_id} · {doc.theme_id}
                        </div>
                        <a
                          href={documentService.fileUrl(doc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:text-primary-800"
                        >
                          Ver PDF
                        </a>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(doc.created_at).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleReviewDocument(doc, 'approved')}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleReviewDocument(doc, 'rejected')}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Rechazar
                        </button>
                      </div>
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

      {expiryEditingUser && (
        <ExpiryEditorModal
          user={expiryEditingUser}
          onClose={() => setExpiryEditingUser(null)}
          onSave={handleSaveExpiry}
        />
      )}

      {profileEditingUser && (
        <ProfileEditorModal
          user={profileEditingUser}
          onClose={() => setProfileEditingUser(null)}
          onSave={handleSaveProfile}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {request.tipo === 'profesor' ? 'Convertir en profesor' : 'Convertir en alumno'}
        </h3>
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
  const [allowedContent, setAllowedContent] = useState(user.allowed_content ?? null);
  const [assignedProfesorId, setAssignedProfesorId] = useState(user.assigned_profesor_id || '');
  const [paymentType, setPaymentType] = useState(user.payment_type || 'gratis');
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
      allowed_content: allowedContent,
      assigned_profesor_id: assignedProfesorId || null,
      payment_type: paymentType || null,
      payments_received: payments,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar acceso — {user.display_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contenido disponible</label>
            <ContentAccessChecklist value={allowedContent} onChange={setAllowedContent} />
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
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="gratis">🎁 Gratis</option>
              <option value="pago">💰 Pago</option>
            </select>
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

const ExpiryEditorModal = ({ user, onClose, onSave }) => {
  const [date, setDate] = useState(user.expires_at ? user.expires_at.slice(0, 10) : '');
  const [noLimit, setNoLimit] = useState(!user.expires_at);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(noLimit ? null : new Date(date + 'T23:59:59').toISOString());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Caducidad de acceso — {user.display_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={noLimit} onChange={(e) => setNoLimit(e.target.checked)} />
            Sin límite
          </label>
          {!noLimit && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de caducidad</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}
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

const PREP_TIME_OPTIONS = ['', 'Sin empezar', 'Menos de 6 meses', '6 meses - 1 año', '1 - 2 años', 'Más de 2 años'];

const ProfileEditorModal = ({ user, onClose, onSave }) => {
  const profile = user.profile || {};
  const [fullName, setFullName] = useState(profile.full_name || user.display_name || '');
  const [birthDate, setBirthDate] = useState(profile.birth_date || '');
  const [prepTime, setPrepTime] = useState(profile.prep_time || '');
  const [prepWith, setPrepWith] = useState(profile.prep_with || '');
  const [weakPoints, setWeakPoints] = useState(profile.weak_points || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      full_name: fullName.trim() || null,
      birth_date: birthDate || null,
      prep_time: prepTime || null,
      prep_with: prepWith.trim() || null,
      weak_points: weakPoints.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Perfil de {user.display_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo (no editable, es su acceso)</label>
            <input type="text" value={user.email} disabled className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de nacimiento</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">¿Cuánto tiempo lleva preparándose?</label>
            <select
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {PREP_TIME_OPTIONS.map((o) => (
                <option key={o} value={o}>{o || 'Selecciona...'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">¿Con quién se ha preparado?</label>
            <input
              type="text"
              value={prepWith}
              onChange={(e) => setPrepWith(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Puntos débiles</label>
            <textarea
              value={weakPoints}
              onChange={(e) => setWeakPoints(e.target.value)}
              rows="3"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
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
