import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { messageService } from '../services/messageService';
import { notificationService } from '../services/notificationService';
import { NOTIF_ICONS } from '../config/notificationIcons';

const FEED_LIMIT = 100;

// Panel a página completa con todo el historial (no solo lo sin leer, ni capado a 4 como el
// desplegable de la campanita en Layout.js) -- mismas dos fuentes (hilos de chat + notificaciones)
// fusionadas y ordenadas por fecha.
const Comunicaciones = () => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [threadsData, notifsData] = await Promise.all([
        messageService.listThreads(),
        notificationService.getRecent(FEED_LIMIT),
      ]);
      setThreads(threadsData);
      setNotifications(notifsData);
    } catch (error) {
      console.error('Error loading comunicaciones:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClick = async (item) => {
    await item.onSelect();
    navigate(item.link);
  };

  const items = [
    ...threads.map((t) => ({
      key: `msg-${t.student_id}`,
      icon: '💬',
      label: t.display_name,
      sublabel: t.last_message_text || '📎 Adjunto',
      link: `/profesor/chat/${t.student_id}`,
      at: t.last_message_at,
      unread: t.unread,
      onSelect: async () => {},
    })),
    ...notifications.map((n) => ({
      key: `notif-${n.id}`,
      icon: NOTIF_ICONS[n.type] || '🔔',
      label: n.title,
      sublabel: n.message,
      link: n.link,
      at: n.created_at,
      unread: !n.read_at,
      onSelect: async () => {
        if (!n.read_at) await notificationService.markRead(n.id).catch(() => {});
      },
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Panel de comunicaciones</h1>
        <p className="text-sm text-gray-500 mb-6">Todo tu historial de mensajes y avisos, del más reciente al más antiguo.</p>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-gray-500">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500">Todavía no hay ninguna comunicación.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleClick(item)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm truncate ${item.unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{item.sublabel}</div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {item.at ? new Date(item.at).toLocaleString('es-ES') : ''}
                  </span>
                  {item.unread && <span className="h-2 w-2 rounded-full bg-red-500" />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Comunicaciones;
