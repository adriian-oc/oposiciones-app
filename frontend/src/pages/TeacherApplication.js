import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { accessRequestService } from '../services/accessRequestService';

const TeacherApplication = () => {
  const [form, setForm] = useState({
    email: '', nombre: '', telefono: '', especialidad: '', experiencia: '', disponibilidad: '', mensaje: '',
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await accessRequestService.create({ ...form, tipo: 'profesor' });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud enviada!</h2>
          <p className="text-gray-600">Revisaremos tu candidatura y nos pondremos en contacto contigo.</p>
          <Link to="/login" className="mt-6 inline-block text-primary-600 hover:text-primary-500">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Trabaja con nosotros</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Cuéntanos sobre tu experiencia como docente y te contactaremos.
        </p>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre completo"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="Correo electrónico"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="Teléfono"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input name="especialidad" value={form.especialidad} onChange={handleChange} placeholder="Especialidad / materia que impartes"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <textarea name="experiencia" value={form.experiencia} onChange={handleChange} placeholder="Experiencia docente" rows="2"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input name="disponibilidad" value={form.disponibilidad} onChange={handleChange} placeholder="Disponibilidad horaria"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <textarea name="mensaje" value={form.mensaje} onChange={handleChange} placeholder="Cuéntanos algo más (opcional)" rows="2"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <button type="submit" disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Enviando...' : 'Enviar candidatura'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TeacherApplication;
