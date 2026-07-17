import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { accessRequestService } from '../services/accessRequestService';

const AccessRequest = () => {
  const [form, setForm] = useState({
    email: '', nombre: '', nacimiento: '', telefono: '', tiempo_prep: '', con_quien: '', puntos_debiles: '', mensaje: '',
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
      await accessRequestService.create(form);
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
          <p className="text-gray-600">Nos pondremos en contacto contigo en breve.</p>
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
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Solicita acceso</h2>
        <p className="text-gray-600 mb-6 text-sm">Cuéntanos un poco sobre ti y te contactaremos.</p>
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
          <input name="nacimiento" value={form.nacimiento} onChange={handleChange} placeholder="Fecha de nacimiento"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input name="tiempo_prep" value={form.tiempo_prep} onChange={handleChange} placeholder="¿Cuánto tiempo llevas preparándote?"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input name="con_quien" value={form.con_quien} onChange={handleChange} placeholder="¿Con quién te preparas?"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <textarea name="puntos_debiles" value={form.puntos_debiles} onChange={handleChange} placeholder="Puntos débiles" rows="2"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <textarea name="mensaje" value={form.mensaje} onChange={handleChange} placeholder="Mensaje (opcional)" rows="2"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <button type="submit" disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccessRequest;
