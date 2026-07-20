import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { messageService } from '../services/messageService';
import { useAuth } from '../context/AuthContext';

const ROLE_ICON = { student: '🎓', profesor: '🧑‍🏫', admin: '🛠️' };

const Chat = () => {
  const { studentId: studentIdParam } = useParams();
  const { user } = useAuth();
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
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!hasSidebar) return;
    messageService.listThreads()
      .then(setThreads)
      .catch((error) => console.error('Error loading threads:', error))
      .finally(() => setThreadsLoaded(true));
  }, [hasSidebar]);

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
      load();
    } catch (error) {
      alert('Error al enviar el mensaje: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex gap-4" data-testid="chat-page">
        {hasSidebar && (
          <aside className="hidden md:flex w-64 flex-shrink-0 bg-white rounded-lg shadow-md flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-900">Contactos</div>
            <div className="overflow-y-auto">
              {!threadsLoaded ? (
                <p className="px-4 py-3 text-sm text-gray-500">Cargando...</p>
              ) : threads.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">Todavía no hay conversaciones.</p>
              ) : (
                threads.map((t) => (
                  <Link
                    key={t.student_id}
                    to={`/profesor/chat/${t.student_id}`}
                    className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                      t.student_id === activeStudentId ? 'bg-primary-50' : ''
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">👤</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm truncate ${t.unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {t.display_name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{t.last_message_text}</div>
                    </div>
                    {t.unread && <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />}
                  </Link>
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
                      {m.text}
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
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Chat;
