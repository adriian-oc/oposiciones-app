import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmDialog from '../components/ConfirmDialog';
import { messageService } from '../services/messageService';
import { profesorService } from '../services/profesorService';
import { adminService } from '../services/adminService';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
const attachmentUrl = (path) => `${API_BASE_URL}/uploads/${path}`;

const ROLE_ICON = { student: '🎓', profesor: '🧑‍🏫', admin: '🛠️' };
const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt';

const Chat = () => {
  const { studentId: studentIdParam } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasSidebar = user.role === 'profesor' || user.role === 'admin';

  const [threads, setThreads] = useState([]);
  const [threadsLoaded, setThreadsLoaded] = useState(!hasSidebar);
  // Alumno: siempre su propio hilo. Profesor sin hilo elegido: el suyo con administración
  // (mismo hilo que antes abría "💬 Administración"). Admin sin hilo elegido: el más reciente
  // de la lista, una vez cargada -- un admin no tiene hilo propio real que mostrar por defecto.
  const activeStudentId =
    studentIdParam || (user.role !== 'admin' ? user.id : threads[0]?.student_id);

  const [counterpart, setCounterpart] = useState(null);
  const [messages, setMessages] = useState([]);
  // Prellenado desde AskTeacherButton (pregunta fallada en un examen) -- solo la primera vez
  // que se monta el componente, no en cada re-render.
  const [text, setText] = useState(() => searchParams.get('prefill') || '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Menú "..." de cada contacto (borrar) y modal de nueva conversación.
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactFilter, setContactFilter] = useState('');

  const loadThreads = useCallback(() => {
    if (!hasSidebar) return;
    return messageService.listThreads()
      .then(setThreads)
      .catch((error) => console.error('Error loading threads:', error))
      .finally(() => setThreadsLoaded(true));
  }, [hasSidebar]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const load = useCallback(async () => {
    if (!activeStudentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [msgs, who] = await Promise.all([
        messageService.getThread(activeStudentId),
        messageService.getCounterpart(activeStudentId),
      ]);
      setMessages(msgs);
      setCounterpart(who);
      // Marcar como leído en la barra de contactos sin esperar a recargarla entera.
      setThreads((prev) => prev.map((t) => (t.student_id === activeStudentId ? { ...t, unread: false } : t)));
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  }, [activeStudentId]);

  useEffect(() => {
    if (!threadsLoaded) return; // esperar a saber el hilo por defecto (admin) antes de cargar
    load();
  }, [load, threadsLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeStudentId) return;
    setSending(true);
    try {
      await messageService.sendMessage(activeStudentId, text);
      setText('');
      await load();
      loadThreads();
    } catch (error) {
      alert('Error al enviar el mensaje: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si hay que reintentar
    if (!file || !activeStudentId) return;
    setAttaching(true);
    try {
      await messageService.sendAttachment(activeStudentId, file, text);
      setText('');
      await load();
      loadThreads();
    } catch (error) {
      alert('Error al enviar el archivo: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAttaching(false);
    }
  };

  const handleConfirmDelete = async () => {
    const id = deletingId;
    setDeletingId(null);
    try {
      await messageService.deleteThread(id);
      setThreads((prev) => prev.filter((t) => t.student_id !== id));
      if (activeStudentId === id) navigate('/chat');
    } catch (error) {
      alert('Error al borrar la conversación: ' + (error.response?.data?.detail || error.message));
    }
  };

  const openNewConversation = async () => {
    setShowNewConvo(true);
    setContactFilter('');
    setContactsLoading(true);
    try {
      const data = user.role === 'profesor'
        ? await profesorService.listMyStudents()
        : (await adminService.listStudents()).filter((u) => u.role === 'student' || u.role === 'profesor');
      setContacts(data.filter((c) => c.id !== user.id));
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setContactsLoading(false);
    }
  };

  const existingThreadIds = new Set(threads.map((t) => t.student_id));
  const eligibleContacts = contacts.filter(
    (c) => !existingThreadIds.has(c.id) && c.display_name.toLowerCase().includes(contactFilter.toLowerCase())
  );

  const goToContact = (id) => {
    setShowNewConvo(false);
    navigate(`/profesor/chat/${id}`);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex gap-4" data-testid="chat-page">
        {hasSidebar && (
          <aside className="hidden md:flex w-64 flex-shrink-0 bg-white rounded-lg shadow-md flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="font-semibold text-gray-900">Contactos</span>
              <button
                type="button"
                onClick={openNewConversation}
                title="Nueva conversación"
                className="text-primary-600 hover:text-primary-800 text-lg leading-none"
                data-testid="new-conversation-button"
              >
                ＋
              </button>
            </div>
            <div className="overflow-y-auto">
              {!threadsLoaded ? (
                <p className="px-4 py-3 text-sm text-gray-500">Cargando...</p>
              ) : threads.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">Todavía no hay conversaciones.</p>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.student_id}
                    className={`relative flex items-center gap-1 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                      t.student_id === activeStudentId ? 'bg-primary-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/profesor/chat/${t.student_id}`)}
                      className="flex items-center gap-2 flex-1 min-w-0 px-4 py-3 text-left"
                    >
                      <span className="text-lg flex-shrink-0">👤</span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm truncate ${t.unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {t.display_name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{t.last_message_text || '📎 Adjunto'}</div>
                      </div>
                      {t.unread && <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />}
                    </button>
                    <div className="relative flex-shrink-0 pr-2">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === t.student_id ? null : t.student_id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700"
                        aria-label="Opciones de la conversación"
                      >
                        ⋮
                      </button>
                      {openMenuId === t.student_id && (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-10 cursor-default"
                            aria-label="Cerrar menú"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeletingId(t.student_id);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              🗑️ Borrar conversación
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>{ROLE_ICON[counterpart?.role] || '💬'}</span>
            {loading ? 'Chat' : counterpart ? `Chat con ${counterpart.display_name}` : 'Chat'}
          </h1>
          {!activeStudentId ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              Selecciona una conversación en la lista de contactos.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-md p-4 h-[60vh] overflow-y-auto flex flex-col gap-2">
                {loading ? (
                  <p className="text-center text-gray-500">Cargando...</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-gray-500">Todavía no hay mensajes.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                        m.sender_id === user.id
                          ? 'self-end bg-primary-600 text-white'
                          : 'self-start bg-gray-100 text-gray-900'
                      }`}
                    >
                      {m.attachment_path && (
                        <a
                          href={attachmentUrl(m.attachment_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mb-1"
                        >
                          {m.attachment_type === 'image' ? (
                            <img
                              src={attachmentUrl(m.attachment_path)}
                              alt={m.attachment_name}
                              className="max-w-full max-h-60 rounded-md"
                            />
                          ) : (
                            <span
                              className={`flex items-center gap-1 underline ${
                                m.sender_id === user.id ? 'text-white' : 'text-primary-700'
                              }`}
                            >
                              📎 {m.attachment_name}
                            </span>
                          )}
                        </a>
                      )}
                      {m.text && <div>{m.text}</div>}
                      <div className={`text-[10px] mt-1 ${m.sender_id === user.id ? 'text-primary-100' : 'text-gray-400'}`}>
                        {new Date(m.created_at).toLocaleString('es-ES')}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSend} className="mt-4 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attaching}
                  title="Adjuntar documento o imagen"
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  📎
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  type="submit"
                  disabled={sending || attaching}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {attaching ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showNewConvo && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nueva conversación</h3>
            <input
              type="text"
              autoFocus
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              placeholder="Buscar..."
              className="px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
            />
            <div className="overflow-y-auto flex-1 -mx-2 px-2">
              {contactsLoading ? (
                <p className="text-sm text-gray-500">Cargando...</p>
              ) : eligibleContacts.length === 0 ? (
                <p className="text-sm text-gray-500">No hay más contactos disponibles.</p>
              ) : (
                eligibleContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goToContact(c.id)}
                    className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-md hover:bg-gray-50"
                  >
                    <span>{ROLE_ICON[c.role] || '👤'}</span>
                    <span className="text-sm text-gray-800">{c.display_name}</span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowNewConvo(false)}
              className="mt-4 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {deletingId && (
        <ConfirmDialog
          message="¿Borrar esta conversación? Se eliminan todos los mensajes, no se puede deshacer."
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </Layout>
  );
};

export default Chat;
