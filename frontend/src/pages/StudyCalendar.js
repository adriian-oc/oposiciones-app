import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ViewingBanner from '../components/ViewingBanner';
import { useAuth } from '../context/AuthContext';
import { studyCalendarService } from '../services/studyCalendarService';
import { examService } from '../services/examService';
import { adminService } from '../services/adminService';

const DAY_LABELS = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const StudyCalendar = () => {
  const { userId: routeUserId } = useParams();
  const { user } = useAuth();
  const isOther = !!routeUserId && routeUserId !== user?.id;
  const targetUserId = routeUserId || user?.id;

  const [hours, setHours] = useState({});
  const [entries, setEntries] = useState([]);
  const [viewedUser, setViewedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      if (isOther) {
        const [calendar, roster] = await Promise.all([
          studyCalendarService.getCalendarFor(targetUserId, 14),
          adminService.listStudents(),
        ]);
        setEntries(calendar);
        setViewedUser(roster.find((u) => u.id === targetUserId) || null);
      } else {
        const [prefs, calendar] = await Promise.all([
          studyCalendarService.getPreferences(),
          studyCalendarService.getCalendar(14),
        ]);
        setHours(prefs.hours_per_day);
        setEntries(calendar);
      }
    } catch (error) {
      console.error('Error loading study calendar:', error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isOther]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await studyCalendarService.setPreferences(hours);
      await load();
    } catch (error) {
      alert('Error al guardar las preferencias: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (entryId) => {
    await studyCalendarService.completeEntry(entryId);
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: 'done' } : e)));
  };

  const handleStartPractice = async (entry) => {
    if (!entry.content_unit_key) return;
    setStartingId(entry.id);
    try {
      const attempt = await examService.startPractice(entry.content_unit_key);
      navigate(`/exams/take/${attempt.id}`);
    } catch (error) {
      alert('Error al iniciar la práctica: ' + (error.response?.data?.detail || error.message));
    } finally {
      setStartingId(null);
    }
  };

  const totalWeeklyHours = Object.values(hours).reduce((sum, h) => sum + (parseFloat(h) || 0), 0);

  const entriesByDate = entries.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {isOther && <ViewingBanner label={viewedUser?.email || targetUserId} onExit={() => navigate('/admin')} />}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 Calendario de Estudio</h1>
          {!isOther && (
            <p className="mt-1 text-gray-600 text-sm">
              Dinos cuántas horas puedes dedicar cada día y generamos automáticamente qué estudiar,
              priorizando los temas donde más fallas. Se actualiza solo cada vez que terminas una práctica.
            </p>
          )}
        </div>

        {!isOther && (
          <form onSubmit={handleSavePreferences} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Horas disponibles por día</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DAY_ORDER.map((day) => (
                <div key={day}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{DAY_LABELS[day]}</label>
                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="0.5"
                    value={hours[day] ?? 0}
                    onChange={(e) => setHours({ ...hours, [day]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Total semanal: {totalWeeklyHours}h</span>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar y generar calendario'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {Object.keys(entriesByDate).length === 0 ? (
            <p className="text-center text-gray-500 py-8 bg-white rounded-lg shadow-md">
              {isOther
                ? 'Este alumno todavía no tiene calendario generado.'
                : totalWeeklyHours === 0
                ? 'Configura tus horas disponibles arriba para generar tu calendario.'
                : 'Todavía no hay contenido suficiente para generar el calendario.'}
            </p>
          ) : (
            Object.entries(entriesByDate).map(([dateStr, dayEntries]) => (
              <div key={dateStr} className="bg-white rounded-lg shadow-md p-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  {new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </h3>
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        entry.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {!isOther && (
                          <input
                            type="checkbox"
                            checked={entry.status === 'done'}
                            onChange={() => entry.status !== 'done' && handleComplete(entry.id)}
                            className="flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate flex items-center gap-1.5 ${entry.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal no-underline flex-shrink-0 ${
                                entry.kind === 'review' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {entry.kind === 'review' ? '🔁 Repaso' : '🆕 Nuevo'}
                            </span>
                            <span className="truncate">{entry.title}</span>
                          </div>
                          <div className="text-xs text-gray-500">{entry.allocated_minutes} min · {entry.priority_reason}</div>
                        </div>
                      </div>
                      {!isOther && entry.status !== 'done' && entry.content_unit_key && (
                        <button
                          onClick={() => handleStartPractice(entry)}
                          disabled={startingId === entry.id}
                          className="ml-3 flex-shrink-0 text-xs px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                        >
                          {startingId === entry.id ? 'Iniciando...' : 'Practicar'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default StudyCalendar;
