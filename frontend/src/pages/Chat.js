import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { messageService } from '../services/messageService';
import { useAuth } from '../context/AuthContext';

const Chat = () => {
  const { studentId: studentIdParam } = useParams();
  const { user } = useAuth();
  // El alumno chatea con su propio hilo (no necesita studentId en la URL); el profesor/admin
  // usan el studentId del alumno que están viendo.
  const studentId = studentIdParam || user.id;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await messageService.getThread(studentId);
      setMessages(data);
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await messageService.sendMessage(studentId, text);
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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>
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
      </div>
    </Layout>
  );
};

export default Chat;
