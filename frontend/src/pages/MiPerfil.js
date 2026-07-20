import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import Avatar from '../components/Avatar';
import { authService } from '../services/authService';

const PREP_TIME_OPTIONS = ['', 'Sin empezar', 'Menos de 6 meses', '6 meses - 1 año', '1 - 2 años', 'Más de 2 años'];

// Campos de preparación (cuánto tiempo lleva, con quién, puntos débiles) son solo relevantes
// para alumnos -- el profesor/admin aquí solo necesita poder fijar su nombre.
const MiPerfil = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = user?.profile || {};
  const isStudent = user?.role === 'student';
  const mandatory = location.state?.mandatory;

  const [fullName, setFullName] = useState(profile.full_name || user?.display_name || '');
  const [birthDate, setBirthDate] = useState(profile.birth_date || '');
  const [prepTime, setPrepTime] = useState(profile.prep_time || '');
  const [prepWith, setPrepWith] = useState(profile.prep_with || '');
  const [weakPoints, setWeakPoints] = useState(profile.weak_points || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si hay que reintentar
    if (!file) return;
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      await authService.uploadOwnAvatar(file);
      await refreshUser();
    } catch (err) {
      setAvatarError(err.response?.data?.detail || 'No se pudo subir la foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('El nombre completo es obligatorio');
      return;
    }
    if (isStudent && !birthDate) {
      setError('La fecha de nacimiento es obligatoria');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await authService.updateOwnProfile({
        display_name: fullName.trim(),
        profile: {
          full_name: fullName.trim(),
          birth_date: birthDate || null,
          prep_time: prepTime || null,
          prep_with: prepWith.trim() || null,
          weak_points: weakPoints.trim() || null,
        },
      });
      await refreshUser();
      setDone(true);
      if (mandatory) {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Mi perfil</h1>
        {mandatory && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
            Completa tu perfil para poder continuar.
          </p>
        )}
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex items-center gap-4 mb-6">
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
              <label className="block text-sm font-medium text-gray-700">Correo (no editable)</label>
              <input type="text" value={user?.email || ''} disabled className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500" />
            </div>
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
                  <label className="block text-sm font-medium text-gray-700">¿Cuánto tiempo llevas preparándote?</label>
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
                  <label className="block text-sm font-medium text-gray-700">¿Con quién te has preparado?</label>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            {done && !mandatory && <p className="text-sm text-green-600">Perfil guardado.</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default MiPerfil;
