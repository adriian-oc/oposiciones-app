import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contestService } from '../services/contestService';
import ContestCountdown from '../components/ContestCountdown';

const PREMIOS = [
  { rango: 'Del 1.º al 5.º puesto', premio: 'Acceso completo a la academia gratis durante 1 año' },
  { rango: 'Del 6.º al 15.º puesto', premio: 'Acceso completo durante 1 año por solo 50 €' },
  { rango: 'Del 16.º al 65.º puesto', premio: 'Acceso completo por 30 €/mes' },
];

const Concurso = () => {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ nombre: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    contestService.getConfig().then(setConfig).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await contestService.signup(form.nombre, form.email);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al inscribirte en el concurso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/branding/logo.png" alt="ADOC" className="h-12 w-auto object-contain" />
          </Link>
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-primary-700 border border-primary-200 rounded-md hover:bg-primary-50">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-3 text-center">
          Concurso de acceso ADOC Oposiciones
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">
          ¿Crees que puedes estar entre los mejores?
        </h1>
        <p className="mt-4 text-center text-gray-600">
          Solo 300 personas podrán participar en este concurso.
        </p>

        {config && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-sm text-gray-500">Cierre de inscripción en:</p>
            <ContestCountdown endAt={config.end_at} />
          </div>
        )}

        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
          <ol className="space-y-2 text-gray-700 list-decimal list-inside">
            <li>Solicita tu participación.</li>
            <li>Realiza la prueba de acceso.</li>
            <li>Tu nota determinará tu premio.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Premios según la clasificación</h2>
          <div className="space-y-3">
            {PREMIOS.map((p) => (
              <div key={p.rango} className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900">{p.rango}</p>
                <p className="text-gray-600 text-sm mt-1">{p.premio}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Los premios se asignarán exclusivamente por orden de nota, de mayor a menor.
          </p>
        </section>

        <section className="mt-12 bg-gray-50 border border-gray-100 rounded-lg p-8">
          {done ? (
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">¡Ya estás dentro!</h3>
              <p className="mt-2 text-gray-600">
                Te hemos mandado un correo para fijar tu contraseña y empezar la prueba de acceso.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
                ¿Preparado para demostrar de lo que eres capaz?
              </h2>
              <p className="text-center text-gray-500 text-sm mb-6">Inscríbete aquí</p>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3 max-w-md mx-auto">
                <input
                  required
                  name="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre completo"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  required
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Correo electrónico"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-md font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? 'Inscribiendo...' : 'Quiero participar'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Concurso;
