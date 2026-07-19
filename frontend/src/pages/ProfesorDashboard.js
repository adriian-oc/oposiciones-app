import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import TopFailuresPanel from '../components/TopFailuresPanel';
import { profesorService } from '../services/profesorService';
import { adminService } from '../services/adminService';
import { themeService } from '../services/themeService';
import documentService from '../services/documentService';
import { CONTENT_AREAS } from '../config/contentAreas';

const TEMA_AREAS = CONTENT_AREAS.filter((a) => a.kind === 'temas');

const DOC_STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };
const DOC_STATUS_CLASS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const ProfesorDashboard = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'failures' | 'documents'

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState(TEMA_AREAS[0]?.id || '');
  const [areaThemes, setAreaThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

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

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await documentService.listMine();
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'documents') loadDocuments();
  }, [activeTab, loadDocuments]);

  useEffect(() => {
    if (!selectedArea) return;
    const area = TEMA_AREAS.find((a) => a.id === selectedArea);
    if (!area) return;
    themeService.getThemes(area.part).then((themes) => {
      setAreaThemes(themes);
      setSelectedTheme(themes[0]?.id || '');
    });
  }, [selectedArea]);

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!docFile || !selectedTheme) return;
    setUploading(true);
    setUploadError('');
    try {
      await documentService.submit(selectedArea, selectedTheme, docFile);
      setDocFile(null);
      loadDocuments();
    } catch (error) {
      setUploadError(error.response?.data?.detail || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

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
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mis Documentos
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
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      to={`/progreso/${s.id}`}
                      className="text-center py-2 px-3 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200"
                    >
                      📊 Progreso
                    </Link>
                    <Link
                      to={`/calendario/${s.id}`}
                      className="text-center py-2 px-3 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200"
                    >
                      📅 Calendario
                    </Link>
                    <Link
                      to={`/profesor/chat/${s.id}`}
                      className="text-center py-2 px-3 bg-primary-600 text-white rounded-md text-xs font-medium hover:bg-primary-700"
                    >
                      💬 Chat
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'failures' && <TopFailuresPanel />}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <form onSubmit={handleUploadDocument} className="bg-white rounded-lg shadow-md p-5 space-y-3">
              <h3 className="font-medium text-gray-900">Subir un documento PDF</h3>
              <p className="text-sm text-gray-500">
                Queda pendiente de aprobación de un administrador. Una vez aprobado, lo verán tus
                alumnos asignados en Cuadernos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {TEMA_AREAS.map((area) => (
                    <option key={area.id} value={area.id}>{area.label}</option>
                  ))}
                </select>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {areaThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                  ))}
                </select>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-600"
              />
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              <button
                type="submit"
                disabled={uploading || !docFile || !selectedTheme}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {uploading ? 'Subiendo...' : 'Subir documento'}
              </button>
            </form>

            <div className="bg-white rounded-lg shadow-md p-5">
              <h3 className="font-medium text-gray-900 mb-3">Mis documentos subidos</h3>
              {docsLoading ? (
                <p className="text-sm text-gray-500">Cargando...</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no has subido ningún documento.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between border border-gray-100 rounded-md px-3 py-2">
                      <div className="text-sm text-gray-800">
                        {doc.original_filename}
                        <span className="text-xs text-gray-400 ml-2">{doc.area_id} · {doc.theme_id}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_STATUS_CLASS[doc.status]}`}>
                        {DOC_STATUS_LABEL[doc.status] || doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProfesorDashboard;
