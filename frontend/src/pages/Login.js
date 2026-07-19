import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full text-center mb-10">
        <img src="/branding/banner.png" alt="ADOC - Academia de Oposiciones" className="mx-auto max-w-full h-auto rounded-lg shadow-md mb-6" />
        <p className="text-gray-700 max-w-lg mx-auto">
          Prepárate con temario actualizado, supuestos prácticos y seguimiento personalizado de un
          profesor. ¿Quieres opositar con nosotros o unirte como docente?
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/solicitar-acceso"
            className="px-5 py-2.5 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
          >
            Quiero preparar mi oposición
          </Link>
          <Link
            to="/trabaja-con-nosotros"
            className="px-5 py-2.5 bg-white text-primary-700 border border-primary-300 rounded-md font-medium hover:bg-primary-50"
          >
            Quiero dar clases
          </Link>
        </div>
      </div>

      <div className="max-w-md w-full space-y-8">
        <p className="text-center text-sm text-gray-600">
          ¿Ya tienes cuenta? Inicia sesión
        </p>
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg">
          <form className="space-y-6" onSubmit={handleSubmit} data-testid="login-form">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded relative" role="alert" data-testid="error-message">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="tu@email.com"
                data-testid="email-input"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="••••••••"
                data-testid="password-input"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="login-button"
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>
          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-gray-500">
              ¿No puedes entrar? Contacta con tu profesor o con administración.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
