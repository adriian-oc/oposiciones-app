import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import TopFailuresPanel from '../components/TopFailuresPanel';
import { profesorService } from '../services/profesorService';
import { adminService } from '../services/adminService';

const ProfesorDashboard = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'failures'

  const load = useCallback(async () => {
    try {
      const data = await profesorService.listMyStudents();
      setStudents(data);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkReviewed = async (studentId) => {
    await adminService.markReviewed(studentId);
    load();
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mis Alumnos</h1>

        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('students')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'students'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Alumnos
            </button>
            <button
              onClick={() => setActiveTab('failures')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'failures'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Refuerzo
            </button>
          </nav>
        </div>

        {activeTab === 'students' && (
          students.length === 0 ? (
            <p className="text-gray-500">Todavía no tienes alumnos asignados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((s) => (
                <div key={s.id} className="bg-white rounded-lg shadow-md p-5">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    {s.display_name}
                    {s.has_novedades && (
                      <button
                        onClick={() => handleMarkReviewed(s.id)}
                        title="Hay actividad nueva -- clic para marcar como revisado"
                        className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium"
                      >
                        🆕 Novedades
                      </button>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500">{s.email}</p>
                  <div className="mt-3 text-sm text-gray-600 space-y-1">
                    <div>Exámenes completados: {s.attempts_count}</div>
                    <div>Puntuación media: {s.average_score ?? '—'}</div>
                    <div>
                      Última actividad:{' '}
                      {s.last_activity ? new Date(s.last_activity).toLocaleDateString('es-ES') : '—'}
                    </div>
                  </div>
                  <Link
                    to={`/profesor/chat/${s.id}`}
                    className="mt-4 inline-block w-full text-center py-2 px-4 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                  >
                    💬 Chat
                  </Link>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'failures' && <TopFailuresPanel />}
      </div>
    </Layout>
  );
};

export default ProfesorDashboard;
