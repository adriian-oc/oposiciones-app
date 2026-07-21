import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Avatar from '../components/Avatar';
import QuestionUpload from '../components/QuestionUpload';
import QuestionsManager from '../components/QuestionsManager';
import RosterTable from '../components/RosterTable';
import TopFailuresPanel from '../components/TopFailuresPanel';
import ContentAccessChecklist from '../components/ContentAccessChecklist';
import ConfirmDialog from '../components/ConfirmDialog';
import EditUserModal from '../components/EditUserModal';
import ExpiryEditorModal from '../components/ExpiryEditorModal';
import DraftQuestionsBank from '../components/DraftQuestionsBank';
import { adminService } from '../services/adminService';
import { accessRequestService } from '../services/accessRequestService';
import documentService from '../services/documentService';
import { openGmailCompose } from '../utils/gmailCompose';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Alumno' },
  { value: 'profesor', label: 'Profesor' },
  { value: 'admin', label: 'Admin' },
  { value: 'curator', label: 'Curador' },
];

// Mismas categorías que backend/api/admin.py::EVENT_LABELS -- colorea por gravedad, no por tipo
// exacto (varios eventos de Brevo comparten intención: rebotes/spam/bloqueo son todos "fue mal").
const EMAIL_EVENT_BADGE = {
  delivered: 'bg-green-100 text-green-700',
  opened: 'bg-green-100 text-green-700',
  clicks: 'bg-blue-100 text-blue-700',
  sent: 'bg-gray-100 text-gray-600',
  deferred: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-700',
  hardBounces: 'bg-red-100 text-red-700',
  softBounces: 'bg-amber-100 text-amber-800',
  spam: 'bg-red-100 text-red-700',
  invalid: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
  unsubscribed: 'bg-gray-100 text-gray-600',
};

const Admin = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  // null = panel de tarjetas; si no, la sección abierta: 'upload', 'questions', 'roster', 'requests', 'failures', 'documents'
  const [activeTab, setActiveTab] = useState(null);

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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Documentos PDF de profesor pendientes de aprobación (ronda 5)
  const [pendingDocs, setPendingDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Actividad de email (Brevo), solo lectura -- se carga al abrir la tarjeta, no al entrar al panel.
  const [emailActivity, setEmailActivity] = useState([]);
  const [emailActivityLoading, setEmailActivityLoading] = useState(false);
  const [emailActivityError, setEmailActivityError] = useState('');
  const [emailStats, setEmailStats] = useState(null);
  const [emailStatsLoading, setEmailStatsLoading] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

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
    if (activeTab === 'roster' || activeTab === 'profesores' || activeTab === 'content-update') {
      loadRoster();
    }
  }, [activeTab, loadRoster]);

  useEffect(() => {
    if (activeTab !== 'email-activity') return;
    setEmailActivityLoading(true);
    setEmailActivityError('');
    adminService.getEmailActivity()
      .then(setEmailActivity)
      .catch((error) => {
        console.error('Error loading email activity:', error);
        setEmailActivityError(error.response?.data?.detail || 'No se pudo cargar la actividad de email');
      })
      .finally(() => setEmailActivityLoading(false));

    setEmailStatsLoading(true);
    adminService.getEmailStats(7)
      .then(setEmailStats)
      .catch((error) => console.error('Error loading email stats:', error))
      .finally(() => setEmailStatsLoading(false));
  }, [activeTab]);

  // Solicitudes y documentos pendientes se cargan siempre al entrar al panel (no solo al abrir su
  // tarjeta) para poder mostrar el aviso de pendientes en la propia tarjeta antes de pinchar.
  useEffect(() => {
    loadAccessRequests();
    loadPendingDocs();
  }, [loadAccessRequests, loadPendingDocs]);

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
      await accessRequestService.convert(req.id, displayName);
      setConvertingRequest(null);
      alert(`${isProfesor ? 'Profesor' : 'Alumno'} creado. Le hemos enviado un correo con su enlace para fijar contraseña.`);
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

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSending(true);
    try {
      await adminService.sendRecruitmentEmail(inviteEmail.trim());
      setShowInviteModal(false);
      setInviteEmail('');
      alert(`Correo de captación enviado a ${inviteEmail.trim()}.`);
    } catch (error) {
      setInviteError(error.response?.data?.detail || 'No se pudo enviar el correo');
    } finally {
      setInviteSending(false);
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
      alert('Usuario creado. Le hemos enviado un correo con su enlace para fijar contraseña.');
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

  const handleSendContentUpdateAnnouncement = () => {
    const recipientCount = roster.filter(
      (u) => (u.role === 'student' || u.role === 'profesor') && !u.revoked
    ).length;
    setConfirmDialog({
      message: `Se enviará un correo real y una notificación a ${recipientCount} alumnos y profesores activos, invitándoles a entrar a ver la novedad del Tema 4 y el Tema 12. Esta acción no se puede deshacer. ¿Continuar?`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setSendingAnnouncement(true);
        try {
          const { sent } = await adminService.sendContentUpdateAnnouncement();
          alert(`Aviso enviado a ${sent} alumnos y profesores.`);
        } catch (error) {
          alert('Error al enviar el aviso: ' + (error.response?.data?.detail || error.message));
        } finally {
          setSendingAnnouncement(false);
        }
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
      alert(`Correo enviado a ${u.email} con su enlace para fijar contraseña (también copiado por si acaso, válido 24h):\n${resetLink}`);
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

  const handleSaveProfile = async (payload) => {
    await adminService.updateStudent(profileEditingUser.id, payload);
    setProfileEditingUser(null);
    loadRoster();
  };

  // Subir la foto es una llamada aparte (multipart) del guardado del resto del perfil (JSON) --
  // se sube al momento y se refleja tanto en el modal abierto como en la tabla de fondo, sin
  // esperar a que se pulse "Guardar".
  const handleAvatarUploaded = (updatedUser) => {
    setProfileEditingUser(updatedUser);
    setRoster((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
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

        {activeTab === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-cards">
            {[
              { key: 'upload', icon: '📤', label: 'Subir Preguntas', description: 'Sube preguntas nuevas desde un archivo JSON', testId: 'card-upload' },
              { key: 'questions', icon: '📝', label: 'Gestionar Preguntas', description: 'Edita el árbol de preguntas por tema', testId: 'card-questions' },
              { key: 'roster', icon: '🎓', label: 'Alumnos', description: 'Roster de alumnos y staff, accesos y progreso', testId: 'card-roster' },
              {
                key: 'requests',
                icon: '📨',
                label: 'Solicitudes',
                description: 'Solicitudes de acceso pendientes de revisar',
                badge: accessRequests.filter((r) => r.status === 'pending').length,
                testId: 'card-requests',
              },
              { key: 'failures', icon: '📉', label: 'Refuerzo', description: 'Fallos más comunes entre los alumnos', testId: 'card-failures' },
              {
                key: 'documents',
                icon: '📄',
                label: 'Documentos',
                description: 'Documentos de profesores pendientes de aprobar',
                badge: pendingDocs.length,
                testId: 'card-documents',
              },
              {
                key: 'email-activity',
                icon: '📧',
                label: 'Actividad de Email',
                description: 'Envíos recientes: entregados, abiertos, rebotados...',
                testId: 'card-email-activity',
              },
              {
                key: 'profesores',
                icon: '🧑‍🏫',
                label: 'Profesores',
                description: 'Alumnos asignados por profesor: propios y del centro',
                testId: 'card-profesores',
              },
              {
                key: 'content-update',
                icon: '📣',
                label: 'Novedad de temario',
                description: 'Avisa a alumnos y profesores de la actualización del Tema 4 y el Tema 12',
                testId: 'card-content-update',
              },
            ].map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveTab(section.key)}
                className="text-left bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg hover:border-primary-200 transition-shadow"
                data-testid={section.testId}
              >
                <div className="flex items-start justify-between">
                  <div className="text-3xl mb-3">{section.icon}</div>
                  {section.badge > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">{section.badge}</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">{section.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{section.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setActiveTab(null)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ← Volver al panel
          </button>
        )}

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
                viewerRole="admin"
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
              <div className="flex gap-2">
                <button
                  onClick={handleCopyRegistrationLink}
                  className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  🔗 Copiar enlace
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  ✉️ Invitar por email
                </button>
              </div>
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

        {activeTab === 'profesores' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="profesores-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Alumnos por profesor</h2>
            {rosterLoading ? (
              <p className="text-center text-gray-500">Cargando...</p>
            ) : (
              (() => {
                const profesorStats = roster
                  .filter((u) => u.role === 'profesor')
                  .map((p) => {
                    const own = roster.filter((s) => s.role === 'student' && s.assigned_profesor_id === p.id);
                    const propios = own.filter((s) => s.student_type === 'propio').length;
                    return { profesor: p, total: own.length, propios, centro: own.length - propios };
                  });
                return profesorStats.length === 0 ? (
                  <p className="text-sm text-gray-500">Todavía no hay profesores en el roster.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profesor</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Alumnos totales</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">🏠 Propios</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">🏫 Del centro</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {profesorStats.map(({ profesor, total, propios, centro }) => (
                          <tr key={profesor.id}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="flex items-center gap-2">
                                <Avatar user={profesor} size="sm" />
                                {profesor.display_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{total}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{propios}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{centro}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {activeTab === 'content-update' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="content-update-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Novedad de temario — julio 2026</h2>
            <p className="text-sm text-gray-600 mb-4">
              Marca como <strong>NEW</strong> el Tema 4 (nuevo convenio especial de cotización por
              prácticas) y el Tema 12 (reforma del IMV por la Ley 1/2026), y avisa por email y por
              notificación a todos los alumnos y profesores activos, invitándoles a entrar a ADOC.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {rosterLoading
                ? 'Calculando destinatarios...'
                : `Destinatarios: ${roster.filter((u) => (u.role === 'student' || u.role === 'profesor') && !u.revoked).length} alumnos y profesores activos.`}
            </p>
            <button
              onClick={handleSendContentUpdateAnnouncement}
              disabled={sendingAnnouncement || rosterLoading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              data-testid="send-content-update-button"
            >
              {sendingAnnouncement ? 'Enviando...' : '📣 Enviar aviso de novedad'}
            </button>
          </div>
        )}

        {activeTab === 'content-update' && (
          <div className="bg-white rounded-lg shadow p-6 mt-6" data-testid="draft-questions-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">🗂️ Preguntas sin lanzar</h2>
            <p className="text-sm text-gray-600 mb-4">
              Preguntas generadas para las novedades de temario, todavía sin publicar. Revísalas,
              edítalas si hace falta, selecciona las que quieras y publícalas como Cuadernillo
              (se añaden al cuadernillo ya existente del tema) o como Supuesto nuevo.
            </p>
            <DraftQuestionsBank />
          </div>
        )}

        {activeTab === 'email-activity' && (
          <div className="bg-white rounded-lg shadow p-6" data-testid="email-activity-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actividad de Email (Brevo)</h2>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Estadísticas (últimos 7 días)</h3>
              {emailStatsLoading ? (
                <p className="text-sm text-gray-500">Cargando...</p>
              ) : !emailStats ? (
                <p className="text-sm text-gray-500">Sin BREVO_API_KEY configurada, no hay estadísticas.</p>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-gray-900">{emailStats.sent}</span>
                    <span className="text-sm text-gray-500">emails enviados</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Entregado', value: emailStats.delivered_pct, color: 'bg-blue-500' },
                      { label: 'Aperturas estimadas', value: emailStats.opens_pct, color: 'bg-teal-500' },
                      { label: 'Destinatarios rastreables', value: emailStats.trackable_pct, color: 'bg-teal-500' },
                      { label: 'Clicadores únicos', value: emailStats.unique_clicks_pct, color: 'bg-green-500' },
                      { label: 'Rebotado', value: emailStats.bounced_pct, color: 'bg-red-500' },
                      { label: 'Queja', value: emailStats.complaint_pct, color: 'bg-gray-400' },
                      { label: 'Hard bounce', value: emailStats.hard_bounce_pct, color: 'bg-red-500' },
                      { label: 'Soft bounce', value: emailStats.soft_bounce_pct, color: 'bg-amber-500' },
                      { label: 'Bloqueado', value: emailStats.blocked_pct, color: 'bg-gray-500' },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="flex items-baseline justify-between text-xs text-gray-600 mb-1">
                          <span>{m.label}</span>
                          <span className="font-medium">{m.value.toFixed(2)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${m.color}`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {emailActivityLoading ? (
              <p className="text-center text-gray-500">Cargando...</p>
            ) : emailActivityError ? (
              <p className="text-sm text-red-600">{emailActivityError}</p>
            ) : emailActivity.length === 0 ? (
              <p className="text-sm text-gray-500">Todavía no hay actividad registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remitente</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Destinatario</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {emailActivity.map((ev, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${EMAIL_EVENT_BADGE[ev.event] || 'bg-gray-100 text-gray-600'}`}>
                            {ev.event_label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                          {ev.date ? new Date(ev.date).toLocaleString('es-ES') : '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{ev.subject || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{ev.from || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{ev.to || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Invitar por email</h3>
            <p className="text-sm text-gray-500 mb-4">
              Le mandamos el correo de captación con el enlace para solicitar acceso.
            </p>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <input
                autoFocus
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="persona@email.com"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setInviteError(''); }}
                  className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviteSending}
                  className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {inviteSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
          roster={roster}
          currentUserId={currentUser?.id}
          onClose={() => setProfileEditingUser(null)}
          onSave={handleSaveProfile}
          onAvatarUploaded={handleAvatarUploaded}
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

const PREP_TIME_OPTIONS = ['', 'Sin empezar', 'Menos de 6 meses', '6 meses - 1 año', '1 - 2 años', 'Más de 2 años'];

const ProfileEditorModal = ({ user, roster, currentUserId, onClose, onSave, onAvatarUploaded }) => {
  const profile = user.profile || {};
  const isStudent = user.role === 'student';
  const isSelf = user.id === currentUserId;
  const [fullName, setFullName] = useState(profile.full_name || user.display_name || '');
  const [birthDate, setBirthDate] = useState(profile.birth_date || '');
  const [prepTime, setPrepTime] = useState(profile.prep_time || '');
  const [prepWith, setPrepWith] = useState(profile.prep_with || '');
  const [weakPoints, setWeakPoints] = useState(profile.weak_points || '');
  const [linkedUserId, setLinkedUserId] = useState(user.linked_user_id || '');
  const [role, setRole] = useState(user.role);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const linkableAccounts = (roster || []).filter(
    (u) => (u.role === 'admin' || u.role === 'profesor') && u.id !== user.id
  );

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const updated = await adminService.uploadAvatar(user.id, file);
      onAvatarUploaded(updated);
    } catch (err) {
      setAvatarError(err.response?.data?.detail || 'No se pudo subir la foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      display_name: fullName.trim() || user.display_name,
      profile: {
        full_name: fullName.trim() || null,
        birth_date: birthDate || null,
        prep_time: prepTime || null,
        prep_with: prepWith.trim() || null,
        weak_points: weakPoints.trim() || null,
      },
      ...(!isStudent && { linked_user_id: linkedUserId || null }),
      // Solo se manda si de verdad cambió -- si no, un simple "guardar el nombre" sobre la
      // propia cuenta no debe tropezar con el bloqueo de "no puedes cambiar tu propio rol".
      ...(role !== user.role && { role }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Perfil de {user.display_name}</h3>
        <div className="flex items-center gap-4 mb-4">
          <Avatar user={user} size="lg" />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
            </button>
            {avatarError && <p className="text-xs text-red-600 mt-1">{avatarError}</p>}
          </div>
        </div>
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
            <label className="block text-sm font-medium text-gray-700">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {isSelf && (
              <p className="mt-1 text-xs text-gray-500">No puedes cambiar tu propio rol desde aquí.</p>
            )}
          </div>
          {!isStudent && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Cuenta vinculada (misma persona)</label>
              <select
                value={linkedUserId}
                onChange={(e) => setLinkedUserId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Ninguna</option>
                {linkableAccounts.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Si esta persona tiene dos cuentas (p.ej. admin y profesor), vincúlalas aquí para
                que pueda cambiar entre ellas con un botón, sin volver a iniciar sesión.
              </p>
            </div>
          )}
          {isStudent && (
            <>
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
            </>
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

export default Admin;
